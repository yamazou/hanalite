from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.boms import Bom
from app.models.masters import Item, ItemProc, Location
from app.models.production import (
    ProductionOrder,
    ProductionOrderInput,
    ProductionOrderLine,
    ProductionOrderOutput,
)
from app.schemas.production import (
    ProductionOrderCreate,
    ProductionOrderInputRead,
    ProductionOrderInputWrite,
    ProductionOrderLineRead,
    ProductionOrderListItem,
    ProductionOrderRead,
    ProductionOrderRecalculateIn,
    ProductionOrderUpdate,
    ProductionOrderOutputRead,
)
from app.services.inventory import InventoryError, apply_movement
from app.services.masters import MasterError


class ProductionError(Exception):
    pass


def _now() -> datetime:
    return datetime.now()


def _active_order_or_error(db: Session, order_id: int) -> ProductionOrder:
    row = db.get(ProductionOrder, order_id)
    if not row or row.deleted_at is not None:
        raise ProductionError("Production order not found.")
    return row


def _get_item_or_error(db: Session, item_id: int) -> Item:
    item = db.get(Item, item_id)
    if not item or item.deleted_at is not None:
        raise ProductionError(f"Item {item_id} not found.")
    return item


def _get_location_or_error(db: Session, location_id: int) -> Location:
    location = db.get(Location, location_id)
    if not location or location.deleted_at is not None:
        raise ProductionError(f"Location {location_id} not found.")
    return location


def _get_itemproc_or_error(db: Session, itemproc_id: int) -> ItemProc:
    row = db.get(ItemProc, itemproc_id)
    if not row or row.deleted_at is not None:
        raise ProductionError(f"Item process {itemproc_id} not found.")
    return row


def _order_lines(db: Session, order_id: int) -> list[ProductionOrderLine]:
    return list(
        db.scalars(
            select(ProductionOrderLine)
            .where(
                ProductionOrderLine.production_order_id == order_id,
                ProductionOrderLine.deleted_at.is_(None),
            )
            .order_by(ProductionOrderLine.line_no.asc(), ProductionOrderLine.prd_order_line_id.asc())
        ).all()
    )


def _line_read(db: Session, line: ProductionOrderLine) -> ProductionOrderLineRead:
    proc = _get_itemproc_or_error(db, line.itemproc_id)
    rm = _get_location_or_error(db, line.rm_location_id)
    wip = _get_location_or_error(db, line.wip_location_id)
    return ProductionOrderLineRead(
        prd_order_line_id=line.prd_order_line_id,
        line_no=line.line_no,
        itemproc_id=line.itemproc_id,
        process_no=proc.process_no,
        process_nm=proc.process_nm,
        rm_location_id=rm.location_id,
        rm_location_cd=rm.location_cd,
        wip_location_id=wip.location_id,
        wip_location_cd=wip.location_cd,
        status=line.status,  # type: ignore[arg-type]
        actual_qty=line.actual_qty,
        completed_at=line.completed_at,
    )


def _expand_inputs_from_bom(
    db: Session,
    *,
    parent_item_id: int,
    basis_qty: Decimal,
    lot: str | None,
) -> list[ProductionOrderInputWrite]:
    rows = db.scalars(
        select(Bom)
        .where(
            Bom.p_item_id == parent_item_id,
            Bom.deleted_at.is_(None),
        )
        .order_by(Bom.bom_id.asc())
    ).all()
    if not rows:
        raise ProductionError("No active BOM rows found for selected parent item.")
    inputs: list[ProductionOrderInputWrite] = []
    for idx, bom in enumerate(rows, start=1):
        req_qty = Decimal(bom.c_req_qty)
        inputs.append(
            ProductionOrderInputWrite(
                line_no=idx,
                item_id=bom.c_item_id,
                req_qty=req_qty,
                consume_qty=(req_qty * Decimal(basis_qty)),
                lot=lot,
            )
        )
    return inputs


def _replace_inputs(db: Session, order: ProductionOrder, inputs: list[ProductionOrderInputWrite]) -> None:
    now = _now()
    existing = db.scalars(
        select(ProductionOrderInput).where(
            ProductionOrderInput.production_order_id == order.production_order_id,
            ProductionOrderInput.deleted_at.is_(None),
        )
    ).all()
    for row in existing:
        row.deleted_at = now
        row.updated_at = now

    for idx, line in enumerate(inputs, start=1):
        _get_item_or_error(db, line.item_id)
        db.add(
            ProductionOrderInput(
                production_order_id=order.production_order_id,
                line_no=line.line_no or idx,
                item_id=line.item_id,
                req_qty=Decimal(line.req_qty),
                consume_qty=Decimal(line.consume_qty),
                lot=(line.lot.strip() if line.lot else None),
                created_at=now,
                updated_at=now,
            )
        )
    db.flush()


