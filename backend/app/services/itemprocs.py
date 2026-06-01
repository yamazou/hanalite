"""Item process master CRUD and production expansion helpers."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.masters import Customer, Item, ItemProc, ItemProcInput, ItemProcRoot, ItemTyp, Location
from app.schemas.itemprocs import (
    ItemProcInputRead,
    ItemProcRead,
    ItemProcessFinalItemRead,
    ItemProcessFinalItemsSave,
    ItemProcessesOut,
    ItemProcessesSave,
    ItemProcWrite,
)
from app.schemas.production import ProductionOrderInputWrite
from app.services.inventory_query import pick_oldest_gr_lot_for_item


class ItemProcError(Exception):
    pass


def _now() -> datetime:
    return datetime.now()


def _get_item_or_error(db: Session, item_id: int) -> Item:
    item = db.get(Item, item_id)
    if not item or item.deleted_at is not None:
        raise ItemProcError(f"Item {item_id} not found.")
    return item


def _get_location_or_error(db: Session, location_id: int) -> Location:
    location = db.get(Location, location_id)
    if not location or location.deleted_at is not None:
        raise ItemProcError(f"Location {location_id} not found.")
    return location


def get_rm_type_location_or_error(db: Session) -> Location:
    """Active location with type RM (raw material warehouse)."""
    location = db.scalar(
        select(Location)
        .where(Location.deleted_at.is_(None), Location.location_type == "RM")
        .order_by(Location.location_id.asc())
        .limit(1)
    )
    if location is None:
        raise ItemProcError("No active RM location found in Locations master.")
    return location


def resolve_rm_location_id_for_itemproc_step(
    db: Session,
    proc: ItemProc,
    proc_steps: list[ItemProc],
) -> int:
    """First step issues from RM location; later steps from previous WIP."""
    sorted_steps = sorted(proc_steps, key=lambda p: (int(p.line_no), int(p.itemproc_id)))
    idx = next(
        (
            i
            for i, step in enumerate(sorted_steps)
            if int(step.itemproc_id) == int(proc.itemproc_id)
        ),
        -1,
    )
    if idx <= 0:
        return int(get_rm_type_location_or_error(db).location_id)
    return int(sorted_steps[idx - 1].wip_location_id)


def _proc_to_read(
    db: Session, proc: ItemProc, proc_steps: list[ItemProc]
) -> ItemProcRead:
    wip = _get_location_or_error(db, proc.wip_location_id)
    output_item = _get_item_or_error(db, proc.output_item_id)
    from_loc_id = resolve_rm_location_id_for_itemproc_step(db, proc, proc_steps)
    from_loc = _get_location_or_error(db, from_loc_id)
    active_inputs = [inp for inp in proc.inputs if inp.deleted_at is None]
    active_inputs.sort(key=lambda r: int(r.input_no))
    input_reads: list[ItemProcInputRead] = []
    for inp in active_inputs:
        item = _get_item_or_error(db, inp.item_id)
        input_reads.append(
            ItemProcInputRead(
                itemproc_input_id=inp.itemproc_input_id,
                input_no=inp.input_no,
                item_id=item.item_id,
                item_cd=item.item_cd,
                item_nm=item.item_nm,
                from_location_id=from_loc.location_id,
                from_location_cd=from_loc.location_cd,
                from_location_nm=from_loc.location_nm,
                req_qty=inp.req_qty,
            )
        )
    return ItemProcRead(
        itemproc_id=proc.itemproc_id,
        line_no=proc.line_no,
        wip_location_id=wip.location_id,
        wip_location_cd=wip.location_cd,
        wip_location_nm=wip.location_nm,
        output_item_id=output_item.item_id,
        output_item_cd=output_item.item_cd,
        output_item_nm=output_item.item_nm,
        inputs=input_reads,
        created_at=proc.created_at,
        updated_at=proc.updated_at,
    )


def collect_itemproc_steps(db: Session, item_id: int) -> list[ItemProc]:
    """Active process steps for an FG item, ordered by line_no."""
    return list(
        db.scalars(
            select(ItemProc)
            .options(selectinload(ItemProc.inputs))
            .where(ItemProc.item_id == item_id, ItemProc.deleted_at.is_(None))
            .order_by(ItemProc.line_no.asc(), ItemProc.itemproc_id.asc())
        ).all()
    )


def expand_inputs_from_itemprocs(
    db: Session,
    *,
    parent_item_id: int,
    basis_qty: Decimal,
) -> list[ProductionOrderInputWrite]:
    steps = collect_itemproc_steps(db, parent_item_id)
    if not steps:
        return []
    inputs: list[ProductionOrderInputWrite] = []
    for step in steps:
        active_inputs = [inp for inp in step.inputs if inp.deleted_at is None]
        active_inputs.sort(key=lambda r: int(r.input_no))
        from_location_id = resolve_rm_location_id_for_itemproc_step(db, step, steps)
        for inp in active_inputs:
            if inp.req_qty is None:
                continue
            req_qty = Decimal(inp.req_qty)
            assigned_lot = pick_oldest_gr_lot_for_item(
                db, int(inp.item_id), location_id=from_location_id
            )
            inputs.append(
                ProductionOrderInputWrite(
                    line_no=int(step.line_no),
                    item_id=int(inp.item_id),
                    from_location_id=from_location_id,
                    req_qty=req_qty,
                    consume_qty=(req_qty * Decimal(basis_qty)),
                    lot=assigned_lot or "*",
                )
            )
    return inputs


def get_item_processes(db: Session, item_id: int) -> ItemProcessesOut:
    item = _get_item_or_error(db, item_id)
    steps = collect_itemproc_steps(db, item_id)
    return ItemProcessesOut(
        item_id=item.item_id,
        item_cd=item.item_cd,
        item_nm=item.item_nm,
        processes=[_proc_to_read(db, proc, steps) for proc in steps],
    )


def _clear_item_processes_for_item(db: Session, item_id: int) -> None:
    """Remove process rows and root registration (item master may already be deleted)."""
    existing_procs = db.scalars(select(ItemProc).where(ItemProc.item_id == item_id)).all()
    for proc in existing_procs:
        for inp in list(proc.inputs):
            db.delete(inp)
        db.delete(proc)
    root = db.get(ItemProcRoot, item_id)
    if root is not None:
        db.delete(root)
    db.flush()


def _purge_orphan_itemproc_roots(db: Session) -> None:
    for root in list(db.scalars(select(ItemProcRoot)).all()):
        item = db.get(Item, root.item_id)
        if item is None or item.deleted_at is not None:
            _clear_item_processes_for_item(db, int(root.item_id))


def _is_output_itemtyp(itemtyp_cd: str, itemtyp_nm: str) -> bool:
    cd = itemtyp_cd.strip().upper()
    nm = itemtyp_nm.strip().lower()
    if cd in ("FG", "WIP"):
        return True
    return "finished good" in nm or "work in process" in nm


def list_item_process_final_items(db: Session) -> list[ItemProcessFinalItemRead]:
    """Output items registered for Item Process (with or without process steps)."""
    c1 = Customer.__table__.alias("c1")
    root_ids = select(ItemProcRoot.item_id)
    proc_ids = (
        select(ItemProc.item_id)
        .where(ItemProc.deleted_at.is_(None))
        .distinct()
    )
    registered_ids = root_ids.union(proc_ids).subquery()
    rows = db.execute(
        select(
            Item.item_id,
            Item.item_cd,
            Item.item_nm,
            ItemTyp.itemtyp_cd,
            c1.c.customers_cd,
        )
        .join(registered_ids, registered_ids.c.item_id == Item.item_id)
        .join(ItemTyp, ItemTyp.itemtyp_id == Item.itemtyp_id)
        .outerjoin(c1, c1.c.customers_id == Item.customer1_id)
        .where(Item.deleted_at.is_(None))
        .order_by(Item.item_cd.asc(), Item.item_id.asc())
    ).all()
    return [
        ItemProcessFinalItemRead(
            item_id=int(item_id),
            item_cd=str(item_cd),
            item_nm=str(item_nm),
            itemtyp_cd=str(itemtyp_cd),
            customer_cd=str(customer_cd or ""),
        )
        for item_id, item_cd, item_nm, itemtyp_cd, customer_cd in rows
    ]


def save_item_process_final_items(
    db: Session, payload: ItemProcessFinalItemsSave
) -> list[ItemProcessFinalItemRead]:
    _purge_orphan_itemproc_roots(db)
    seen: set[int] = set()
    for item_id in payload.item_ids:
        if item_id in seen:
            raise ItemProcError(f"Duplicate output item id {item_id}.")
        seen.add(item_id)
        item = _get_item_or_error(db, item_id)
        typ = db.get(ItemTyp, item.itemtyp_id)
        if typ is None or typ.deleted_at is not None:
            raise ItemProcError(f"Item type not found for item {item_id}.")
        if not _is_output_itemtyp(str(typ.itemtyp_cd), str(typ.itemtyp_nm)):
            raise ItemProcError(
                f"Item {item.item_cd} must be Finished Goods or Work in Process."
            )

    now = _now()
    existing = {
        int(row.item_id)
        for row in db.scalars(select(ItemProcRoot)).all()
    }
    target = set(payload.item_ids)

    for removed_id in existing - target:
        _clear_item_processes_for_item(db, removed_id)

    for added_id in target - existing:
        db.add(ItemProcRoot(item_id=added_id, created_at=now))

    db.flush()
    return list_item_process_final_items(db)


def _validate_process_writes(db: Session, processes: list[ItemProcWrite]) -> None:
    seen_lines: set[int] = set()
    for proc in processes:
        if proc.line_no in seen_lines:
            raise ItemProcError(f"Duplicate process line_no {proc.line_no}.")
        seen_lines.add(proc.line_no)
        _get_location_or_error(db, proc.wip_location_id)
        _get_item_or_error(db, proc.output_item_id)
        seen_input_nos: set[int] = set()
        for inp in proc.inputs:
            if inp.input_no in seen_input_nos:
                raise ItemProcError(
                    f"Duplicate input_no {inp.input_no} on process line {proc.line_no}."
                )
            seen_input_nos.add(inp.input_no)
            _get_item_or_error(db, inp.item_id)
            if inp.req_qty is not None and Decimal(inp.req_qty) <= 0:
                raise ItemProcError(
                    f"Input req_qty must be positive on process line {proc.line_no}."
                )


def save_item_processes(
    db: Session, item_id: int, payload: ItemProcessesSave
) -> ItemProcessesOut:
    _get_item_or_error(db, item_id)
    _validate_process_writes(db, payload.processes)
    now = _now()

    existing_procs = db.scalars(select(ItemProc).where(ItemProc.item_id == item_id)).all()
    for proc in existing_procs:
        for inp in list(proc.inputs):
            db.delete(inp)
        db.delete(proc)
    db.flush()

    for proc_write in payload.processes:
        proc = ItemProc(
            item_id=item_id,
            line_no=int(proc_write.line_no),
            wip_location_id=int(proc_write.wip_location_id),
            output_item_id=int(proc_write.output_item_id),
            created_at=now,
            updated_at=now,
        )
        db.add(proc)
        db.flush()
        for inp_write in proc_write.inputs:
            db.add(
                ItemProcInput(
                    itemproc_id=proc.itemproc_id,
                    input_no=int(inp_write.input_no),
                    item_id=int(inp_write.item_id),
                    req_qty=(
                        Decimal(inp_write.req_qty)
                        if inp_write.req_qty is not None
                        else None
                    ),
                    created_at=now,
                    updated_at=now,
                )
            )
    db.flush()
    if payload.processes:
        root = db.get(ItemProcRoot, item_id)
        if root is None:
            db.add(ItemProcRoot(item_id=item_id, created_at=now))
            db.flush()
    return get_item_processes(db, item_id)


