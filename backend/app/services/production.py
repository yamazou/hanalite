from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from collections import defaultdict

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.masters import Item, ItemTyp, Location
from app.models.production import (
    ProductionOrder,
    ProductionOrderInput,
    ProductionOrderLine,
    ProductionOrderOutput,
)
from app.schemas.production import (
    ProductionOrderBomPreview,
    ProductionOrderCreate,
    ProductionOrderInputRead,
    ProductionOrderInputWrite,
    ProductionOrderLineWrite,
    ProductionOrderLineRead,
    ProductionOrderListItem,
    ProductionOrderRead,
    ProductionOrderRecalculateIn,
    ProductionOrderUpdate,
    ProductionOrderOutputRead,
)
from app.services.inventory import InventoryError, apply_movement
from app.services.itemprocs import (
    ItemProcError,
    collect_itemproc_steps,
    expand_inputs_from_itemprocs,
)
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


def _get_item_optional(db: Session, item_id: int | None) -> Item | None:
    if item_id is None:
        return None
    item = db.get(Item, int(item_id))
    if not item or item.deleted_at is not None:
        return None
    return item


def _item_display_fields(item_id: int, item: Item | None) -> tuple[int, str, str]:
    if item is not None:
        return item.item_id, item.item_cd, item.item_nm
    return int(item_id), f"#{item_id}", "(missing item)"


def _itemtyp_sort_key(itemtyp_cd: str = "", itemtyp_nm: str = "") -> int:
    """FG → WIP → Purchase parts → RM/Material."""
    for n in (itemtyp_cd.strip().lower(), itemtyp_nm.strip().lower()):
        if not n:
            continue
        if n in ("fg", "finished goods"):
            return 0
        if n in ("wip", "work in process"):
            return 1
        if "purchase" in n:
            return 2
        if n in ("rm", "material", "raw material"):
            return 3
    return 99


def _get_location_or_error(db: Session, location_id: int) -> Location:
    location = db.get(Location, location_id)
    if not location or location.deleted_at is not None:
        raise ProductionError(f"Location {location_id} not found.")
    return location


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


def _line_read(
    db: Session,
    line: ProductionOrderLine,
    *,
    order_parent_item_id: int,
    order_planned_qty: Decimal,
    bom_output_item_id: int | None = None,
    bom_output_item_cd: str | None = None,
    bom_output_item_nm: str | None = None,
) -> ProductionOrderLineRead:
    rm = _get_location_or_error(db, line.rm_location_id)
    wip = _get_location_or_error(db, line.wip_location_id)
    process_no = line.line_no
    process_nm = wip.location_cd
    # Prefer item stored on the line (user edits); fall back to BOM default by step.
    if line.output_item_id is not None:
        resolved_output_item_id = int(line.output_item_id)
    elif bom_output_item_id is not None:
        resolved_output_item_id = bom_output_item_id
    else:
        resolved_output_item_id = None
    if resolved_output_item_id is not None:
        output_item = _get_item_optional(db, int(resolved_output_item_id))
        output_item_id, output_item_cd, output_item_nm = _item_display_fields(
            int(resolved_output_item_id), output_item
        )
    else:
        output_item_id = bom_output_item_id
        output_item_cd = bom_output_item_cd
        output_item_nm = bom_output_item_nm
    line_planned = line.planned_qty if line.planned_qty is not None else order_planned_qty
    return ProductionOrderLineRead(
        prd_order_line_id=line.prd_order_line_id,
        line_no=line.line_no,
        process_no=process_no,
        process_nm=process_nm,
        output_item_id=output_item_id,
        output_item_cd=output_item_cd,
        output_item_nm=output_item_nm,
        planned_qty=line_planned,
        rm_location_id=rm.location_id,
        rm_location_cd=rm.location_cd,
        wip_location_id=wip.location_id,
        wip_location_cd=wip.location_cd,
        status=line.status,  # type: ignore[arg-type]
        actual_qty=line.actual_qty,
        completed_at=line.completed_at,
    )


def _line_output_item_id(db: Session, line: ProductionOrderLine, order: ProductionOrder) -> int:
    if line.output_item_id is not None:
        return int(line.output_item_id)
    return int(order.parent_item_id)


def _itemtyp_fields_by_id(db: Session) -> dict[int, tuple[str, str]]:
    return {
        int(t.itemtyp_id): (str(t.itemtyp_cd), str(t.itemtyp_nm))
        for t in db.scalars(select(ItemTyp).where(ItemTyp.deleted_at.is_(None))).all()
    }