def _create_lines_from_itemprocs(db: Session, order: ProductionOrder, parent_item_id: int) -> list[ProductionOrderLine]:
    procs = db.scalars(
        select(ItemProc)
        .where(
            ItemProc.item_id == parent_item_id,
            ItemProc.deleted_at.is_(None),
        )
        .order_by(ItemProc.process_no.asc(), ItemProc.itemproc_id.asc())
    ).all()
    if not procs:
        raise ProductionError("No item process rows found for selected FG item.")
    now = _now()
    lines: list[ProductionOrderLine] = []
    for idx, proc in enumerate(procs, start=1):
        _get_location_or_error(db, proc.rm_location_id)
        _get_location_or_error(db, proc.wip_location_id)
        line = ProductionOrderLine(
            production_order_id=order.production_order_id,
            line_no=idx,
            itemproc_id=proc.itemproc_id,
            rm_location_id=proc.rm_location_id,
            wip_location_id=proc.wip_location_id,
            status="planned",
            created_at=now,
            updated_at=now,
        )
        db.add(line)
        lines.append(line)
    db.flush()
    return lines


def _line_counts(db: Session, order_id: int) -> tuple[int, int]:
    total = db.scalar(
        select(func.count())
        .select_from(ProductionOrderLine)
        .where(
            ProductionOrderLine.production_order_id == order_id,
            ProductionOrderLine.deleted_at.is_(None),
        )
    )
    done = db.scalar(
        select(func.count())
        .select_from(ProductionOrderLine)
        .where(
            ProductionOrderLine.production_order_id == order_id,
            ProductionOrderLine.deleted_at.is_(None),
            ProductionOrderLine.status == "completed",
        )
    )
    return int(total or 0), int(done or 0)


def _to_list_item(db: Session, row: ProductionOrder) -> ProductionOrderListItem:
    parent = _get_item_or_error(db, row.parent_item_id)
    line_count, completed_line_count = _line_counts(db, row.production_order_id)
    return ProductionOrderListItem(
        production_order_id=row.production_order_id,
        status=row.status,  # type: ignore[arg-type]
        parent_item_id=parent.item_id,
        parent_item_cd=parent.item_cd,
        parent_item_nm=parent.item_nm,
        planned_qty=row.planned_qty,
        actual_qty=row.actual_qty,
        lot=row.lot,
        line_count=line_count,
        completed_line_count=completed_line_count,
        created_at=row.created_at,
        approved_at=row.approved_at,
        cancelled_at=row.cancelled_at,
    )


def list_orders(db: Session, *, status: str | None = None) -> list[ProductionOrderListItem]:
    stmt = (
        select(ProductionOrder)
        .where(ProductionOrder.deleted_at.is_(None))
        .order_by(ProductionOrder.production_order_id.desc())
    )
    if status:
        stmt = stmt.where(ProductionOrder.status == status)
    rows = db.scalars(stmt).all()
    return [_to_list_item(db, row) for row in rows]


