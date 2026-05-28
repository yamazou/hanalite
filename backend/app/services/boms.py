"""BOM (Bill of Materials) CRUD."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.boms import Bom
from app.models.masters import Item, Location
from app.schemas.boms import BomCreate, BomItemRef, BomOut, BomUpdate
from app.services.masters import MasterError, resolve_item_by_ref


class BomError(Exception):
    pass


def _now() -> datetime:
    return datetime.now()


def _resolve_ref(db: Session, ref: BomItemRef) -> Item:
    try:
        return resolve_item_by_ref(
            db,
            item_id=ref.item_id,
            item_cd=ref.item_cd,
            item_nm=ref.item_nm,
        )
    except MasterError as e:
        raise BomError(str(e)) from e


def _resolve_location_or_error(db: Session, location_id: int) -> Location:
    row = db.get(Location, location_id)
    if not row or row.deleted_at is not None:
        raise BomError(f"Location {location_id} not found.")
    return row


def _to_out(bom: Bom, parent: Item, child: Item, location: Location) -> BomOut:
    return BomOut(
        bom_id=bom.bom_id,
        p_item_id=parent.item_id,
        p_item_cd=parent.item_cd,
        p_item_nm=parent.item_nm,
        c_item_id=child.item_id,
        c_item_cd=child.item_cd,
        c_item_nm=child.item_nm,
        location_id=location.location_id,
        location_cd=location.location_cd,
        location_nm=location.location_nm,
        c_req_qty=bom.c_req_qty,
        created_at=bom.created_at,
        updated_at=bom.updated_at,
    )


def _load_row(db: Session, bom_id: int) -> BomOut:
    row = db.scalar(
        select(Bom).where(Bom.bom_id == bom_id, Bom.deleted_at.is_(None))
    )
    if not row:
        raise BomError("BOM not found.")
    parent = db.get(Item, row.p_item_id)
    child = db.get(Item, row.c_item_id)
    location = db.get(Location, row.location_id)
    if (
        not parent
        or not child
        or not location
        or parent.deleted_at
        or child.deleted_at
        or location.deleted_at
    ):
        raise BomError("BOM item reference invalid.")
    return _to_out(row, parent, child, location)


def list_boms(db: Session, *, p_item_id: int | None = None) -> list[BomOut]:
    p = Item.__table__.alias("p")
    c = Item.__table__.alias("c")
    l = Location.__table__.alias("l")
    stmt = (
        select(Bom, p.c.item_cd, p.c.item_nm, c.c.item_cd, c.c.item_nm, l.c.location_cd, l.c.location_nm)
        .join(p, p.c.item_id == Bom.p_item_id)
        .join(c, c.c.item_id == Bom.c_item_id)
        .join(l, l.c.location_id == Bom.location_id)
        .where(Bom.deleted_at.is_(None))
        .order_by(p.c.item_cd, c.c.item_cd, l.c.location_cd)
    )
    if p_item_id:
        stmt = stmt.where(Bom.p_item_id == p_item_id)
    rows = db.execute(stmt).all()
    return [
        BomOut(
            bom_id=bom.bom_id,
            p_item_id=bom.p_item_id,
            p_item_cd=p_cd,
            p_item_nm=p_nm,
            c_item_id=bom.c_item_id,
            c_item_cd=c_cd,
            c_item_nm=c_nm,
            location_id=bom.location_id,
            location_cd=l_cd,
            location_nm=l_nm,
            c_req_qty=bom.c_req_qty,
            created_at=bom.created_at,
            updated_at=bom.updated_at,
        )
        for bom, p_cd, p_nm, c_cd, c_nm, l_cd, l_nm in rows
    ]


def create_bom(db: Session, payload: BomCreate) -> BomOut:
    parent = _resolve_ref(db, payload.parent)
    child = _resolve_ref(db, payload.child)
    location = _resolve_location_or_error(db, payload.location_id)
    if parent.item_id == child.item_id:
        raise BomError("Parent and child must be different items.")

    existing = db.scalar(
        select(Bom).where(
            Bom.p_item_id == parent.item_id,
            Bom.c_item_id == child.item_id,
            Bom.location_id == location.location_id,
            Bom.deleted_at.is_(None),
        )
    )
    if existing:
        raise BomError("This parent/child BOM line already exists.")

    now = _now()
    row = Bom(
        p_item_id=parent.item_id,
        c_item_id=child.item_id,
        location_id=location.location_id,
        c_req_qty=Decimal(payload.c_req_qty),
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as e:
        raise BomError("BOM already exists for this parent/child pair.") from e
    return _to_out(row, parent, child, location)


def update_bom(db: Session, bom_id: int, payload: BomUpdate) -> BomOut:
    row = db.get(Bom, bom_id)
    if not row or row.deleted_at is not None:
        raise BomError("BOM not found.")

    parent = db.get(Item, row.p_item_id)
    child = db.get(Item, row.c_item_id)
    location = db.get(Location, row.location_id)
    if not parent or not child or not location:
        raise BomError("BOM item reference invalid.")

    if payload.parent is not None:
        parent = _resolve_ref(db, payload.parent)
        row.p_item_id = parent.item_id
    if payload.child is not None:
        child = _resolve_ref(db, payload.child)
        row.c_item_id = child.item_id
    if payload.location_id is not None:
        location = _resolve_location_or_error(db, payload.location_id)
        row.location_id = location.location_id
    if payload.c_req_qty is not None:
        row.c_req_qty = Decimal(payload.c_req_qty)

    if row.p_item_id == row.c_item_id:
        raise BomError("Parent and child must be different items.")

    dup = db.scalar(
        select(Bom).where(
            Bom.p_item_id == row.p_item_id,
            Bom.c_item_id == row.c_item_id,
            Bom.location_id == row.location_id,
            Bom.deleted_at.is_(None),
            Bom.bom_id != bom_id,
        )
    )
    if dup:
        raise BomError("This parent/child BOM line already exists.")

    row.updated_at = _now()
    db.flush()
    return _to_out(row, parent, child, location)


def delete_bom(db: Session, bom_id: int) -> None:
    row = db.get(Bom, bom_id)
    if not row or row.deleted_at is not None:
        raise BomError("BOM not found.")
    row.deleted_at = _now()
    row.updated_at = _now()
