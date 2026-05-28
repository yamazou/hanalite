"""Master data CRUD (soft delete)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.inventory import MoveTyp
from app.models.masters import Item, ItemProc, ItemTyp, Location, Supplier
from app.schemas.masters import (
    ItemCreate,
    ItemDetailOut,
    ItemListOut,
    ItemSearchOut,
    ItemTypCreate,
    ItemTypOut,
    ItemProcCreate,
    ItemProcOut,
    ItemProcUpdate,
    LocationCreate,
    LocationOut,
    LocationUpdate,
    ItemUpdate,
    MoveTypCreate,
    MoveTypMasterOut,
    SupplierCreate,
    SupplierOut,
)


class MasterError(Exception):
    pass


def _now() -> datetime:
    return datetime.now()


def _soft_delete(row) -> None:
    if row.deleted_at is not None:
        raise MasterError("Record not found.")
    row.deleted_at = _now()
    row.updated_at = _now()


def list_itemtyps(db: Session) -> list[ItemTypOut]:
    rows = db.scalars(
        select(ItemTyp).where(ItemTyp.deleted_at.is_(None)).order_by(ItemTyp.itemtyp_id)
    ).all()
    return [ItemTypOut.model_validate(r) for r in rows]


def create_itemtyp(db: Session, payload: ItemTypCreate) -> ItemTypOut:
    now = _now()
    row = ItemTyp(itemtyp_nm=payload.itemtyp_nm.strip(), created_at=now, updated_at=now)
    db.add(row)
    db.flush()
    return ItemTypOut.model_validate(row)


def delete_itemtyp(db: Session, itemtyp_id: int) -> None:
    row = db.get(ItemTyp, itemtyp_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Item type not found.")
    _soft_delete(row)


def list_suppliers(db: Session) -> list[SupplierOut]:
    rows = db.scalars(
        select(Supplier).where(Supplier.deleted_at.is_(None)).order_by(Supplier.suppliers_id)
    ).all()
    return [SupplierOut.model_validate(r) for r in rows]


def create_supplier(db: Session, payload: SupplierCreate) -> SupplierOut:
    now = _now()
    row = Supplier(suppliers_nm=payload.suppliers_nm.strip(), created_at=now, updated_at=now)
    db.add(row)
    db.flush()
    return SupplierOut.model_validate(row)


def delete_supplier(db: Session, suppliers_id: int) -> None:
    row = db.get(Supplier, suppliers_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Supplier not found.")
    _soft_delete(row)


def list_movetyps(db: Session) -> list[MoveTypMasterOut]:
    rows = db.scalars(
        select(MoveTyp).where(MoveTyp.deleted_at.is_(None)).order_by(MoveTyp.movetyps_id)
    ).all()
    return [MoveTypMasterOut.model_validate(r) for r in rows]


def create_movetyp(db: Session, payload: MoveTypCreate) -> MoveTypMasterOut:
    now = _now()
    row = MoveTyp(movetyps_nm=payload.movetyps_nm.strip(), created_at=now, updated_at=now)
    db.add(row)
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError("Move type name already exists.") from e
    return MoveTypMasterOut.model_validate(row)


def delete_movetyp(db: Session, movetyps_id: int) -> None:
    row = db.get(MoveTyp, movetyps_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Move type not found.")
    _soft_delete(row)


def list_locations(db: Session) -> list[LocationOut]:
    rows = db.scalars(
        select(Location).where(Location.deleted_at.is_(None)).order_by(Location.location_id)
    ).all()
    return [LocationOut.model_validate(r) for r in rows]


def create_location(db: Session, payload: LocationCreate) -> LocationOut:
    now = _now()
    row = Location(
        location_cd=payload.location_cd.strip(),
        location_nm=payload.location_nm.strip(),
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError("Location code or name already exists.") from e
    return LocationOut.model_validate(row)


def delete_location(db: Session, location_id: int) -> None:
    row = db.get(Location, location_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Location not found.")
    _soft_delete(row)


def update_location(db: Session, location_id: int, payload: LocationUpdate) -> LocationOut:
    row = db.get(Location, location_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Location not found.")
    row.location_cd = payload.location_cd.strip()
    row.location_nm = payload.location_nm.strip()
    row.updated_at = _now()
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError("Location code or name already exists.") from e
    return LocationOut.model_validate(row)


def get_default_location_id(db: Session) -> int:
    row = db.scalar(
        select(Location)
        .where(Location.deleted_at.is_(None))
        .order_by(Location.location_id.asc())
        .limit(1)
    )
    if not row:
        raise MasterError("No active location found. Create at least one location in m_locations.")
    return row.location_id


def resolve_location_id(db: Session, location_id: int | None) -> int:
    if location_id is None:
        return get_default_location_id(db)
    row = db.get(Location, location_id)
    if not row or row.deleted_at is not None:
        raise MasterError(f"Location {location_id} not found.")
    return location_id


def resolve_location_by_ref(
    db: Session,
    *,
    location_id: int | None = None,
    location_cd: str | None = None,
    location_nm: str | None = None,
) -> Location:
    if location_id is not None:
        row = db.get(Location, location_id)
        if row and row.deleted_at is None:
            return row
        raise MasterError(f"Location id {location_id} not found.")

    if location_cd is not None and str(location_cd).strip():
        code = str(location_cd).strip()
        row = db.scalar(select(Location).where(Location.location_cd == code, Location.deleted_at.is_(None)))
        if row:
            return row
        raise MasterError(f"Location code '{code}' not found.")

    if location_nm is not None and str(location_nm).strip():
        name = str(location_nm).strip()
        row = db.scalar(
            select(Location).where(Location.location_nm == name, Location.deleted_at.is_(None)).limit(1)
        )
        if row:
            return row
        raise MasterError(f"Location name '{name}' not found.")

    row = db.scalar(
        select(Location).where(Location.deleted_at.is_(None)).order_by(Location.location_id.asc()).limit(1)
    )
    if row:
        return row
    raise MasterError("No active location found. Create at least one location in m_locations.")


def _normalize_item_cd(item_cd: str) -> str:
    return item_cd.strip()


def _validate_item_cd_unique(
    db: Session, item_cd: str, *, exclude_item_id: int | None = None
) -> None:
    code = _normalize_item_cd(item_cd)
    stmt = select(Item.item_id).where(Item.item_cd == code, Item.deleted_at.is_(None))
    if exclude_item_id is not None:
        stmt = stmt.where(Item.item_id != exclude_item_id)
    if db.scalar(stmt.limit(1)):
        raise MasterError(f"Item code '{code}' already exists.")


def resolve_item_by_ref(
    db: Session,
    *,
    item_id: int | None = None,
    item_cd: str | None = None,
    item_nm: str | None = None,
) -> Item:
    """Resolve an active item by internal id, business code, or exact name."""
    if item_id is not None:
        row = db.get(Item, item_id)
        if row and row.deleted_at is None:
            return row
        raise MasterError(f"Item id {item_id} not found.")

    if item_cd is not None and str(item_cd).strip():
        code = _normalize_item_cd(str(item_cd))
        row = db.scalar(select(Item).where(Item.item_cd == code, Item.deleted_at.is_(None)))
        if row:
            return row
        raise MasterError(f"Item code '{code}' not found.")

    if item_nm is not None and str(item_nm).strip():
        name = str(item_nm).strip()
        row = db.scalar(select(Item).where(Item.item_nm == name, Item.deleted_at.is_(None)).limit(1))
        if row:
            return row
        raise MasterError(f"Item name '{name}' not found.")

    raise MasterError("item_id, item_cd, or item_nm is required.")


def search_items(db: Session, q: str, *, limit: int = 20) -> list[ItemSearchOut]:
    term = q.strip()
    if not term:
        return []
    pattern = f"%{term}%"
    stmt = (
        select(Item, ItemTyp.itemtyp_nm)
        .join(ItemTyp, ItemTyp.itemtyp_id == Item.itemtyp_id)
        .where(
            Item.deleted_at.is_(None),
            or_(Item.item_cd.like(pattern), Item.item_nm.like(pattern)),
        )
        .order_by(Item.item_cd, Item.item_id)
        .limit(min(limit, 100))
    )
    rows = db.execute(stmt).all()
    return [
        ItemSearchOut(
            item_id=item.item_id,
            item_cd=item.item_cd,
            item_nm=item.item_nm,
            itemtyp_id=item.itemtyp_id,
            itemtyp_nm=itemtyp_nm,
        )
        for item, itemtyp_nm in rows
    ]


def _validate_item_refs(db: Session, payload: ItemCreate | ItemUpdate) -> None:
    itemtyp = db.get(ItemTyp, payload.itemtyp_id)
    if not itemtyp or itemtyp.deleted_at is not None:
        raise MasterError("Item type not found.")
    for sid in (
        payload.supplier1_id,
        payload.supplier2_id,
        payload.supplier3_id,
        payload.supplier4_id,
        payload.supplier5_id,
    ):
        if sid is None:
            continue
        supplier = db.get(Supplier, sid)
        if not supplier or supplier.deleted_at is not None:
            raise MasterError(f"Supplier {sid} not found.")


def list_items(db: Session) -> list[ItemListOut]:
    s1 = Supplier.__table__.alias("s1")
    stmt = (
        select(Item, ItemTyp.itemtyp_nm, s1.c.suppliers_nm)
        .join(ItemTyp, ItemTyp.itemtyp_id == Item.itemtyp_id)
        .outerjoin(s1, s1.c.suppliers_id == Item.supplier1_id)
        .where(Item.deleted_at.is_(None))
        .order_by(Item.item_id)
    )
    rows = db.execute(stmt).all()
    return [
        ItemListOut(
            item_id=item.item_id,
            item_cd=item.item_cd,
            item_nm=item.item_nm,
            itemtyp_id=item.itemtyp_id,
            itemtyp_nm=itemtyp_nm,
            supplier1_id=item.supplier1_id,
            supplier1_nm=supplier1_nm,
        )
        for item, itemtyp_nm, supplier1_nm in rows
    ]


def get_item(db: Session, item_id: int) -> ItemDetailOut:
    row = db.get(Item, item_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Item not found.")
    return ItemDetailOut(
        item_id=row.item_id,
        item_cd=row.item_cd,
        item_nm=row.item_nm,
        itemtyp_id=row.itemtyp_id,
        supplier1_id=row.supplier1_id,
        supplier2_id=row.supplier2_id,
        supplier3_id=row.supplier3_id,
        supplier4_id=row.supplier4_id,
        supplier5_id=row.supplier5_id,
    )


def create_item(db: Session, payload: ItemCreate) -> ItemDetailOut:
    _validate_item_refs(db, payload)
    _validate_item_cd_unique(db, payload.item_cd)
    now = _now()
    row = Item(
        item_cd=_normalize_item_cd(payload.item_cd),
        item_nm=payload.item_nm.strip(),
        itemtyp_id=payload.itemtyp_id,
        supplier1_id=payload.supplier1_id,
        supplier2_id=payload.supplier2_id,
        supplier3_id=payload.supplier3_id,
        supplier4_id=payload.supplier4_id,
        supplier5_id=payload.supplier5_id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError("Item code already exists.") from e
    return get_item(db, row.item_id)


def update_item(db: Session, item_id: int, payload: ItemUpdate) -> ItemDetailOut:
    row = db.get(Item, item_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Item not found.")
    _validate_item_refs(db, payload)
    _validate_item_cd_unique(db, payload.item_cd, exclude_item_id=item_id)
    row.item_cd = _normalize_item_cd(payload.item_cd)
    row.item_nm = payload.item_nm.strip()
    row.itemtyp_id = payload.itemtyp_id
    row.supplier1_id = payload.supplier1_id
    row.supplier2_id = payload.supplier2_id
    row.supplier3_id = payload.supplier3_id
    row.supplier4_id = payload.supplier4_id
    row.supplier5_id = payload.supplier5_id
    row.updated_at = _now()
    db.flush()
    return get_item(db, item_id)


def delete_item(db: Session, item_id: int) -> None:
    row = db.get(Item, item_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Item not found.")
    _soft_delete(row)


def list_itemprocs(db: Session) -> list[ItemProcOut]:
    item = Item.__table__.alias("it")
    rm = Location.__table__.alias("rm")
    wip = Location.__table__.alias("wip")
    stmt = (
        select(
            ItemProc,
            item.c.item_cd,
            item.c.item_nm,
            rm.c.location_cd,
            wip.c.location_cd,
        )
        .join(item, item.c.item_id == ItemProc.item_id)
        .join(rm, rm.c.location_id == ItemProc.rm_location_id)
        .join(wip, wip.c.location_id == ItemProc.wip_location_id)
        .where(ItemProc.deleted_at.is_(None))
        .order_by(item.c.item_cd, ItemProc.process_no, ItemProc.itemproc_id)
    )
    rows = db.execute(stmt).all()
    return [
        ItemProcOut(
            itemproc_id=row.itemproc_id,
            item_id=row.item_id,
            item_cd=item_cd,
            item_nm=item_nm,
            process_no=row.process_no,
            process_nm=row.process_nm,
            rm_location_id=row.rm_location_id,
            rm_location_cd=rm_cd,
            wip_location_id=row.wip_location_id,
            wip_location_cd=wip_cd,
            created_at=row.created_at,
        )
        for row, item_cd, item_nm, rm_cd, wip_cd in rows
    ]


def create_itemproc(db: Session, payload: ItemProcCreate) -> ItemProcOut:
    item_row = resolve_item_by_ref(db, item_id=payload.item_id)
    rm_row = db.get(Location, payload.rm_location_id)
    wip_row = db.get(Location, payload.wip_location_id)
    if not rm_row or rm_row.deleted_at is not None:
        raise MasterError(f"Location {payload.rm_location_id} not found.")
    if not wip_row or wip_row.deleted_at is not None:
        raise MasterError(f"Location {payload.wip_location_id} not found.")
    dup = db.scalar(
        select(ItemProc).where(
            ItemProc.item_id == payload.item_id,
            ItemProc.process_no == payload.process_no,
            ItemProc.deleted_at.is_(None),
        )
    )
    if dup:
        raise MasterError("Item process already exists for this item/process_no.")

    now = _now()
    row = ItemProc(
        item_id=payload.item_id,
        process_no=payload.process_no,
        process_nm=payload.process_nm.strip(),
        rm_location_id=payload.rm_location_id,
        wip_location_id=payload.wip_location_id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.flush()
    return ItemProcOut(
        itemproc_id=row.itemproc_id,
        item_id=row.item_id,
        item_cd=item_row.item_cd,
        item_nm=item_row.item_nm,
        process_no=row.process_no,
        process_nm=row.process_nm,
        rm_location_id=row.rm_location_id,
        rm_location_cd=rm_row.location_cd,
        wip_location_id=row.wip_location_id,
        wip_location_cd=wip_row.location_cd,
        created_at=row.created_at,
    )


def update_itemproc(db: Session, itemproc_id: int, payload: ItemProcUpdate) -> ItemProcOut:
    row = db.get(ItemProc, itemproc_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Item process not found.")

    if payload.process_no is not None:
        dup = db.scalar(
            select(ItemProc).where(
                ItemProc.item_id == row.item_id,
                ItemProc.process_no == payload.process_no,
                ItemProc.deleted_at.is_(None),
                ItemProc.itemproc_id != itemproc_id,
            )
        )
        if dup:
            raise MasterError("Item process already exists for this item/process_no.")
        row.process_no = payload.process_no
    if payload.process_nm is not None:
        row.process_nm = payload.process_nm.strip()
    if payload.rm_location_id is not None:
        loc = db.get(Location, payload.rm_location_id)
        if not loc or loc.deleted_at is not None:
            raise MasterError(f"Location {payload.rm_location_id} not found.")
        row.rm_location_id = payload.rm_location_id
    if payload.wip_location_id is not None:
        loc = db.get(Location, payload.wip_location_id)
        if not loc or loc.deleted_at is not None:
            raise MasterError(f"Location {payload.wip_location_id} not found.")
        row.wip_location_id = payload.wip_location_id
    row.updated_at = _now()
    db.flush()

    item_row = db.get(Item, row.item_id)
    rm_row = db.get(Location, row.rm_location_id)
    wip_row = db.get(Location, row.wip_location_id)
    if not item_row or not rm_row or not wip_row:
        raise MasterError("Item process references invalid master rows.")
    return ItemProcOut(
        itemproc_id=row.itemproc_id,
        item_id=row.item_id,
        item_cd=item_row.item_cd,
        item_nm=item_row.item_nm,
        process_no=row.process_no,
        process_nm=row.process_nm,
        rm_location_id=row.rm_location_id,
        rm_location_cd=rm_row.location_cd,
        wip_location_id=row.wip_location_id,
        wip_location_cd=wip_row.location_cd,
        created_at=row.created_at,
    )


def delete_itemproc(db: Session, itemproc_id: int) -> None:
    row = db.get(ItemProc, itemproc_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Item process not found.")
    _soft_delete(row)