def get_order(db: Session, order_id: int) -> ProductionOrderRead:
    row = _active_order_or_error(db, order_id)
    base = _to_list_item(db, row)
    lines_raw = _order_lines(db, order_id)

    inputs_raw = db.scalars(
        select(ProductionOrderInput)
        .where(
            ProductionOrderInput.production_order_id == order_id,
            ProductionOrderInput.deleted_at.is_(None),
        )
        .order_by(ProductionOrderInput.line_no.asc(), ProductionOrderInput.prd_order_input_id.asc())
    ).all()
    outputs_raw = db.scalars(
        select(ProductionOrderOutput)
        .where(
            ProductionOrderOutput.production_order_id == order_id,
            ProductionOrderOutput.deleted_at.is_(None),
        )
        .order_by(ProductionOrderOutput.line_no.asc(), ProductionOrderOutput.prd_order_output_id.asc())
    ).all()

    lines = [_line_read(db, ln) for ln in lines_raw]
    inputs = [
        ProductionOrderInputRead(
            prd_order_input_id=ln.prd_order_input_id,
            line_no=ln.line_no,
            item_id=ln.item_id,
            item_cd=_get_item_or_error(db, ln.item_id).item_cd,
            item_nm=_get_item_or_error(db, ln.item_id).item_nm,
            req_qty=ln.req_qty,
            consume_qty=ln.consume_qty,
            lot=ln.lot,
        )
        for ln in inputs_raw
    ]
    outputs = [
        ProductionOrderOutputRead(
            prd_order_output_id=ln.prd_order_output_id,
            prd_order_line_id=ln.prd_order_line_id,
            line_no=ln.line_no,
            item_id=ln.item_id,
            item_cd=_get_item_or_error(db, ln.item_id).item_cd,
            item_nm=_get_item_or_error(db, ln.item_id).item_nm,
            output_qty=ln.output_qty,
            location_id=ln.location_id,
            location_cd=_get_location_or_error(db, ln.location_id).location_cd,
            location_nm=_get_location_or_error(db, ln.location_id).location_nm,
            lot=ln.lot,
        )
        for ln in outputs_raw
    ]

    return ProductionOrderRead(
        **base.model_dump(),
        notes=row.notes,
        updated_at=row.updated_at,
        lines=lines,
        inputs=inputs,
        outputs=outputs,
    )


