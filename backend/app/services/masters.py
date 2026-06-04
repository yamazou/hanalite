"""Master data CRUD (soft delete)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.deps import get_tenant
from app.models.inventory import MoveTyp
from app.models.masters import Customer, Item, ItemTyp, Location, LocationTyp, Supplier
from app.schemas.masters import (
    CustomerCreate,
    CustomerOut,
    CustomerUpdate,
    ItemCreate,
    ItemDetailOut,
    ItemListOut,
    ItemSearchOut,
    ItemTypCreate,
    ItemTypOut,
    ItemTypUpdate,
    LocationTypCreate,
    LocationTypOut,
    LocationTypUpdate,
    LocationCreate,
    LocationOut,
    MoveTypUpdate,
    LocationUpdate,
    SupplierUpdate,
    ItemUpdate,
    MoveTypCreate,
    MoveTypMasterOut,
    SupplierCreate,
    SupplierOut,
)
from app.tenant import TenantContext, stamp_new, stamp_update


class MasterError(Exception):
    pass


def _now() -> datetime:
    return datetime.now()


def _soft_delete(row, ctx: TenantContext) -> None:
    if row.deleted_at is not None:
        raise MasterError("Record not found.")
    row.deleted_at = _now()
    stamp_update(row, ctx)


def _archived_master_code(original: str, row_id: int, *, max_len: int) -> str:
    """Unique key-safe code for soft-deleted rows so active rows can reuse the code."""
    suffix = f"~{row_id}"
    base = original.strip()
    if len(base) + len(suffix) <= max_len:
        return f"{base}{suffix}"
    return f"{base[: max_len - len(suffix)]}{suffix}"


def _archive_locationtyp_code(row: LocationTyp, ctx: TenantContext) -> None:
    cd = row.locationtyp_cd.strip()
    archived = _archived_master_code(cd, row.locationtyp_id, max_len=50)
    if archived != cd:
        row.locationtyp_cd = archived
        stamp_update(row, ctx)


def _reuse_locationtyp_code(db: Session, code: str, *, keep_id: int | None) -> None:
    """Rename soft-deleted location types that still hold the unique code."""
    ctx = get_tenant()
    stmt = select(LocationTyp).where(
        LocationTyp.co_id == ctx.co_id,
        LocationTyp.locationtyp_cd == code.strip(),
        LocationTyp.deleted_at.isnot(None),
    )
    if keep_id is not None:
        stmt = stmt.where(LocationTyp.locationtyp_id != keep_id)
    for stale in db.scalars(stmt).all():
        _archive_locationtyp_code(stale, ctx)


def _free_locationtyp_code(db: Session, code: str, *, keep_id: int | None) -> None:
    """Archive soft-deleted codes and flush before assigning the code to an active row."""
    _reuse_locationtyp_code(db, code, keep_id=keep_id)
    db.flush()


def _conflicting_locationtyp(
    db: Session, code: str, *, excluding_id: int | None = None
) -> LocationTyp | None:
    ctx = get_tenant()
    stmt = select(LocationTyp).where(
        LocationTyp.co_id == ctx.co_id,
        LocationTyp.locationtyp_cd == code.strip(),
        LocationTyp.deleted_at.is_(None),
    )
    if excluding_id is not None:
        stmt = stmt.where(LocationTyp.locationtyp_id != excluding_id)
    return db.scalars(stmt.limit(1)).first()


def _locationtyp_code_taken_message(
    db: Session, code: str, *, excluding_id: int | None = None
) -> str:
    other = _conflicting_locationtyp(db, code, excluding_id=excluding_id)
    if other is None:
        return "Location type code already exists."
    label = f"{other.locationtyp_cd} / {other.locationtyp_nm}".strip()
    return f"Location type code already exists ({label})."


def _active_locationtyp_code_exists(
    db: Session, code: str, *, excluding_id: int | None = None
) -> bool:
    return _conflicting_locationtyp(db, code, excluding_id=excluding_id) is not None


def list_itemtyps(db: Session) -> list[ItemTypOut]:
    ctx = get_tenant()
    rows = db.scalars(
        select(ItemTyp)
        .where(ItemTyp.co_id == ctx.co_id, ItemTyp.deleted_at.is_(None))
        .order_by(ItemTyp.itemtyp_id)
    ).all()
    return [ItemTypOut.model_validate(r) for r in rows]


def _validate_locationtyp_id(db: Session, locationtyp_id: int | None) -> None:
    if locationtyp_id is None:
        return
    ctx = get_tenant()
    row = db.scalar(
        select(LocationTyp).where(
            LocationTyp.locationtyp_id == locationtyp_id,
            LocationTyp.co_id == ctx.co_id,
        )
    )
    if not row or row.deleted_at is not None:
        raise MasterError("Location type not found.")


def _location_out(row: Location) -> LocationOut:
    lt = row.locationtyp
    return LocationOut(
        location_id=row.location_id,
        location_cd=row.location_cd,
        location_nm=row.location_nm,
        locationtyp_id=row.locationtyp_id,
        locationtyp_cd=lt.locationtyp_cd if lt and lt.deleted_at is None else None,
        locationtyp_nm=lt.locationtyp_nm if lt and lt.deleted_at is None else None,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def create_itemtyp(db: Session, payload: ItemTypCreate) -> ItemTypOut:
    ctx = get_tenant()
    _validate_locationtyp_id(db, payload.locationtyp_id)
    row = ItemTyp(
        itemtyp_cd=payload.itemtyp_cd.strip(),
        itemtyp_nm=payload.itemtyp_nm.strip(),
        itemtyp_color=payload.itemtyp_color,
        locationtyp_id=payload.locationtyp_id,
    )
    stamp_new(row, ctx)
    db.add(row)
    db.flush()
    return ItemTypOut.model_validate(row)


def delete_itemtyp(db: Session, itemtyp_id: int) -> None:
    ctx = get_tenant()
    row = db.scalar(
        select(ItemTyp).where(ItemTyp.itemtyp_id == itemtyp_id, ItemTyp.co_id == ctx.co_id)
    )
    if not row or row.deleted_at is not None:
        raise MasterError("Item type not found.")
    _soft_delete(row, ctx)


def update_itemtyp(db: Session, itemtyp_id: int, payload: ItemTypUpdate) -> ItemTypOut:
    ctx = get_tenant()
    _validate_locationtyp_id(db, payload.locationtyp_id)
    row = db.scalar(
        select(ItemTyp).where(ItemTyp.itemtyp_id == itemtyp_id, ItemTyp.co_id == ctx.co_id)
    )
    if not row or row.deleted_at is not None:
        raise MasterError("Item type not found.")
    row.itemtyp_cd = payload.itemtyp_cd.strip()
    row.itemtyp_nm = payload.itemtyp_nm.strip()
    row.itemtyp_color = payload.itemtyp_color
    row.locationtyp_id = payload.locationtyp_id
    stamp_update(row, ctx)
    db.flush()
    return ItemTypOut.model_validate(row)


def list_suppliers(db: Session) -> list[SupplierOut]:
    ctx = get_tenant()
    rows = db.scalars(
        select(Supplier)
        .where(Supplier.co_id == ctx.co_id, Supplier.deleted_at.is_(None))
        .order_by(Supplier.suppliers_id)
    ).all()
    return [SupplierOut.model_validate(r) for r in rows]


def create_supplier(db: Session, payload: SupplierCreate) -> SupplierOut:
    ctx = get_tenant()
    row = Supplier(
        suppliers_cd=payload.suppliers_cd.strip(),
        suppliers_nm=payload.suppliers_nm.strip(),
    )
    stamp_new(row, ctx)
    db.add(row)
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError("Supplier code already exists.") from e
    return SupplierOut.model_validate(row)


def delete_supplier(db: Session, suppliers_id: int) -> None:
    ctx = get_tenant()
    row = db.scalar(
        select(Supplier).where(
            Supplier.suppliers_id == suppliers_id,
            Supplier.co_id == ctx.co_id,
        )
    )
    if not row or row.deleted_at is not None:
        raise MasterError("Supplier not found.")
    _soft_delete(row, ctx)


def update_supplier(db: Session, suppliers_id: int, payload: SupplierUpdate) -> SupplierOut:
    ctx = get_tenant()
    row = db.scalar(
        select(Supplier).where(
            Supplier.suppliers_id == suppliers_id,
            Supplier.co_id == ctx.co_id,
        )
    )
    if not row or row.deleted_at is not None:
        raise MasterError("Supplier not found.")
    row.suppliers_cd = payload.suppliers_cd.strip()
    row.suppliers_nm = payload.suppliers_nm.strip()
    stamp_update(row, ctx)
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError("Supplier code already exists.") from e
    return SupplierOut.model_validate(row)


def list_customers(db: Session) -> list[CustomerOut]:
    ctx = get_tenant()
    rows = db.scalars(
        select(Customer)
        .where(Customer.co_id == ctx.co_id, Customer.deleted_at.is_(None))
        .order_by(Customer.customers_id)
    ).all()
    return [CustomerOut.model_validate(r) for r in rows]


def create_customer(db: Session, payload: CustomerCreate) -> CustomerOut:
    ctx = get_tenant()
    row = Customer(
        customers_cd=payload.customers_cd.strip(),
        customers_nm=payload.customers_nm.strip(),
    )
    stamp_new(row, ctx)
    db.add(row)
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError("Customer code already exists.") from e
    return CustomerOut.model_validate(row)


def delete_customer(db: Session, customers_id: int) -> None:
    ctx = get_tenant()
    row = db.scalar(
        select(Customer).where(
            Customer.customers_id == customers_id,
            Customer.co_id == ctx.co_id,
        )
    )
    if not row or row.deleted_at is not None:
        raise MasterError("Customer not found.")
    _soft_delete(row, ctx)


def update_customer(db: Session, customers_id: int, payload: CustomerUpdate) -> CustomerOut:
    ctx = get_tenant()
    row = db.scalar(
        select(Customer).where(
            Customer.customers_id == customers_id,
            Customer.co_id == ctx.co_id,
        )
    )
    if not row or row.deleted_at is not None:
        raise MasterError("Customer not found.")
    row.customers_cd = payload.customers_cd.strip()
    row.customers_nm = payload.customers_nm.strip()
    stamp_update(row, ctx)
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError("Customer code already exists.") from e
    return CustomerOut.model_validate(row)


def list_locationtyps(db: Session) -> list[LocationTypOut]:
    ctx = get_tenant()
    rows = db.scalars(
        select(LocationTyp)
        .where(LocationTyp.co_id == ctx.co_id, LocationTyp.deleted_at.is_(None))
        .order_by(LocationTyp.locationtyp_id)
    ).all()
    return [LocationTypOut.model_validate(r) for r in rows]


def create_locationtyp(db: Session, payload: LocationTypCreate) -> LocationTypOut:
    ctx = get_tenant()
    code = payload.locationtyp_cd.strip()
    _free_locationtyp_code(db, code, keep_id=None)
    if _active_locationtyp_code_exists(db, code):
        raise MasterError(_locationtyp_code_taken_message(db, code))
    row = LocationTyp(
        locationtyp_cd=code,
        locationtyp_nm=payload.locationtyp_nm.strip(),
    )
    stamp_new(row, ctx)
    db.add(row)
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError(_locationtyp_code_taken_message(db, code)) from e
    return LocationTypOut.model_validate(row)


def _master_usage_label(
    db: Session,
    model: type,
    id_column,
    code_column,
    name_column,
    fk_value: int,
    entity_label: str,
    *,
    limit: int = 8,
) -> str | None:
    """Return a short list of master rows blocking delete, or None if unused."""
    ctx = get_tenant()
    total = db.scalar(
        select(func.count())
        .select_from(model)
        .where(
            model.co_id == ctx.co_id,
            id_column == fk_value,
            model.deleted_at.is_(None),
        )
    )
    if not total or int(total) <= 0:
        return None
    rows = db.execute(
        select(code_column, name_column)
        .select_from(model)
        .where(
            model.co_id == ctx.co_id,
            id_column == fk_value,
            model.deleted_at.is_(None),
        )
        .order_by(code_column)
        .limit(limit)
    ).all()
    labels: list[str] = []
    for code, name in rows:
        cd = (code or "").strip()
        nm = (name or "").strip()
        if cd and nm:
            labels.append(f"{cd} ({nm})")
        elif cd:
            labels.append(cd)
        elif nm:
            labels.append(nm)
    if not labels:
        return f"Location type is used by {int(total)} {entity_label}(s)."
    suffix = ""
    if int(total) > len(labels):
        suffix = f" (+{int(total) - len(labels)} more)"
    return f"Location type is used by {entity_label}(s): {', '.join(labels)}{suffix}."


def delete_locationtyp(db: Session, locationtyp_id: int) -> None:
    ctx = get_tenant()
    row = db.scalar(
        select(LocationTyp).where(
            LocationTyp.locationtyp_id == locationtyp_id,
            LocationTyp.co_id == ctx.co_id,
        )
    )
    if not row or row.deleted_at is not None:
        raise MasterError("Location type not found.")
    itemtyp_msg = _master_usage_label(
        db,
        ItemTyp,
        ItemTyp.locationtyp_id,
        ItemTyp.itemtyp_cd,
        ItemTyp.itemtyp_nm,
        locationtyp_id,
        "item type",
    )
    if itemtyp_msg:
        raise MasterError(itemtyp_msg)
    loc_msg = _master_usage_label(
        db,
        Location,
        Location.locationtyp_id,
        Location.location_cd,
        Location.location_nm,
        locationtyp_id,
        "location",
    )
    if loc_msg:
        raise MasterError(loc_msg)
    _soft_delete(row, ctx)
    _archive_locationtyp_code(row, ctx)


def update_locationtyp(
    db: Session, locationtyp_id: int, payload: LocationTypUpdate
) -> LocationTypOut:
    ctx = get_tenant()
    row = db.scalar(
        select(LocationTyp).where(
            LocationTyp.locationtyp_id == locationtyp_id,
            LocationTyp.co_id == ctx.co_id,
        )
    )
    if not row or row.deleted_at is not None:
        raise MasterError("Location type not found.")
    code = payload.locationtyp_cd.strip()
    _free_locationtyp_code(db, code, keep_id=locationtyp_id)
    if _active_locationtyp_code_exists(db, code, excluding_id=locationtyp_id):
        raise MasterError(
            _locationtyp_code_taken_message(db, code, excluding_id=locationtyp_id)
        )
    row.locationtyp_cd = code
    row.locationtyp_nm = payload.locationtyp_nm.strip()
    stamp_update(row, ctx)
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError(
            _locationtyp_code_taken_message(db, code, excluding_id=locationtyp_id)
        ) from e
    return LocationTypOut.model_validate(row)


def list_movetyps(db: Session) -> list[MoveTypMasterOut]:
    ctx = get_tenant()
    rows = db.scalars(
        select(MoveTyp)
        .where(MoveTyp.co_id == ctx.co_id, MoveTyp.deleted_at.is_(None))
        .order_by(MoveTyp.movetyps_id)
    ).all()
    return [MoveTypMasterOut.model_validate(r) for r in rows]


def create_movetyp(db: Session, payload: MoveTypCreate) -> MoveTypMasterOut:
    ctx = get_tenant()
    row = MoveTyp(
        movetyps_cd=payload.movetyps_cd.strip(),
        movetyps_nm=(payload.movetyps_nm or "").strip() or None,
    )
    stamp_new(row, ctx)
    db.add(row)
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError("Move type code already exists.") from e
    return MoveTypMasterOut.model_validate(row)


def delete_movetyp(db: Session, movetyps_id: int) -> None:
    ctx = get_tenant()
    row = db.scalar(
        select(MoveTyp).where(MoveTyp.movetyps_id == movetyps_id, MoveTyp.co_id == ctx.co_id)
    )
    if not row or row.deleted_at is not None:
        raise MasterError("Move type not found.")
    _soft_delete(row, ctx)


def update_movetyp(db: Session, movetyps_id: int, payload: MoveTypUpdate) -> MoveTypMasterOut:
    ctx = get_tenant()
    row = db.scalar(
        select(MoveTyp).where(MoveTyp.movetyps_id == movetyps_id, MoveTyp.co_id == ctx.co_id)
    )
    if not row or row.deleted_at is not None:
        raise MasterError("Move type not found.")
    row.movetyps_cd = payload.movetyps_cd.strip()
    row.movetyps_nm = (payload.movetyps_nm or "").strip() or None
    stamp_update(row, ctx)
    db.flush()
    return MoveTypMasterOut.model_validate(row)


def list_locations(db: Session) -> list[LocationOut]:
    ctx = get_tenant()
    rows = db.scalars(
        select(Location)
        .options(joinedload(Location.locationtyp))
        .where(Location.co_id == ctx.co_id, Location.deleted_at.is_(None))
        .order_by(Location.location_id)
    ).all()
    return [_location_out(r) for r in rows]


def create_location(db: Session, payload: LocationCreate) -> LocationOut:
    ctx = get_tenant()
    _validate_locationtyp_id(db, payload.locationtyp_id)
    row = Location(
        location_cd=payload.location_cd.strip(),
        location_nm=payload.location_nm.strip(),
        locationtyp_id=payload.locationtyp_id,
    )
    stamp_new(row, ctx)
    db.add(row)
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError("Location code or name already exists.") from e
    db.refresh(row, attribute_names=["locationtyp"])
    return _location_out(row)


def delete_location(db: Session, location_id: int) -> None:
    ctx = get_tenant()
    row = db.scalar(
        select(Location).where(Location.location_id == location_id, Location.co_id == ctx.co_id)
    )
    if not row or row.deleted_at is not None:
        raise MasterError("Location not found.")
    _soft_delete(row, ctx)


def update_location(db: Session, location_id: int, payload: LocationUpdate) -> LocationOut:
    ctx = get_tenant()
    row = db.scalar(
        select(Location).where(Location.location_id == location_id, Location.co_id == ctx.co_id)
    )
    if not row or row.deleted_at is not None:
        raise MasterError("Location not found.")
    _validate_locationtyp_id(db, payload.locationtyp_id)
    row.location_cd = payload.location_cd.strip()
    row.location_nm = payload.location_nm.strip()
    row.locationtyp_id = payload.locationtyp_id
    stamp_update(row, ctx)
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError("Location code or name already exists.") from e
    db.refresh(row, attribute_names=["locationtyp"])
    return _location_out(row)


def get_default_location_id(db: Session) -> int:
    ctx = get_tenant()
    row = db.scalar(
        select(Location)
        .where(Location.co_id == ctx.co_id, Location.deleted_at.is_(None))
        .order_by(Location.location_id.asc())
        .limit(1)
    )
    if not row:
        raise MasterError("No active location found. Create at least one location in m_locations.")
    return row.location_id


def resolve_location_id(db: Session, location_id: int | None) -> int:
    if location_id is None:
        return get_default_location_id(db)
    ctx = get_tenant()
    row = db.scalar(
        select(Location).where(Location.location_id == location_id, Location.co_id == ctx.co_id)
    )
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
    ctx = get_tenant()
    if location_id is not None:
        row = db.scalar(
            select(Location).where(Location.location_id == location_id, Location.co_id == ctx.co_id)
        )
        if row and row.deleted_at is None:
            return row
        raise MasterError(f"Location id {location_id} not found.")

    if location_cd is not None and str(location_cd).strip():
        code = str(location_cd).strip()
        row = db.scalar(
            select(Location).where(
                Location.co_id == ctx.co_id,
                Location.location_cd == code,
                Location.deleted_at.is_(None),
            )
        )
        if row:
            return row
        raise MasterError(f"Location code '{code}' not found.")

    if location_nm is not None and str(location_nm).strip():
        name = str(location_nm).strip()
        row = db.scalar(
            select(Location)
            .where(
                Location.co_id == ctx.co_id,
                Location.location_nm == name,
                Location.deleted_at.is_(None),
            )
            .limit(1)
        )
        if row:
            return row
        raise MasterError(f"Location name '{name}' not found.")

    row = db.scalar(
        select(Location)
        .where(Location.co_id == ctx.co_id, Location.deleted_at.is_(None))
        .order_by(Location.location_id.asc())
        .limit(1)
    )
    if row:
        return row
    raise MasterError("No active location found. Create at least one location in m_locations.")


def _normalize_item_cd(item_cd: str) -> str:
    return item_cd.strip()


def _validate_item_cd_unique(
    db: Session, item_cd: str, *, exclude_item_id: int | None = None
) -> None:
    ctx = get_tenant()
    code = _normalize_item_cd(item_cd)
    stmt = select(Item.item_id).where(
        Item.co_id == ctx.co_id,
        Item.item_cd == code,
        Item.deleted_at.is_(None),
    )
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
    ctx = get_tenant()
    if item_id is not None:
        row = db.scalar(select(Item).where(Item.item_id == item_id, Item.co_id == ctx.co_id))
        if row and row.deleted_at is None:
            return row
        raise MasterError(f"Item id {item_id} not found.")

    if item_cd is not None and str(item_cd).strip():
        code = _normalize_item_cd(str(item_cd))
        row = db.scalar(
            select(Item).where(
                Item.co_id == ctx.co_id,
                Item.item_cd == code,
                Item.deleted_at.is_(None),
            )
        )
        if row:
            return row
        raise MasterError(f"Item code '{code}' not found.")

    if item_nm is not None and str(item_nm).strip():
        name = str(item_nm).strip()
        row = db.scalar(
            select(Item)
            .where(Item.co_id == ctx.co_id, Item.item_nm == name, Item.deleted_at.is_(None))
            .limit(1)
        )
        if row:
            return row
        raise MasterError(f"Item name '{name}' not found.")

    raise MasterError("item_id, item_cd, or item_nm is required.")


def search_items(db: Session, q: str, *, limit: int = 20) -> list[ItemSearchOut]:
    ctx = get_tenant()
    term = q.strip()
    if not term:
        return []
    pattern = f"%{term}%"
    stmt = (
        select(Item, ItemTyp.itemtyp_nm)
        .outerjoin(ItemTyp, ItemTyp.itemtyp_id == Item.itemtyp_id)
        .where(
            Item.co_id == ctx.co_id,
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
    ctx = get_tenant()
    if payload.itemtyp_id is not None:
        itemtyp = db.scalar(
            select(ItemTyp).where(
                ItemTyp.itemtyp_id == payload.itemtyp_id,
                ItemTyp.co_id == ctx.co_id,
            )
        )
        if not itemtyp or itemtyp.deleted_at is not None:
            raise MasterError("Item type not found.")
    for sid in (
        payload.supplier1_id,
        payload.supplier2_id,
        payload.supplier3_id,
    ):
        if sid is None:
            continue
        supplier = db.scalar(
            select(Supplier).where(Supplier.suppliers_id == sid, Supplier.co_id == ctx.co_id)
        )
        if not supplier or supplier.deleted_at is not None:
            raise MasterError(f"Supplier {sid} not found.")
    for cid in (payload.customer1_id, payload.customer2_id):
        if cid is None:
            continue
        customer = db.scalar(
            select(Customer).where(Customer.customers_id == cid, Customer.co_id == ctx.co_id)
        )
        if not customer or customer.deleted_at is not None:
            raise MasterError(f"Customer {cid} not found.")


def list_items(db: Session) -> list[ItemListOut]:
    ctx = get_tenant()
    s1 = Supplier.__table__.alias("s1")
    c1 = Customer.__table__.alias("c1")
    c2 = Customer.__table__.alias("c2")
    stmt = (
        select(Item, ItemTyp.itemtyp_nm, s1.c.suppliers_nm, c1.c.customers_nm, c2.c.customers_nm)
        .outerjoin(ItemTyp, ItemTyp.itemtyp_id == Item.itemtyp_id)
        .outerjoin(s1, s1.c.suppliers_id == Item.supplier1_id)
        .outerjoin(c1, c1.c.customers_id == Item.customer1_id)
        .outerjoin(c2, c2.c.customers_id == Item.customer2_id)
        .where(Item.co_id == ctx.co_id, Item.deleted_at.is_(None))
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
            supplier2_id=item.supplier2_id,
            supplier3_id=item.supplier3_id,
            customer1_id=item.customer1_id,
            customer1_nm=customer1_nm,
            customer2_id=item.customer2_id,
            customer2_nm=customer2_nm,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item, itemtyp_nm, supplier1_nm, customer1_nm, customer2_nm in rows
    ]


def get_item(db: Session, item_id: int) -> ItemDetailOut:
    ctx = get_tenant()
    row = db.scalar(select(Item).where(Item.item_id == item_id, Item.co_id == ctx.co_id))
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
        customer1_id=row.customer1_id,
        customer2_id=row.customer2_id,
    )


def create_item(db: Session, payload: ItemCreate) -> ItemDetailOut:
    ctx = get_tenant()
    _validate_item_refs(db, payload)
    _validate_item_cd_unique(db, payload.item_cd)
    row = Item(
        item_cd=_normalize_item_cd(payload.item_cd),
        item_nm=payload.item_nm.strip(),
        itemtyp_id=payload.itemtyp_id,
        supplier1_id=payload.supplier1_id,
        supplier2_id=payload.supplier2_id,
        supplier3_id=payload.supplier3_id,
        customer1_id=payload.customer1_id,
        customer2_id=payload.customer2_id,
    )
    stamp_new(row, ctx)
    db.add(row)
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError("Item code already exists.") from e
    return get_item(db, row.item_id)


def update_item(db: Session, item_id: int, payload: ItemUpdate) -> ItemDetailOut:
    ctx = get_tenant()
    row = db.scalar(select(Item).where(Item.item_id == item_id, Item.co_id == ctx.co_id))
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
    row.customer1_id = payload.customer1_id
    row.customer2_id = payload.customer2_id
    stamp_update(row, ctx)
    db.flush()
    return get_item(db, item_id)


def delete_item(db: Session, item_id: int) -> None:
    ctx = get_tenant()
    row = db.scalar(select(Item).where(Item.item_id == item_id, Item.co_id == ctx.co_id))
    if not row or row.deleted_at is not None:
        raise MasterError("Item not found.")
    _soft_delete(row, ctx)
