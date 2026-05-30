"""Master data CRUD (soft delete)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.inventory import MoveTyp
from app.models.masters import Customer, Item, ItemTyp, Location, Supplier
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
    LocationCreate,
    LocationOut,
    ItemTypUpdate,
    MoveTypUpdate,
    LocationUpdate,
    SupplierUpdate,
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
    row = ItemTyp(
        itemtyp_cd=payload.itemtyp_cd.strip(),
        itemtyp_nm=payload.itemtyp_nm.strip(),
        itemtyp_color=payload.itemtyp_color,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.flush()
    return ItemTypOut.model_validate(row)


def delete_itemtyp(db: Session, itemtyp_id: int) -> None:
    row = db.get(ItemTyp, itemtyp_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Item type not found.")
    _soft_delete(row)


def update_itemtyp(db: Session, itemtyp_id: int, payload: ItemTypUpdate) -> ItemTypOut:
    row = db.get(ItemTyp, itemtyp_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Item type not found.")
    row.itemtyp_cd = payload.itemtyp_cd.strip()
    row.itemtyp_nm = payload.itemtyp_nm.strip()
    row.itemtyp_color = payload.itemtyp_color
    row.updated_at = _now()
    db.flush()
    return ItemTypOut.model_validate(row)


def list_suppliers(db: Session) -> list[SupplierOut]:
    rows = db.scalars(
        select(Supplier).where(Supplier.deleted_at.is_(None)).order_by(Supplier.suppliers_id)
    ).all()
    return [SupplierOut.model_validate(r) for r in rows]


def create_supplier(db: Session, payload: SupplierCreate) -> SupplierOut:
    now = _now()
    row = Supplier(
        suppliers_cd=payload.suppliers_cd.strip(),
        suppliers_nm=payload.suppliers_nm.strip(),
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError("Supplier code already exists.") from e
    return SupplierOut.model_validate(row)


def delete_supplier(db: Session, suppliers_id: int) -> None:
    row = db.get(Supplier, suppliers_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Supplier not found.")
    _soft_delete(row)


def update_supplier(db: Session, suppliers_id: int, payload: SupplierUpdate) -> SupplierOut:
    row = db.get(Supplier, suppliers_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Supplier not found.")
    row.suppliers_cd = payload.suppliers_cd.strip()
    row.suppliers_nm = payload.suppliers_nm.strip()
    row.updated_at = _now()
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError("Supplier code already exists.") from e
    return SupplierOut.model_validate(row)


def list_customers(db: Session) -> list[CustomerOut]:
    rows = db.scalars(
        select(Customer).where(Customer.deleted_at.is_(None)).order_by(Customer.customers_id)
    ).all()
    return [CustomerOut.model_validate(r) for r in rows]


def create_customer(db: Session, payload: CustomerCreate) -> CustomerOut:
    now = _now()
    row = Customer(
        customers_cd=payload.customers_cd.strip(),
        customers_nm=payload.customers_nm.strip(),
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError("Customer code already exists.") from e
    return CustomerOut.model_validate(row)


def delete_customer(db: Session, customers_id: int) -> None:
    row = db.get(Customer, customers_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Customer not found.")
    _soft_delete(row)


def update_customer(db: Session, customers_id: int, payload: CustomerUpdate) -> CustomerOut:
    row = db.get(Customer, customers_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Customer not found.")
    row.customers_cd = payload.customers_cd.strip()
    row.customers_nm = payload.customers_nm.strip()
    row.updated_at = _now()
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError("Customer code already exists.") from e
    return CustomerOut.model_validate(row)


def list_movetyps(db: Session) -> list[MoveTypMasterOut]:
    rows = db.scalars(
        select(MoveTyp).where(MoveTyp.deleted_at.is_(None)).order_by(MoveTyp.movetyps_id)
    ).all()
    return [MoveTypMasterOut.model_validate(r) for r in rows]


def create_movetyp(db: Session, payload: MoveTypCreate) -> MoveTypMasterOut:
    now = _now()
    row = MoveTyp(
        movetyps_cd=payload.movetyps_cd.strip(),
        movetyps_nm=(payload.movetyps_nm or "").strip() or None,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as e:
        raise MasterError("Move type code already exists.") from e
    return MoveTypMasterOut.model_validate(row)


def delete_movetyp(db: Session, movetyps_id: int) -> None:
    row = db.get(MoveTyp, movetyps_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Move type not found.")
    _soft_delete(row)


def update_movetyp(db: Session, movetyps_id: int, payload: MoveTypUpdate) -> MoveTypMasterOut:
    row = db.get(MoveTyp, movetyps_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Move type not found.")
    row.movetyps_cd = payload.movetyps_cd.strip()
    row.movetyps_nm = (payload.movetyps_nm or "").strip() or None
    row.updated_at = _now()
    db.flush()
    return MoveTypMasterOut.model_validate(row)


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
        location_type=payload.location_type,
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
    row.location_type = payload.location_type
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
    ):
        if sid is None:
            continue
        supplier = db.get(Supplier, sid)
        if not supplier or supplier.deleted_at is not None:
            raise MasterError(f"Supplier {sid} not found.")
    for cid in (payload.customer1_id, payload.customer2_id):
        if cid is None:
            continue
        customer = db.get(Customer, cid)
        if not customer or customer.deleted_at is not None:
            raise MasterError(f"Customer {cid} not found.")


def list_items(db: Session) -> list[ItemListOut]:
    s1 = Supplier.__table__.alias("s1")
    c1 = Customer.__table__.alias("c1")
    c2 = Customer.__table__.alias("c2")
    stmt = (
        select(Item, ItemTyp.itemtyp_nm, s1.c.suppliers_nm, c1.c.customers_nm, c2.c.customers_nm)
        .join(ItemTyp, ItemTyp.itemtyp_id == Item.itemtyp_id)
        .outerjoin(s1, s1.c.suppliers_id == Item.supplier1_id)
        .outerjoin(c1, c1.c.customers_id == Item.customer1_id)
        .outerjoin(c2, c2.c.customers_id == Item.customer2_id)
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
            supplier2_id=item.supplier2_id,
            supplier3_id=item.supplier3_id,
            customer1_id=item.customer1_id,
            customer1_nm=customer1_nm,
            customer2_id=item.customer2_id,
            customer2_nm=customer2_nm,
        )
        for item, itemtyp_nm, supplier1_nm, customer1_nm, customer2_nm in rows
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
        customer1_id=row.customer1_id,
        customer2_id=row.customer2_id,
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
        customer1_id=payload.customer1_id,
        customer2_id=payload.customer2_id,
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
    row.customer1_id = payload.customer1_id
    row.customer2_id = payload.customer2_id
    row.updated_at = _now()
    db.flush()
    return get_item(db, item_id)


def delete_item(db: Session, item_id: int) -> None:
    row = db.get(Item, item_id)
    if not row or row.deleted_at is not None:
        raise MasterError("Item not found.")
    _soft_delete(row)