def create_order(db: Session, payload: ProductionOrderCreate) -> ProductionOrderRead:
    _get_item_or_error(db, payload.parent_item_id)
    active = db.scalar(
        select(ProductionOrder).where(
            ProductionOrder.parent_item_id == payload.parent_item_id,
            ProductionOrder.deleted_at.is_(None),
            ProductionOrder.status.in_(("registered", "approved")),
        )
    )
    if active:
        raise ProductionError("Only one open production order is allowed per FG item.")
    now = _now()
    row = ProductionOrder(
        status="registered",
        parent_item_id=payload.parent_item_id,
        planned_qty=Decimal(payload.planned_qty),
        actual_qty=None,
        lot=payload.lot.strip(),
        notes=(payload.notes.strip() if payload.notes else None),
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.flush()

    _create_lines_from_itemprocs(db, row, payload.parent_item_id)

    expanded = _expand_inputs_from_bom(
        db,
        parent_item_id=payload.parent_item_id,
        basis_qty=Decimal(payload.planned_qty),
        lot=row.lot,
    )
    _replace_inputs(db, row, expanded)
    return get_order(db, row.production_order_id)


def update_order(db: Session, order_id: int, payload: ProductionOrderUpdate) -> ProductionOrderRead:
    row = _active_order_or_error(db, order_id)
    if row.status != "registered":
        raise ProductionError("Only registered orders can be edited.")

    if payload.planned_qty is not None:
        row.planned_qty = Decimal(payload.planned_qty)
    if payload.actual_qty is not None:
        row.actual_qty = Decimal(payload.actual_qty)
    if payload.lot is not None:
        row.lot = payload.lot.strip()
    if payload.notes is not None:
        row.notes = payload.notes.strip() or None
    if payload.status is not None:
        row.status = payload.status
    row.updated_at = _now()

    if payload.inputs is not None:
        _replace_inputs(db, row, payload.inputs)

    db.flush()
    return get_order(db, order_id)


def recalculate_inputs(
    db: Session, order_id: int, payload: ProductionOrderRecalculateIn
) -> ProductionOrderRead:
    row = _active_order_or_error(db, order_id)
    if row.status != "registered":
        raise ProductionError("Only registered orders can be recalculated.")
    lines = _order_lines(db, order_id)
    if any(ln.status == "completed" for ln in lines):
        raise ProductionError("Cannot recalculate after a process step is completed.")
    basis = Decimal(payload.basis_qty)
    row.updated_at = _now()

    current_inputs = db.scalars(
        select(ProductionOrderInput).where(
            ProductionOrderInput.production_order_id == order_id,
            ProductionOrderInput.deleted_at.is_(None),
        )
    ).all()

    if current_inputs:
        next_inputs = [
            ProductionOrderInputWrite(
                item_id=ln.item_id,
                req_qty=Decimal(ln.req_qty),
                consume_qty=Decimal(ln.req_qty) * basis,
                lot=ln.lot or row.lot,
                line_no=ln.line_no,
            )
            for ln in current_inputs
        ]
    else:
        next_inputs = _expand_inputs_from_bom(
            db,
            parent_item_id=row.parent_item_id,
            basis_qty=basis,
            lot=row.lot,
        )
    _replace_inputs(db, row, next_inputs)
    return get_order(db, order_id)


def _first_pending_line(lines: list[ProductionOrderLine]) -> ProductionOrderLine:
    for ln in lines:
        if ln.status != "completed":
            return ln
    raise ProductionError("All process steps are already completed.")


def complete_line(
    db: Session, order_id: int, line_id: int, *, actual_qty: Decimal
) -> ProductionOrderRead:
    row = _active_order_or_error(db, order_id)
    if row.status == "cancelled":
        raise ProductionError("Cancelled order cannot be posted.")
    if row.status == "approved":
        raise ProductionError("Approved order cannot be posted.")
    if row.status != "registered":
        raise ProductionError("Only registered orders can post process steps.")

    lines = _order_lines(db, order_id)
    if not lines:
        raise ProductionError("No process lines found.")

    line = next((ln for ln in lines if ln.prd_order_line_id == line_id), None)
    if not line:
        raise ProductionError("Process line not found.")
    if line.status == "completed":
        raise ProductionError("This process step is already completed.")

    pending = _first_pending_line(lines)
    if pending.prd_order_line_id != line.prd_order_line_id:
        raise ProductionError(
            f"Complete process step {pending.line_no} (P{_get_itemproc_or_error(db, pending.itemproc_id).process_no}) first."
        )

    is_first = line.line_no == lines[0].line_no
    qty = Decimal(actual_qty)
    now = _now()

    inputs = db.scalars(
        select(ProductionOrderInput)
        .where(
            ProductionOrderInput.production_order_id == order_id,
            ProductionOrderInput.deleted_at.is_(None),
        )
        .order_by(ProductionOrderInput.line_no.asc())
    ).all()

    try:
        if is_first:
            if not inputs:
                raise ProductionError("No RM input lines found.")
            for ln in inputs:
                if Decimal(ln.consume_qty) <= 0:
                    raise ProductionError("Input consume quantity must be > 0.")
                apply_movement(
                    db,
                    item_id=ln.item_id,
                    location_id=line.rm_location_id,
                    lot=(ln.lot or row.lot),
                    move_qty=Decimal(ln.consume_qty),
                    movetyps_nm="GI",
                    actual_at=now,
                )
        else:
            apply_movement(
                db,
                item_id=row.parent_item_id,
                location_id=line.rm_location_id,
                lot=row.lot,
                move_qty=qty,
                movetyps_nm="GI",
                actual_at=now,
            )

        apply_movement(
            db,
            item_id=row.parent_item_id,
            location_id=line.wip_location_id,
            lot=row.lot,
            move_qty=qty,
            movetyps_nm="GR",
            actual_at=now,
        )
    except (InventoryError, MasterError) as e:
        raise ProductionError(str(e)) from e

    line.status = "completed"
    line.actual_qty = qty
    line.completed_at = now
    line.updated_at = now

    out_line_no = (
        db.scalar(
            select(func.max(ProductionOrderOutput.line_no)).where(
                ProductionOrderOutput.production_order_id == order_id,
                ProductionOrderOutput.deleted_at.is_(None),
            )
        )
        or 0
    )
    db.add(
        ProductionOrderOutput(
            production_order_id=row.production_order_id,
            prd_order_line_id=line.prd_order_line_id,
            line_no=int(out_line_no) + 1,
            item_id=row.parent_item_id,
            output_qty=qty,
            location_id=line.wip_location_id,
            lot=row.lot,
            created_at=now,
            updated_at=now,
        )
    )

    row.updated_at = now
    db.flush()
    return get_order(db, order_id)


def complete_order(db: Session, order_id: int, *, actual_qty: Decimal) -> ProductionOrderRead:
    """Complete the next pending process step (backward-compatible shortcut)."""
    lines = _order_lines(db, order_id)
    pending = _first_pending_line(lines)
    return complete_line(db, order_id, pending.prd_order_line_id, actual_qty=actual_qty)


def _reverse_line_inventory(
    db: Session,
    *,
    order: ProductionOrder,
    line: ProductionOrderLine,
    lines: list[ProductionOrderLine],
    inputs: list[ProductionOrderInput],
    actual_at: datetime,
) -> None:
    is_first = line.line_no == lines[0].line_no
    qty = Decimal(line.actual_qty or order.planned_qty)

    apply_movement(
        db,
        item_id=order.parent_item_id,
        location_id=line.wip_location_id,
        lot=order.lot,
        move_qty=qty,
        movetyps_nm="GI",
        actual_at=actual_at,
    )
    if not is_first:
        apply_movement(
            db,
            item_id=order.parent_item_id,
            location_id=line.rm_location_id,
            lot=order.lot,
            move_qty=qty,
            movetyps_nm="GR",
            actual_at=actual_at,
        )
    if is_first:
        for ln in inputs:
            apply_movement(
                db,
                item_id=ln.item_id,
                location_id=line.rm_location_id,
                lot=(ln.lot or order.lot),
                move_qty=Decimal(ln.consume_qty),
                movetyps_nm="GR",
                actual_at=actual_at,
            )


def _reverse_all_posted_steps(db: Session, order: ProductionOrder, *, actual_at: datetime) -> None:
    lines = _order_lines(db, order.production_order_id)
    completed = [ln for ln in lines if ln.status == "completed"]
    if not completed:
        return

    inputs = list(
        db.scalars(
            select(ProductionOrderInput).where(
                ProductionOrderInput.production_order_id == order.production_order_id,
                ProductionOrderInput.deleted_at.is_(None),
            )
        ).all()
    )

    try:
        for line in sorted(completed, key=lambda ln: ln.line_no, reverse=True):
            _reverse_line_inventory(
                db,
                order=order,
                line=line,
                lines=lines,
                inputs=inputs,
                actual_at=actual_at,
            )
    except (InventoryError, MasterError) as e:
        raise ProductionError(str(e)) from e

    now = _now()
    outputs = db.scalars(
        select(ProductionOrderOutput).where(
            ProductionOrderOutput.production_order_id == order.production_order_id,
            ProductionOrderOutput.deleted_at.is_(None),
        )
    ).all()
    for out in outputs:
        out.deleted_at = now
        out.updated_at = now

    for line in completed:
        line.status = "planned"
        line.actual_qty = None
        line.completed_at = None
        line.updated_at = now


def approve_order(db: Session, order_id: int) -> ProductionOrderRead:
    row = _active_order_or_error(db, order_id)
    if row.status != "registered":
        raise ProductionError(f"Order must be 'registered' to approve (current: {row.status}).")

    lines = _order_lines(db, order_id)
    if not lines:
        raise ProductionError("Cannot approve: no process lines.")
    if any(ln.status != "completed" for ln in lines):
        raise ProductionError("All process steps must be posted before approve.")

    now = _now()
    last = lines[-1]
    row.status = "approved"
    row.approved_at = now
    row.actual_qty = last.actual_qty or row.planned_qty
    row.updated_at = now
    db.flush()
    return get_order(db, order_id)


def cancel_order(db: Session, order_id: int) -> ProductionOrderRead:
    row = _active_order_or_error(db, order_id)
    if row.status == "cancelled":
        raise ProductionError("Order is already cancelled.")

    now = _now()
    if row.status == "approved":
        _reverse_all_posted_steps(db, row, actual_at=now)
        row.status = "registered"
        row.approved_at = None
        row.actual_qty = None
        row.cancelled_at = None
    elif row.status == "registered":
        _, completed_count = _line_counts(db, order_id)
        if completed_count > 0:
            _reverse_all_posted_steps(db, row, actual_at=now)
        row.status = "cancelled"
        row.cancelled_at = now
    else:
        raise ProductionError(f"Order cannot be cancelled (current: {row.status}).")

    row.updated_at = now
    db.flush()
    return get_order(db, order_id)


def delete_order(db: Session, order_id: int) -> None:
    row = _active_order_or_error(db, order_id)
    if row.status == "approved":
        raise ProductionError("Approved order cannot be deleted.")
    _, completed_count = _line_counts(db, order_id)
    if completed_count > 0:
        raise ProductionError("Order with completed process steps cannot be deleted.")

    now = _now()
    for line in _order_lines(db, order_id):
        line.deleted_at = now
        line.updated_at = now

    for child in (
        ProductionOrderInput,
        ProductionOrderOutput,
    ):
        rows = db.scalars(
            select(child).where(
                child.production_order_id == order_id,
                child.deleted_at.is_(None),
            )
        ).all()
        for ln in rows:
            ln.deleted_at = now
            ln.updated_at = now

    row.deleted_at = now
    row.updated_at = now
    db.flush()