def _replace_lines(db: Session, order: ProductionOrder, lines: list[ProductionOrderLineWrite]) -> None:
    if _has_posted_lines(db, order.production_order_id):
        raise ProductionError("Cannot edit process lines after a step is completed.")
    now = _now()
    existing = db.scalars(
        select(ProductionOrderLine).where(
            ProductionOrderLine.production_order_id == order.production_order_id,
            ProductionOrderLine.deleted_at.is_(None),
        )
    ).all()
    for row in existing:
        row.deleted_at = now
        row.updated_at = now

    existing_by_id = {int(r.prd_order_line_id): r for r in existing}
    for idx, line in enumerate(lines, start=1):
        _get_location_or_error(db, line.rm_location_id)
        _get_location_or_error(db, line.wip_location_id)
        _get_item_or_error(db, line.output_item_id)
        prev = (
            existing_by_id.get(int(line.prd_order_line_id))
            if line.prd_order_line_id is not None
            else None
        )
        status = prev.status if prev is not None else "planned"
        actual_qty = (
            Decimal(line.actual_qty)
            if line.actual_qty is not None
            else (prev.actual_qty if prev is not None else None)
        )
        completed_at = prev.completed_at if prev is not None and status == "completed" else None
        db.add(
            ProductionOrderLine(
                production_order_id=order.production_order_id,
                line_no=line.line_no or idx,
                rm_location_id=line.rm_location_id,
                wip_location_id=line.wip_location_id,
                output_item_id=line.output_item_id,
                planned_qty=Decimal(line.planned_qty),
                status=status,
                actual_qty=actual_qty,
                completed_at=completed_at,
                created_at=now,
                updated_at=now,
            )
        )
    db.flush()


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
        _get_location_or_error(db, line.from_location_id)
        db.add(
            ProductionOrderInput(
                production_order_id=order.production_order_id,
                line_no=line.line_no or idx,
                item_id=line.item_id,
                from_location_id=line.from_location_id,
                req_qty=Decimal(line.req_qty),
                consume_qty=Decimal(line.consume_qty),
                lot=(line.lot.strip() if line.lot else None),
                created_at=now,
                updated_at=now,
            )
        )
    db.flush()


def _create_lines_from_itemprocs(
    db: Session, order: ProductionOrder, parent_item_id: int
) -> list[ProductionOrderLine]:
    try:
        proc_rows = collect_itemproc_steps(db, parent_item_id)
    except ItemProcError as e:
        raise ProductionError(str(e)) from e
    if not proc_rows:
        raise ProductionError("No item process rows found for selected FG item.")
    now = _now()
    lines: list[ProductionOrderLine] = []
    for proc in proc_rows:
        _get_location_or_error(db, proc.rm_location_id)
        _get_location_or_error(db, proc.wip_location_id)
        _get_item_or_error(db, proc.output_item_id)
        line = ProductionOrderLine(
            production_order_id=order.production_order_id,
            line_no=int(proc.line_no),
            rm_location_id=proc.rm_location_id,
            wip_location_id=proc.wip_location_id,
            output_item_id=int(proc.output_item_id),
            planned_qty=Decimal(order.planned_qty),
            status="planned",
            created_at=now,
            updated_at=now,
        )
        db.add(line)
        lines.append(line)
    db.flush()
    return lines


def _process_counts(db: Session, order_id: int) -> tuple[int, int]:
    """Count distinct process steps (wip location), matching the Process grid grouping."""
    lines = _order_lines(db, order_id)
    if not lines:
        return 0, 0
    by_process: dict[int, list[ProductionOrderLine]] = defaultdict(list)
    for ln in lines:
        by_process[int(ln.wip_location_id)].append(ln)
    total = len(by_process)
    done = sum(1 for group in by_process.values() if all(ln.status == "completed" for ln in group))
    return total, done


def _has_posted_lines(db: Session, order_id: int) -> bool:
    return any(ln.status == "completed" for ln in _order_lines(db, order_id))


