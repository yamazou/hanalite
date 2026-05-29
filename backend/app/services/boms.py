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


def _to_out(bom: Bom, parent: Item, child: Item, from_location: Location, to_location: Location) -> BomOut:
    return BomOut(
        bom_id=bom.bom_id,
        p_item_id=parent.item_id,
        p_item_cd=parent.item_cd,
        p_item_nm=parent.item_nm,
        c_item_id=child.item_id,
        c_item_cd=child.item_cd,
        c_item_nm=child.item_nm,
        level=bom.level,
        from_location_id=from_location.location_id,
        from_location_cd=from_location.location_cd,
        from_location_nm=from_location.location_nm,
        to_location_id=to_location.location_id,
        to_location_cd=to_location.location_cd,
        to_location_nm=to_location.location_nm,
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
    from_location = db.get(Location, row.from_location_id)
    to_location = db.get(Location, row.to_location_id)
    if (
        not parent
        or not child
        or not from_location
        or not to_location
        or parent.deleted_at
        or child.deleted_at
        or from_location.deleted_at
        or to_location.deleted_at
    ):
        raise BomError("BOM item reference invalid.")
    return _to_out(row, parent, child, from_location, to_location)


def list_boms(db: Session, *, p_item_id: int | None = None) -> list[BomOut]:
    p = Item.__table__.alias("p")
    c = Item.__table__.alias("c")
    f = Location.__table__.alias("f")
    t = Location.__table__.alias("t")
    stmt = (
        select(
            Bom,
            p.c.item_cd,
            p.c.item_nm,
            c.c.item_cd,
            c.c.item_nm,
            f.c.location_cd,
            f.c.location_nm,
            t.c.location_cd,
            t.c.location_nm,
        )
        .join(p, p.c.item_id == Bom.p_item_id)
        .join(c, c.c.item_id == Bom.c_item_id)
        .join(f, f.c.location_id == Bom.from_location_id)
        .join(t, t.c.location_id == Bom.to_location_id)
        .where(Bom.deleted_at.is_(None))
        .order_by(Bom.level.asc(), p.c.item_cd, c.c.item_cd, f.c.location_cd, t.c.location_cd)
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
            level=bom.level,
            from_location_id=bom.from_location_id,
            from_location_cd=f_cd,
            from_location_nm=f_nm,
            to_location_id=bom.to_location_id,
            to_location_cd=t_cd,
            to_location_nm=t_nm,
            c_req_qty=bom.c_req_qty,
            created_at=bom.created_at,
            updated_at=bom.updated_at,
        )
        for bom, p_cd, p_nm, c_cd, c_nm, f_cd, f_nm, t_cd, t_nm in rows
    ]


def create_bom(db: Session, payload: BomCreate) -> BomOut:
    parent = _resolve_ref(db, payload.parent)
    child = _resolve_ref(db, payload.child)
    from_location = _resolve_location_or_error(db, payload.from_location_id)
    to_location = _resolve_location_or_error(db, payload.to_location_id)
    if from_location.location_id == to_location.location_id:
        raise BomError("From location and to location must be different.")

    existing = db.scalar(
        select(Bom).where(
            Bom.p_item_id == parent.item_id,
            Bom.c_item_id == child.item_id,
            Bom.from_location_id == from_location.location_id,
            Bom.to_location_id == to_location.location_id,
            Bom.deleted_at.is_(None),
        )
    )
    if existing:
        raise BomError("This BOM line already exists for the same parent/child/from/to.")

    now = _now()
    row = Bom(
        p_item_id=parent.item_id,
        c_item_id=child.item_id,
        level=int(payload.level),
        from_location_id=from_location.location_id,
        to_location_id=to_location.location_id,
        c_req_qty=Decimal(payload.c_req_qty),
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as e:
        raise BomError("BOM already exists for this parent/child/from/to combination.") from e
    return _to_out(row, parent, child, from_location, to_location)


def update_bom(db: Session, bom_id: int, payload: BomUpdate) -> BomOut:
    row = db.get(Bom, bom_id)
    if not row or row.deleted_at is not None:
        raise BomError("BOM not found.")

    parent = db.get(Item, row.p_item_id)
    child = db.get(Item, row.c_item_id)
    from_location = db.get(Location, row.from_location_id)
    to_location = db.get(Location, row.to_location_id)
    if not parent or not child or not from_location or not to_location:
        raise BomError("BOM item reference invalid.")

    if payload.parent is not None:
        parent = _resolve_ref(db, payload.parent)
        row.p_item_id = parent.item_id
    if payload.child is not None:
        child = _resolve_ref(db, payload.child)
        row.c_item_id = child.item_id
    if payload.level is not None:
        row.level = int(payload.level)
    if payload.from_location_id is not None:
        from_location = _resolve_location_or_error(db, payload.from_location_id)
        row.from_location_id = from_location.location_id
    if payload.to_location_id is not None:
        to_location = _resolve_location_or_error(db, payload.to_location_id)
        row.to_location_id = to_location.location_id
    if payload.c_req_qty is not None:
        row.c_req_qty = Decimal(payload.c_req_qty)

    if row.from_location_id == row.to_location_id:
        raise BomError("From location and to location must be different.")

    dup = db.scalar(
        select(Bom).where(
            Bom.p_item_id == row.p_item_id,
            Bom.c_item_id == row.c_item_id,
            Bom.from_location_id == row.from_location_id,
            Bom.to_location_id == row.to_location_id,
            Bom.deleted_at.is_(None),
            Bom.bom_id != bom_id,
        )
    )
    if dup:
        raise BomError("This BOM line already exists for the same parent/child/from/to.")

    row.updated_at = _now()
    db.flush()
    return _to_out(row, parent, child, from_location, to_location)


def delete_bom(db: Session, bom_id: int) -> None:
    row = db.get(Bom, bom_id)
    if not row or row.deleted_at is not None:
        raise BomError("BOM not found.")
    row.deleted_at = _now()
    row.updated_at = _now()
