"""Authentication and user master."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.auth_security import hash_password, verify_password
from app.models.auth import Company, User
from app.schemas.auth import (
    CompanyLoginOut,
    CompanyMasterCreate,
    CompanyMasterOut,
    CompanyMasterUpdate,
    LoginRequest,
    LoginResponse,
    UserMasterCreate,
    UserMasterOut,
    UserMasterUpdate,
    UserSessionOut,
)
from app.tenant import TenantContext, stamp_new, stamp_update


class AuthError(Exception):
    pass


def _now() -> datetime:
    return datetime.now()


def list_login_companies(db: Session) -> list[CompanyLoginOut]:
    rows = db.scalars(
        select(Company)
        .where(Company.deleted_at.is_(None))
        .order_by(Company.company_cd)
    ).all()
    return [
        CompanyLoginOut(co_id=r.co_id, company_cd=r.company_cd, company_nm=r.company_nm)
        for r in rows
    ]


def login(db: Session, payload: LoginRequest) -> LoginResponse:
    from app.auth_security import create_access_token

    company = db.scalars(
        select(Company).where(
            Company.company_cd == payload.company_cd.strip(),
            Company.deleted_at.is_(None),
        )
    ).first()
    if company is None:
        raise AuthError("Invalid company code, user id, or password.")
    user = db.scalars(
        select(User).where(
            User.co_id == company.co_id,
            User.user_cd == payload.user_cd.strip(),
            User.deleted_at.is_(None),
        )
    ).first()
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise AuthError("Invalid company code, user id, or password.")
    token = create_access_token(
        user_id=user.user_id,
        user_cd=user.user_cd,
        co_id=company.co_id,
        company_cd=company.company_cd,
    )
    return LoginResponse(
        access_token=token,
        user=UserSessionOut(
            user_id=user.user_id,
            user_cd=user.user_cd,
            user_nm=user.user_nm,
            co_id=company.co_id,
            company_cd=company.company_cd,
            company_nm=company.company_nm,
        ),
    )


def _archived_code(original: str, row_id: int, *, max_len: int) -> str:
    suffix = f"~{row_id}"
    base = original.strip()
    if len(base) + len(suffix) <= max_len:
        return f"{base}{suffix}"
    return f"{base[: max_len - len(suffix)]}{suffix}"


def _company_out(row: Company) -> CompanyMasterOut:
    return CompanyMasterOut(
        co_id=row.co_id,
        company_cd=row.company_cd,
        company_nm=row.company_nm,
        created_at=row.created_at.isoformat() if row.created_at else None,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )


def _user_out(row: User) -> UserMasterOut:
    company = row.company
    return UserMasterOut(
        user_id=row.user_id,
        co_id=row.co_id,
        company_cd=company.company_cd if company else "",
        company_nm=company.company_nm if company else "",
        user_cd=row.user_cd,
        user_nm=row.user_nm,
        is_active=bool(row.is_active),
        created_at=row.created_at.isoformat() if row.created_at else None,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )


def _resolve_company(db: Session, company_cd: str) -> Company:
    company = db.scalars(
        select(Company).where(
            Company.company_cd == company_cd.strip(),
            Company.deleted_at.is_(None),
        )
    ).first()
    if company is None:
        raise AuthError("Company code not found.")
    return company


def list_companies_master(db: Session) -> list[CompanyMasterOut]:
    rows = db.scalars(
        select(Company)
        .where(Company.deleted_at.is_(None))
        .order_by(Company.company_cd)
    ).all()
    return [_company_out(r) for r in rows]


def create_company(db: Session, payload: CompanyMasterCreate) -> CompanyMasterOut:
    now = _now()
    row = Company(
        company_cd=payload.company_cd.strip(),
        company_nm=payload.company_nm.strip(),
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    try:
        db.commit()
        db.refresh(row)
    except IntegrityError as exc:
        db.rollback()
        raise AuthError("Company code already exists.") from exc
    return _company_out(row)


def update_company(
    db: Session, co_id: int, payload: CompanyMasterUpdate
) -> CompanyMasterOut:
    row = db.scalars(
        select(Company).where(Company.co_id == co_id, Company.deleted_at.is_(None))
    ).first()
    if row is None:
        raise AuthError("Company not found.")
    if payload.company_cd is not None:
        row.company_cd = payload.company_cd.strip()
    if payload.company_nm is not None:
        row.company_nm = payload.company_nm.strip()
    row.updated_at = _now()
    try:
        db.commit()
        db.refresh(row)
    except IntegrityError as exc:
        db.rollback()
        raise AuthError("Company code already exists.") from exc
    return _company_out(row)


def delete_company(db: Session, co_id: int) -> None:
    row = db.scalars(
        select(Company).where(Company.co_id == co_id, Company.deleted_at.is_(None))
    ).first()
    if row is None:
        raise AuthError("Company not found.")
    active_users = db.scalar(
        select(func.count())
        .select_from(User)
        .where(User.co_id == co_id, User.deleted_at.is_(None))
    )
    if active_users and active_users > 0:
        raise AuthError("Cannot delete a company that still has users.")
    cd = row.company_cd.strip()
    archived = _archived_code(cd, row.co_id, max_len=50)
    if archived != cd:
        row.company_cd = archived
    row.deleted_at = _now()
    row.updated_at = _now()
    db.commit()


def list_users(db: Session, _ctx: TenantContext) -> list[UserMasterOut]:
    rows = db.scalars(
        select(User)
        .options(joinedload(User.company))
        .join(Company, User.co_id == Company.co_id)
        .where(User.deleted_at.is_(None))
        .order_by(Company.company_cd, User.user_cd)
    ).all()
    return [_user_out(r) for r in rows]


def create_user(db: Session, ctx: TenantContext, payload: UserMasterCreate) -> UserMasterOut:
    company = _resolve_company(db, payload.company_cd)
    now = _now()
    row = User(
        co_id=company.co_id,
        user_cd=payload.user_cd.strip(),
        user_nm=payload.user_nm.strip(),
        password_hash=hash_password(payload.password),
        is_active=payload.is_active,
        created_at=now,
        updated_at=now,
    )
    stamp_new(row, ctx)
    db.add(row)
    try:
        db.commit()
        db.refresh(row)
    except IntegrityError as exc:
        db.rollback()
        raise AuthError("User id already exists for this company.") from exc
    db.refresh(row)
    row = db.scalars(
        select(User).options(joinedload(User.company)).where(User.user_id == row.user_id)
    ).first()
    return _user_out(row)


def update_user(
    db: Session, ctx: TenantContext, user_id: int, payload: UserMasterUpdate
) -> UserMasterOut:
    row = db.scalars(
        select(User)
        .options(joinedload(User.company))
        .where(User.user_id == user_id, User.deleted_at.is_(None))
    ).first()
    if row is None:
        raise AuthError("User not found.")
    if payload.user_nm is not None:
        row.user_nm = payload.user_nm.strip()
    if payload.password is not None:
        row.password_hash = hash_password(payload.password)
    if payload.is_active is not None:
        row.is_active = payload.is_active
    stamp_update(row, ctx)
    db.commit()
    db.refresh(row)
    return _user_out(row)


def delete_user(db: Session, ctx: TenantContext, user_id: int) -> None:
    if user_id == ctx.user_id:
        raise AuthError("Cannot delete the signed-in user.")
    row = db.scalars(
        select(User).where(User.user_id == user_id, User.deleted_at.is_(None))
    ).first()
    if row is None:
        raise AuthError("User not found.")
    row.deleted_at = _now()
    stamp_update(row, ctx)
    db.commit()