def _to_list_item(db: Session, row: ProductionOrder) -> ProductionOrderListItem:
    parent_item_id, parent_item_cd, parent_item_nm = _item_display_fields(
        int(row.parent_item_id),
        _get_item_optional(db, int(row.parent_item_id)),
    )
    line_count, completed_line_count = _process_counts(db, row.production_order_id)
    return ProductionOrderListItem(
        production_order_id=row.production_order_id,
        status=row.status,  # type: ignore[arg-type]
        production_date=row.production_date,
        reference_no=row.reference_no,
        source_type=row.source_type,  # type: ignore[arg-type]
        parent_item_id=parent_item_id,
        parent_item_cd=parent_item_cd,
        parent_item_nm=parent_item_nm,
        planned_qty=row.planned_qty,
        actual_qty=row.actual_qty,
        lot=row.lot,
        line_count=line_count,
        completed_line_count=completed_line_count,
        created_at=row.created_at,
        approved_at=row.approved_at,
        cancelled_at=row.cancelled_at,
    )


def list_orders(
    db: Session,
    *,
    status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    item_q: str | None = None,
    lot: str | None = None,
) -> list[ProductionOrderListItem]:
    stmt = (
        select(ProductionOrder)
        .where(ProductionOrder.deleted_at.is_(None))
        .order_by(ProductionOrder.production_order_id.desc())
    )
    if status:
        stmt = stmt.where(ProductionOrder.status == status)
    if date_from is not None:
        stmt = stmt.where(ProductionOrder.production_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(ProductionOrder.production_date <= date_to)
    lot_value = (lot or "").strip()
    if lot_value:
        stmt = stmt.where(ProductionOrder.lot.like(f"%{lot_value}%"))
    item_term = (item_q or "").strip()
    if item_term:
        item_pattern = f"%{item_term}%"
        item_label = func.concat(Item.item_cd, " - ", Item.item_nm)
        stmt = stmt.join(Item, Item.item_id == ProductionOrder.parent_item_id).where(
            or_(
                Item.item_cd.like(item_pattern),
                Item.item_nm.like(item_pattern),
                item_label.like(item_pattern),
            )
        )
    rows = db.scalars(stmt).all()
    return [_to_list_item(db, row) for row in rows]


def suggest_production_lots(db: Session, q: str | None = None, *, limit: int = 20) -> list[str]:
    stmt = (
        select(ProductionOrder.lot)
        .where(ProductionOrder.deleted_at.is_(None))
        .distinct()
        .order_by(ProductionOrder.lot.asc())
    )
    term = (q or "").strip()
    if term:
        stmt = stmt.where(ProductionOrder.lot.like(f"%{term}%"))
    stmt = stmt.limit(min(max(limit, 1), 50))
    return [row[0] for row in db.execute(stmt).all() if row[0]]


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

    proc_rows = collect_itemproc_steps(db, row.parent_item_id)
    output_id_by_line_no: dict[int, int] = {}
    output_cd_by_line_no: dict[int, str | None] = {}
    output_nm_by_line_no: dict[int, str | None] = {}
    level_by_line_no: dict[int, int] = {}
    for proc in proc_rows:
        line_no = int(proc.line_no)
        output_item_id, output_cd, output_nm = _item_display_fields(
            int(proc.output_item_id),
            _get_item_optional(db, proc.output_item_id),
        )
        output_id_by_line_no[line_no] = output_item_id
        output_cd_by_line_no[line_no] = output_cd
        output_nm_by_line_no[line_no] = output_nm
        level_by_line_no[line_no] = line_no

    itemtyp_fields_by_id = _itemtyp_fields_by_id(db)

    lines = [
        _line_read(
            db,
            ln,
            order_parent_item_id=int(row.parent_item_id),
            order_planned_qty=Decimal(row.planned_qty),
            bom_output_item_id=output_id_by_line_no.get(int(ln.line_no)),
            bom_output_item_cd=output_cd_by_line_no.get(int(ln.line_no)),
            bom_output_item_nm=output_nm_by_line_no.get(int(ln.line_no)),
        )
        for ln in lines_raw
    ]
    input_reads: list[tuple[int, int, int, ProductionOrderInputRead]] = []
    for ln in inputs_raw:
        item = _get_item_optional(db, ln.item_id)
        item_id, item_cd, item_nm = _item_display_fields(int(ln.item_id), item)
        if item is not None:
            cd, itemtyp_nm = itemtyp_fields_by_id.get(int(item.itemtyp_id), ("", ""))
        else:
            cd, itemtyp_nm = "", ""
        typ_sort = _itemtyp_sort_key(cd, itemtyp_nm)
        if ln.from_location_id is not None:
            from_loc = _get_location_or_error(db, int(ln.from_location_id))
            from_location_id = from_loc.location_id
            from_location_cd = from_loc.location_cd
            from_location_nm = from_loc.location_nm
        else:
            from_location_id = None
            from_location_cd = None
            from_location_nm = None
        input_reads.append(
            (
                level_by_line_no.get(int(ln.line_no), 0),
                typ_sort,
                int(ln.line_no),
                ProductionOrderInputRead(
                    prd_order_input_id=ln.prd_order_input_id,
                    line_no=ln.line_no,
                    level=level_by_line_no.get(int(ln.line_no), 0),
                    itemtyp_nm=itemtyp_nm,
                    item_id=item_id,
                    item_cd=item_cd,
                    item_nm=item_nm,
                    from_location_id=from_location_id,
                    from_location_cd=from_location_cd,
                    from_location_nm=from_location_nm,
                    req_qty=ln.req_qty,
                    consume_qty=ln.consume_qty,
                    lot=ln.lot,
                ),
            )
        )
    input_reads.sort(key=lambda t: (t[0], t[1], t[2]))
    inputs = [read for _, _, _, read in input_reads]
    outputs = []
    for ln in outputs_raw:
        out_item_id, out_item_cd, out_item_nm = _item_display_fields(
            int(ln.item_id),
            _get_item_optional(db, ln.item_id),
        )
        loc = _get_location_or_error(db, ln.location_id)
        outputs.append(
            ProductionOrderOutputRead(
                prd_order_output_id=ln.prd_order_output_id,
                prd_order_line_id=ln.prd_order_line_id,
                line_no=ln.line_no,
                item_id=out_item_id,
                item_cd=out_item_cd,
                item_nm=out_item_nm,
                output_qty=ln.output_qty,
                location_id=ln.location_id,
                location_cd=loc.location_cd,
                location_nm=loc.location_nm,
                lot=ln.lot,
            )
        )

    return ProductionOrderRead(
        **base.model_dump(),
        notes=row.notes,
        updated_at=row.updated_at,
        lines=lines,
        inputs=inputs,
        outputs=outputs,
    )


def create_order(
    db: Session,
    payload: ProductionOrderCreate,
    *,
    source_type: str = "manual",
) -> ProductionOrderRead:
    _get_item_or_error(db, payload.parent_item_id)
    now = _now()
    row = ProductionOrder(
        status="registered",
        production_date=payload.production_date,
        reference_no=(payload.reference_no.strip() if payload.reference_no else None),
        source_type=source_type,
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

    try:
        expanded = expand_inputs_from_itemprocs(
            db,
            parent_item_id=payload.parent_item_id,
            basis_qty=Decimal(payload.planned_qty),
        )
    except ItemProcError as e:
        raise ProductionError(str(e)) from e
    _replace_inputs(db, row, expanded)
    return get_order(db, row.production_order_id)


def _order_inputs(db: Session, order_id: int) -> list[ProductionOrderInput]:
    return list(
        db.scalars(
            select(ProductionOrderInput)
            .where(
                ProductionOrderInput.production_order_id == order_id,
                ProductionOrderInput.deleted_at.is_(None),
            )
            .order_by(ProductionOrderInput.line_no.asc())
        ).all()
    )


def _has_any_actual_quantities(db: Session, order_id: int) -> bool:
    """True when at least one process Actual Qty or input Actual Input Qty was entered."""
    for ln in _order_lines(db, order_id):
        if ln.actual_qty is not None and Decimal(ln.actual_qty) > 0:
            return True
    for inp in _order_inputs(db, order_id):
        if Decimal(inp.consume_qty) != Decimal(inp.req_qty):
            return True
    return False


def _maybe_mark_started(db: Session, order: ProductionOrder) -> None:
    if order.status not in ("approved", "started"):
        return
    if _has_any_actual_quantities(db, order.production_order_id):
        order.status = "started"


def _patch_approved_actuals(
    db: Session,
    order: ProductionOrder,
    payload: ProductionOrderUpdate,
) -> None:
    """Approved orders: only actual_qty on process lines and consume_qty on inputs."""
    now = _now()
    if payload.lines is not None:
        by_id = {int(ln.prd_order_line_id): ln for ln in _order_lines(db, order.production_order_id)}
        for line in payload.lines:
            if line.prd_order_line_id is None:
                continue
            ln = by_id.get(int(line.prd_order_line_id))
            if ln is None:
                raise ProductionError(f"Process line {line.prd_order_line_id} not found.")
            ln.actual_qty = Decimal(line.actual_qty) if line.actual_qty is not None else None
            ln.updated_at = now
    if payload.inputs is not None:
        existing = db.scalars(
            select(ProductionOrderInput).where(
                ProductionOrderInput.production_order_id == order.production_order_id,
                ProductionOrderInput.deleted_at.is_(None),
            )
        ).all()
        by_id = {int(inp.prd_order_input_id): inp for inp in existing}
        for inp in payload.inputs:
            if inp.prd_order_input_id is None:
                continue
            row_inp = by_id.get(int(inp.prd_order_input_id))
            if row_inp is None:
                raise ProductionError(f"Input line {inp.prd_order_input_id} not found.")
            row_inp.consume_qty = Decimal(inp.consume_qty)
            row_inp.updated_at = now
    if payload.actual_qty is not None:
        order.actual_qty = Decimal(payload.actual_qty)


def update_order(db: Session, order_id: int, payload: ProductionOrderUpdate) -> ProductionOrderRead:
    row = _active_order_or_error(db, order_id)
    if row.status in ("approved", "started"):
        if any(
            v is not None
            for v in (
                payload.production_date,
                payload.reference_no,
                payload.planned_qty,
                payload.lot,
                payload.notes,
                payload.status,
            )
        ):
            raise ProductionError(
                "Approved orders only allow Actual Qty and Actual Input Qty updates."
            )
        if payload.lines is None and payload.inputs is None and payload.actual_qty is None:
            raise ProductionError("No actual quantity fields to update.")
        _patch_approved_actuals(db, row, payload)
        _maybe_mark_started(db, row)
        row.updated_at = _now()
        db.flush()
        return get_order(db, order_id)
    if row.status != "registered":
        raise ProductionError("Only registered orders can be edited.")

    if payload.production_date is not None:
        row.production_date = payload.production_date
    if payload.reference_no is not None:
        row.reference_no = payload.reference_no.strip() or None
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

    if payload.lines is not None:
        _replace_lines(db, row, payload.lines)
        if payload.lines and payload.planned_qty is None:
            row.planned_qty = Decimal(payload.lines[0].planned_qty)
    if payload.inputs is not None:
        _replace_inputs(db, row, payload.inputs)

    db.flush()
    return get_order(db, order_id)


def reload_order_from_bom(db: Session, order_id: int) -> ProductionOrderRead:
    """Rebuild process lines and input items from the current BOM."""
    row = _active_order_or_error(db, order_id)
    if row.status != "registered":
        raise ProductionError("Only registered orders can reload from BOM.")
    if _has_posted_lines(db, order_id):
        raise ProductionError("Cannot reload from BOM after a process step is completed.")
    line_writes, expanded = _itemproc_reload_writes(db, row)
    _replace_lines(db, row, line_writes)
    _replace_inputs(db, row, expanded)
    row.updated_at = _now()
    db.flush()
    return get_order(db, order_id)


def preview_order_from_bom(
    db: Session,
    order_id: int,
    *,
    planned_qty: Decimal | None = None,
) -> ProductionOrderBomPreview:
    """Return BOM-expanded process/input rows without persisting."""
    row = _active_order_or_error(db, order_id)
    if row.status != "registered":
        raise ProductionError("Only registered orders can reload from BOM.")
    if _has_posted_lines(db, order_id):
        raise ProductionError("Cannot reload from BOM after a process step is completed.")
    basis = Decimal(planned_qty) if planned_qty is not None else Decimal(row.planned_qty)
    line_writes, expanded = _itemproc_reload_writes(db, row, basis_qty=basis)
    proc_steps = collect_itemproc_steps(db, row.parent_item_id)
    if not proc_steps:
        raise ProductionError("No item process rows found for this item.")
    level_by_line_no = {int(proc.line_no): int(proc.line_no) for proc in proc_steps}
    itemtyp_fields_by_id = _itemtyp_fields_by_id(db)

    lines: list[ProductionOrderLineRead] = []
    for idx, line_write in enumerate(line_writes, start=1):
        rm = _get_location_or_error(db, line_write.rm_location_id)
        wip = _get_location_or_error(db, line_write.wip_location_id)
        output_item = _get_item_or_error(db, line_write.output_item_id)
        lines.append(
            ProductionOrderLineRead(
                prd_order_line_id=0,
                line_no=idx,
                process_no=idx,
                process_nm=wip.location_cd,
                output_item_id=output_item.item_id,
                output_item_cd=output_item.item_cd,
                output_item_nm=output_item.item_nm,
                planned_qty=line_write.planned_qty,
                rm_location_id=rm.location_id,
                rm_location_cd=rm.location_cd,
                wip_location_id=wip.location_id,
                wip_location_cd=wip.location_cd,
                status="planned",
                actual_qty=None,
                completed_at=None,
            )
        )

    input_reads: list[tuple[int, int, int, ProductionOrderInputRead]] = []
    for inp in expanded:
        item = _get_item_or_error(db, inp.item_id)
        cd, itemtyp_nm = itemtyp_fields_by_id.get(int(item.itemtyp_id), ("", ""))
        typ_sort = _itemtyp_sort_key(cd, itemtyp_nm)
        from_loc = _get_location_or_error(db, inp.from_location_id)
        line_no = int(inp.line_no or 1)
        input_reads.append(
            (
                level_by_line_no.get(line_no, 0),
                typ_sort,
                line_no,
                ProductionOrderInputRead(
                    prd_order_input_id=0,
                    line_no=line_no,
                    level=level_by_line_no.get(line_no, 0),
                    itemtyp_nm=itemtyp_nm,
                    item_id=inp.item_id,
                    item_cd=item.item_cd,
                    item_nm=item.item_nm,
                    from_location_id=from_loc.location_id,
                    from_location_cd=from_loc.location_cd,
                    from_location_nm=from_loc.location_nm,
                    req_qty=inp.req_qty,
                    consume_qty=inp.consume_qty,
                    lot=inp.lot,
                ),
            )
        )
    input_reads.sort(key=lambda t: (t[0], t[1], t[2]))
    return ProductionOrderBomPreview(
        lines=lines,
        inputs=[read for _, _, _, read in input_reads],
    )


def _itemproc_reload_writes(
    db: Session,
    row: ProductionOrder,
    *,
    basis_qty: Decimal | None = None,
) -> tuple[list[ProductionOrderLineWrite], list[ProductionOrderInputWrite]]:
    proc_steps = collect_itemproc_steps(db, row.parent_item_id)
    if not proc_steps:
        raise ProductionError("No item process rows found for this item.")
    basis = basis_qty if basis_qty is not None else Decimal(row.planned_qty)
    line_writes = [
        ProductionOrderLineWrite(
            line_no=int(proc.line_no),
            rm_location_id=int(proc.rm_location_id),
            wip_location_id=int(proc.wip_location_id),
            output_item_id=int(proc.output_item_id),
            planned_qty=basis,
            actual_qty=None,
        )
        for proc in proc_steps
    ]
    try:
        expanded = expand_inputs_from_itemprocs(
            db,
            parent_item_id=row.parent_item_id,
            basis_qty=basis,
        )
    except ItemProcError as e:
        raise ProductionError(str(e)) from e
    return line_writes, expanded


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
    line_by_no = {int(ln.line_no): ln for ln in lines}

    if current_inputs:
        next_inputs = []
        for ln in current_inputs:
            proc = line_by_no.get(int(ln.line_no))
            from_loc = ln.from_location_id
            if from_loc is None and proc is not None:
                from_loc = proc.rm_location_id
            if from_loc is None:
                raise ProductionError(
                    f"Input line {ln.line_no} is missing from location; reload from BOM."
                )
            next_inputs.append(
                ProductionOrderInputWrite(
                    item_id=ln.item_id,
                    from_location_id=int(from_loc),
                    req_qty=Decimal(ln.req_qty),
                    consume_qty=Decimal(ln.req_qty) * basis,
                    lot=ln.lot or row.lot,
                    line_no=ln.line_no,
                )
            )
    else:
        try:
            next_inputs = expand_inputs_from_itemprocs(
                db,
                parent_item_id=row.parent_item_id,
                basis_qty=basis,
            )
        except ItemProcError as e:
            raise ProductionError(str(e)) from e
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
    if row.status in ("approved", "started"):
        raise ProductionError("Ordered/Started orders cannot be posted via process complete.")
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
        raise ProductionError(f"Complete process step {pending.line_no} first.")

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
            step_inputs = [ln for ln in inputs if int(ln.line_no) == int(line.line_no)]
            if not step_inputs:
                raise ProductionError("No RM input lines found.")
            for ln in step_inputs:
                if Decimal(ln.consume_qty) <= 0:
                    raise ProductionError("Input consume quantity must be > 0.")
                from_loc_id = (
                    int(ln.from_location_id)
                    if ln.from_location_id is not None
                    else int(line.rm_location_id)
                )
                apply_movement(
                    db,
                    item_id=ln.item_id,
                    location_id=from_loc_id,
                    lot=(ln.lot or row.lot),
                    move_qty=Decimal(ln.consume_qty),
                    movetyps_cd="GI",
                    actual_at=now,
                )
        else:
            output_item_id = _line_output_item_id(db, line, row)
            apply_movement(
                db,
                item_id=output_item_id,
                location_id=line.rm_location_id,
                lot=row.lot,
                move_qty=qty,
                movetyps_cd="GI",
                actual_at=now,
            )

        output_item_id = _line_output_item_id(db, line, row)
        apply_movement(
            db,
            item_id=output_item_id,
            location_id=line.wip_location_id,
            lot=row.lot,
            move_qty=qty,
            movetyps_cd="GR",
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
            item_id=_line_output_item_id(db, line, row),
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
    output_item_id = _line_output_item_id(db, line, order)
    qty = Decimal(line.actual_qty or line.planned_qty or order.planned_qty)

    apply_movement(
        db,
        item_id=output_item_id,
        location_id=line.wip_location_id,
        lot=order.lot,
        move_qty=qty,
        movetyps_cd="GI",
        actual_at=actual_at,
    )
    if not is_first:
        apply_movement(
            db,
            item_id=output_item_id,
            location_id=line.rm_location_id,
            lot=order.lot,
            move_qty=qty,
            movetyps_cd="GR",
            actual_at=actual_at,
        )
    if is_first:
        step_inputs = [ln for ln in inputs if int(ln.line_no) == int(line.line_no)]
        for ln in step_inputs:
            from_loc_id = (
                int(ln.from_location_id)
                if ln.from_location_id is not None
                else int(line.rm_location_id)
            )
            apply_movement(
                db,
                item_id=ln.item_id,
                location_id=from_loc_id,
                lot=(ln.lot or order.lot),
                move_qty=Decimal(ln.consume_qty),
                movetyps_cd="GR",
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

    now = _now()
    row.status = "approved"
    row.approved_at = now
    row.updated_at = now
    db.flush()
    return get_order(db, order_id)


def _reset_actual_quantities(db: Session, order: ProductionOrder) -> None:
    """Clear all Actual Qty / Actual Input Qty entries (Started → Ordered)."""
    now = _now()
    order.actual_qty = None
    for line in _order_lines(db, order.production_order_id):
        line.actual_qty = None
        line.updated_at = now
    for inp in _order_inputs(db, order.production_order_id):
        inp.consume_qty = Decimal(inp.req_qty)
        inp.updated_at = now


def cancel_order(db: Session, order_id: int) -> ProductionOrderRead:
    row = _active_order_or_error(db, order_id)
    if row.status == "cancelled":
        raise ProductionError("Order is already cancelled.")

    now = _now()
    if row.status == "started":
        _reset_actual_quantities(db, row)
        row.status = "approved"
        row.cancelled_at = None
    elif row.status == "approved":
        _reverse_all_posted_steps(db, row, actual_at=now)
        row.status = "registered"
        row.approved_at = None
        row.actual_qty = None
        row.cancelled_at = None
    elif row.status == "registered":
        if _has_posted_lines(db, order_id):
            _reverse_all_posted_steps(db, row, actual_at=now)
        row.status = "cancelled"
        row.cancelled_at = now
    else:
        raise ProductionError(f"Order cannot be cancelled (current: {row.status}).")

    row.updated_at = now
    db.flush()
    return get_order(db, order_id)


def restore_order(db: Session, order_id: int) -> ProductionOrderRead:
    row = _active_order_or_error(db, order_id)
    if row.status != "cancelled":
        raise ProductionError("Only cancelled orders can be restored to registered.")

    now = _now()
    row.status = "registered"
    row.cancelled_at = None
    row.updated_at = now
    db.flush()
    return get_order(db, order_id)


def delete_order(db: Session, order_id: int) -> None:
    row = _active_order_or_error(db, order_id)
    if row.status != "cancelled":
        raise ProductionError("Only cancelled orders can be deleted.")

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
