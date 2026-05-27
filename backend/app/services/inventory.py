from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inventory import InvCurrent, InvGrgi, MoveTyp
from app.services.masters import resolve_location_id


class InventoryError(Exception):
    pass


def _get_movetyp(db: Session, name: str) -> MoveTyp:
    row = db.scalar(
        select(MoveTyp).where(MoveTyp.movetyps_nm == name, MoveTyp.deleted_at.is_(None))
    )
    if not row:
        raise InventoryError(f"Movement type '{name}' not found.")
    return row


def apply_movement(
    db: Session,
    *,
    item_id: int,
    location_id: int,
    lot: str,
    move_qty: Decimal,
    movetyps_nm: str,
    actual_at: datetime,
    inv_receipt_draft_id: int | None = None,
) -> InvGrgi:
    """
    Record inventory movement in inv_grgi and update inv_currents.
    move_qty: positive for GR, negative for reversal/cancel.
    movetyps_nm: GR, GI, or CAN
    """
    movetyp = _get_movetyp(db, movetyps_nm)
    move_qty = Decimal(move_qty)

    current = db.scalar(
        select(InvCurrent)
        .where(
            InvCurrent.item_id == item_id,
            InvCurrent.location_id == location_id,
            InvCurrent.lot == lot,
            InvCurrent.deleted_at.is_(None),
        )
        .with_for_update()
    )
    current_qty = Decimal(current.qty) if current else Decimal("0")

    if movetyps_nm == "GI":
        stored_move_qty = abs(move_qty)
        new_qty = current_qty - stored_move_qty
    else:
        # GR: positive move_qty; CAN (cancel): negative move_qty
        stored_move_qty = move_qty
        new_qty = current_qty + move_qty

    if new_qty < 0:
        raise InventoryError(
            f"Insufficient stock for lot '{lot}' (item_id={item_id}, location_id={location_id})."
        )

    if current:
        current.qty = new_qty
    else:
        if move_qty <= 0:
            raise InventoryError(f"No stock record for lot '{lot}' at location_id={location_id}.")
        now = datetime.now()
        db.add(
            InvCurrent(
                item_id=item_id,
                location_id=location_id,
                qty=new_qty,
                lot=lot,
                created_at=now,
                updated_at=now,
            )
        )

    now = datetime.now()
    grgi = InvGrgi(
        item_id=item_id,
        location_id=location_id,
        qty=new_qty,
        lot=lot,
        move_qty=stored_move_qty if movetyps_nm == "GI" else move_qty,
        movetyps_id=movetyp.movetyps_id,
        inv_receipt_draft_id=inv_receipt_draft_id,
        actual_at=actual_at,
        created_at=now,
        updated_at=now,
    )
    db.add(grgi)
    db.flush()
    return grgi


def apply_gr(
    db: Session,
    *,
    item_id: int,
    location_id: int,
    lot: str,
    qty: Decimal,
    actual_at: datetime,
    inv_receipt_draft_id: int | None = None,
) -> InvGrgi:
    return apply_movement(
        db,
        item_id=item_id,
        location_id=location_id,
        lot=lot,
        move_qty=Decimal(qty),
        movetyps_nm="GR",
        actual_at=actual_at,
        inv_receipt_draft_id=inv_receipt_draft_id,
    )


def apply_movement_by_movetyp_id(
    db: Session,
    *,
    item_id: int,
    location_id: int,
    lot: str,
    move_qty: Decimal,
    movetyps_id: int,
    actual_at: datetime,
) -> InvGrgi:
    movetyp = db.get(MoveTyp, movetyps_id)
    if not movetyp or movetyp.deleted_at is not None:
        raise InventoryError("Movement type not found.")
    if movetyp.movetyps_nm not in ("GR", "GI"):
        raise InventoryError(f"Manual entry not allowed for movement type '{movetyp.movetyps_nm}'.")
    return apply_movement(
        db,
        item_id=item_id,
        location_id=resolve_location_id(db, location_id),
        lot=lot,
        move_qty=Decimal(move_qty),
        movetyps_nm=movetyp.movetyps_nm,
        actual_at=actual_at,
    )


def apply_cancel_reversal(
    db: Session,
    *,
    item_id: int,
    location_id: int,
    lot: str,
    qty: Decimal,
    actual_at: datetime,
    inv_receipt_draft_id: int | None = None,
) -> InvGrgi:
    """Cancel approved receipt: record negative qty in inv_grgi."""
    return apply_movement(
        db,
        item_id=item_id,
        location_id=location_id,
        lot=lot,
        move_qty=-Decimal(qty),
        movetyps_nm="CAN",
        actual_at=actual_at,
        inv_receipt_draft_id=inv_receipt_draft_id,
    )


def apply_location_move(
    db: Session,
    *,
    item_id: int,
    from_location_id: int,
    to_location_id: int,
    lot: str,
    qty: Decimal,
    actual_at: datetime,
) -> tuple[InvGrgi, InvGrgi]:
    if from_location_id == to_location_id:
        raise InventoryError("from_location_id and to_location_id must be different.")
    resolved_from = resolve_location_id(db, from_location_id)
    resolved_to = resolve_location_id(db, to_location_id)
    out_row = apply_movement(
        db,
        item_id=item_id,
        location_id=resolved_from,
        lot=lot,
        move_qty=-Decimal(qty),
        movetyps_nm="MV",
        actual_at=actual_at,
    )
    in_row = apply_movement(
        db,
        item_id=item_id,
        location_id=resolved_to,
        lot=lot,
        move_qty=Decimal(qty),
        movetyps_nm="MV",
        actual_at=actual_at,
    )
    return out_row, in_row
