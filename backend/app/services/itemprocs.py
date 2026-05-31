"""Item process master CRUD and production expansion helpers."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.boms import Bom
from app.models.masters import Customer, Item, ItemProc, ItemProcInput, ItemTyp, Location
from app.schemas.itemprocs import (
    ItemProcInputRead,
    ItemProcInputWrite,
    ItemProcRead,
    ItemProcessFinalItemRead,
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


def _itemtyp_sort_key(itemtyp_cd: str = "", itemtyp_nm: str = "") -> int:
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


def _itemtyp_fields_by_id(db: Session) -> dict[int, tuple[str, str]]:
    return {
        int(t.itemtyp_id): (str(t.itemtyp_cd), str(t.itemtyp_nm))
        for t in db.scalars(select(ItemTyp).where(ItemTyp.deleted_at.is_(None))).all()
    }


def _is_input_material(itemtyp_cd: str, itemtyp_nm: str) -> bool:
    return _itemtyp_sort_key(itemtyp_cd, itemtyp_nm) != 0


def _iter_bom_edges_to_process_locations(db: Session, parent_item_id: int) -> list[Bom]:
    all_rows = db.scalars(
        select(Bom)
        .where(Bom.deleted_at.is_(None))
        .order_by(Bom.level.asc(), Bom.bom_id.asc())
    ).all()
    location_type_by_id = {
        int(loc.location_id): str(loc.location_type)
        for loc in db.scalars(select(Location).where(Location.deleted_at.is_(None))).all()
    }
    by_parent: dict[int, list[Bom]] = defaultdict(list)
    for row in all_rows:
        by_parent[int(row.p_item_id)].append(row)

    collected: list[Bom] = []
    seen_bom_ids: set[int] = set()
    processed_parents: set[int] = set()
    queue: list[int] = [int(parent_item_id)]

    while queue:
        current_parent = queue.pop(0)
        if current_parent in processed_parents:
            continue
        processed_parents.add(current_parent)
        for row in by_parent.get(current_parent, []):
            if row.bom_id in seen_bom_ids:
                continue
            seen_bom_ids.add(int(row.bom_id))
            if location_type_by_id.get(int(row.to_location_id)) == "Process":
                collected.append(row)
            queue.append(int(row.c_item_id))
    return collected


def _pick_process_bom_row(
    db: Session, group: list[Bom], itemtyp_fields_by_id: dict[int, tuple[str, str]]
) -> Bom:
    def rank(bom: Bom) -> tuple[int, int, int]:
        item = _get_item_or_error(db, bom.c_item_id)
        cd, nm = itemtyp_fields_by_id.get(int(item.itemtyp_id), ("", ""))
        return (_itemtyp_sort_key(cd, nm), -int(bom.level), int(bom.bom_id))

    return min(group, key=rank)


def _collect_bom_process_steps(db: Session, parent_item_id: int) -> list[Bom]:
    edges = _iter_bom_edges_to_process_locations(db, parent_item_id)
    if not edges:
        return []
    by_to_location: dict[int, list[Bom]] = defaultdict(list)
    for bom in edges:
        by_to_location[int(bom.to_location_id)].append(bom)
    itemtyp_fields_by_id = _itemtyp_fields_by_id(db)
    picked = [
        _pick_process_bom_row(db, group, itemtyp_fields_by_id)
        for group in by_to_location.values()
    ]
    picked.sort(key=lambda b: (int(b.level), int(b.bom_id)), reverse=True)
    return picked


def _proc_to_read(db: Session, proc: ItemProc) -> ItemProcRead:
    wip = _get_location_or_error(db, proc.wip_location_id)
    rm = _get_location_or_error(db, proc.rm_location_id)
    output_item = _get_item_or_error(db, proc.output_item_id)
    active_inputs = [inp for inp in proc.inputs if inp.deleted_at is None]
    active_inputs.sort(key=lambda r: int(r.input_no))
    input_reads: list[ItemProcInputRead] = []
    for inp in active_inputs:
        item = _get_item_or_error(db, inp.item_id)
        if inp.from_location_id is not None:
            from_loc = _get_location_or_error(db, inp.from_location_id)
            from_location_id = from_loc.location_id
            from_location_cd = from_loc.location_cd
            from_location_nm = from_loc.location_nm
        else:
            from_location_id = None
            from_location_cd = ""
            from_location_nm = ""
        input_reads.append(
            ItemProcInputRead(
                itemproc_input_id=inp.itemproc_input_id,
                input_no=inp.input_no,
                item_id=item.item_id,
                item_cd=item.item_cd,
                item_nm=item.item_nm,
                from_location_id=from_location_id,
                from_location_cd=from_location_cd,
                from_location_nm=from_location_nm,
                req_qty=inp.req_qty,
            )
        )
    return ItemProcRead(
        itemproc_id=proc.itemproc_id,
        line_no=proc.line_no,
        wip_location_id=wip.location_id,
        wip_location_cd=wip.location_cd,
        wip_location_nm=wip.location_nm,
        rm_location_id=rm.location_id,
        rm_location_cd=rm.location_cd,
        rm_location_nm=rm.location_nm,
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
        raise ItemProcError("No item process rows found for selected parent item.")
    inputs: list[ProductionOrderInputWrite] = []
    for step in steps:
        active_inputs = [inp for inp in step.inputs if inp.deleted_at is None]
        active_inputs.sort(key=lambda r: int(r.input_no))
        for inp in active_inputs:
            if inp.from_location_id is None or inp.req_qty is None:
                continue
            req_qty = Decimal(inp.req_qty)
            assigned_lot = pick_oldest_gr_lot_for_item(
                db, int(inp.item_id), location_id=int(inp.from_location_id)
            )
            inputs.append(
                ProductionOrderInputWrite(
                    line_no=int(step.line_no),
                    item_id=int(inp.item_id),
                    from_location_id=int(inp.from_location_id),
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
        processes=[_proc_to_read(db, proc) for proc in steps],
    )


def list_item_process_final_items(db: Session) -> list[ItemProcessFinalItemRead]:
    """Distinct FG items that have at least one active item process row."""
    c1 = Customer.__table__.alias("c1")
    rows = db.execute(
        select(
            Item.item_id,
            Item.item_cd,
            Item.item_nm,
            ItemTyp.itemtyp_cd,
            c1.c.customers_cd,
        )
        .join(ItemProc, ItemProc.item_id == Item.item_id)
        .join(ItemTyp, ItemTyp.itemtyp_id == Item.itemtyp_id)
        .outerjoin(c1, c1.c.customers_id == Item.customer1_id)
        .where(ItemProc.deleted_at.is_(None), Item.deleted_at.is_(None))
        .group_by(
            Item.item_id,
            Item.item_cd,
            Item.item_nm,
            ItemTyp.itemtyp_cd,
            c1.c.customers_cd,
        )
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


def _validate_process_writes(db: Session, processes: list[ItemProcWrite]) -> None:
    seen_lines: set[int] = set()
    for proc in processes:
        if proc.line_no in seen_lines:
            raise ItemProcError(f"Duplicate process line_no {proc.line_no}.")
        seen_lines.add(proc.line_no)
        _get_location_or_error(db, proc.wip_location_id)
        _get_location_or_error(db, proc.rm_location_id)
        _get_item_or_error(db, proc.output_item_id)
        seen_input_nos: set[int] = set()
        for inp in proc.inputs:
            if inp.input_no in seen_input_nos:
                raise ItemProcError(
                    f"Duplicate input_no {inp.input_no} on process line {proc.line_no}."
                )
            seen_input_nos.add(inp.input_no)
            _get_item_or_error(db, inp.item_id)
            if inp.from_location_id is not None:
                _get_location_or_error(db, inp.from_location_id)
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
            rm_location_id=int(proc_write.rm_location_id),
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
                    from_location_id=(
                        int(inp_write.from_location_id)
                        if inp_write.from_location_id is not None
                        else None
                    ),
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
    return get_item_processes(db, item_id)


def import_from_bom(db: Session, item_id: int) -> ItemProcessesOut:
    _get_item_or_error(db, item_id)
    bom_steps = _collect_bom_process_steps(db, item_id)
    if not bom_steps:
        raise ItemProcError("No active BOM rows found for selected item.")
    edges = _iter_bom_edges_to_process_locations(db, item_id)
    itemtyp_fields_by_id = _itemtyp_fields_by_id(db)

    process_writes: list[ItemProcWrite] = []
    for idx, step in enumerate(bom_steps, start=1):
        input_writes: list[ItemProcInputWrite] = []
        input_no = 1
        for bom in edges:
            if int(bom.to_location_id) != int(step.to_location_id):
                continue
            item = _get_item_or_error(db, bom.c_item_id)
            cd, nm = itemtyp_fields_by_id.get(int(item.itemtyp_id), ("", ""))
            if not _is_input_material(cd, nm):
                continue
            input_writes.append(
                ItemProcInputWrite(
                    input_no=input_no,
                    item_id=int(bom.c_item_id),
                    from_location_id=int(bom.from_location_id),
                    req_qty=Decimal(bom.c_req_qty),
                )
            )
            input_no += 1
        process_writes.append(
            ItemProcWrite(
                line_no=idx,
                wip_location_id=int(step.to_location_id),
                rm_location_id=int(step.from_location_id),
                output_item_id=int(step.p_item_id),
                inputs=input_writes,
            )
        )

    return save_item_processes(db, item_id, ItemProcessesSave(processes=process_writes))
