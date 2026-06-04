from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_tenant
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    UserMasterCreate,
    UserMasterOut,
    UserMasterUpdate,
)
from app.services.auth_service import AuthError, create_user, delete_user, list_login_companies, list_users, login, update_user
from app.tenant import TenantContext

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/companies")
def get_login_companies(db: Session = Depends(get_db)):
    return list_login_companies(db)


@router.post("/login", response_model=LoginResponse)
def post_login(payload: LoginRequest, db: Session = Depends(get_db)):
    try:
        return login(db, payload)
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


protected = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(require_tenant)])


@protected.get("/me")
def get_me(ctx: Annotated[TenantContext, Depends(require_tenant)]):
    return {
        "user_id": ctx.user_id,
        "user_cd": ctx.user_cd,
        "co_id": ctx.co_id,
        "company_cd": ctx.company_cd,
    }


@protected.get("/users", response_model=list[UserMasterOut])
def get_users(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_tenant),
):
    return list_users(db, ctx)


@protected.post("/users", response_model=UserMasterOut)
def post_user(
    payload: UserMasterCreate,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_tenant),
):
    try:
        return create_user(db, ctx, payload)
    except AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@protected.patch("/users/{user_id}", response_model=UserMasterOut)
def patch_user(
    user_id: int,
    payload: UserMasterUpdate,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_tenant),
):
    try:
        return update_user(db, ctx, user_id, payload)
    except AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@protected.delete("/users/{user_id}", status_code=204)
def remove_user(
    user_id: int,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_tenant),
):
    try:
        delete_user(db, ctx, user_id)
    except AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
