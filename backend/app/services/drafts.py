from datetime import date, datetime, time

from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.deps import get_tenant
from app.models.drafts import InvReceiptDraft, InvReceiptDraftLine
from app.models.masters import Item, Supplier
from app.schemas.drafts import (
    DraftCreate,
    DraftLineCreate,
    DraftLineRead,
    DraftLineUpsert,
    DraftListItem,
    DraftRead,
    DraftStatus,
    DraftUpdate,
    SourceType,
)
from app.services.draft_item_resolve import (
    resolve_draft_line_item_id,
    validate_lines_item_cd_for_approve,
)
from app.services.draft_search import draft_line_matches_item_q
from app.services.inventory import InventoryError, apply_cancel_reversal, apply_gr
from app.services.masters import MasterError, resolve_location_id
from app.tenant import stamp_new, stamp_update


class DraftServiceError(Exception):
    pass


def _item_ref_from_line(line: DraftLineCreate | DraftLineUpsert) -> tuple[int | None, str | None, str | None]:
    item_id = line.item_id
    item_cd = (line.item_cd or "").strip() or None
    item_nm = (line.item_nm or "").strip() or None
    return item_id, item_cd, item_nm


def _itemtyp_id_by_item_cd(db: Session, cds: set[str]) -> dict[str, int]:
    if not cds:
        return {}
    ctx = get_tenant()
    rows = db.execute(
        select(Item.item_cd, Item.itemtyp_id).where(
            Item.co_id == ctx.co_id,
            Item.deleted_at.is_(None),
            Item.item_cd.in_(list(cds)),
        )
    ).all()
    return {cd: itemtyp_id for cd, itemtyp_id in rows}


def _line_itemtyp_id(
    ln: InvReceiptDraftLine, itemtyp_by_cd: dict[str, int]
) -> int | None:
    if ln.item is not None:
        return ln.item.itemtyp_id
    cd = (ln.item_cd or "").strip()
    if cd:
        return itemtyp_by_cd.get(cd)
    return None


def _draft_to_read(draft: InvReceiptDraft, itemtyp_by_cd: dict[str, int] | None = None) -> DraftRead:
    itemtyp_by_cd = itemtyp_by_cd or {}
    lines = [
        DraftLineRead(
            inv_receipt_draft_line_id=ln.inv_receipt_draft_line_id,
            line_no=ln.line_no,
            item_id=ln.item_id,
            item_cd=ln.item_cd or (ln.item.item_cd if ln.item else None),
            item_nm=ln.item_nm or (ln.item.item_nm if ln.item else None),
            itemtyp_id=_line_itemtyp_id(ln, itemtyp_by_cd),
            location_id=ln.location_id,
            location_cd=ln.location.location_cd if ln.location else None,
            location_nm=ln.location.location_nm if ln.location else None,
            lot=ln.lot,
            qty=ln.qty,
        )
        for ln in draft.lines
        if ln.deleted_at is None
    ]
    return DraftRead(
        inv_receipt_draft_id=draft.inv_receipt_draft_id,
        status=DraftStatus(draft.status),
        receipt_at=draft.receipt_at,
        suppliers_id=draft.suppliers_id,
        supplier_nm=draft.supplier.suppliers_nm if draft.supplier else None,
        reference_no=draft.reference_no,
        notes=draft.notes,
        approved_at=draft.approved_at,
        cancelled_at=draft.cancelled_at,
        created_at=draft.created_at,
        source_type=SourceType(draft.source_type or "manual"),
        attachment_original_name=draft.attachment_original_name,
        has_attachment=bool(draft.attachment_path),
        parse_message=draft.parse_message,
        lines=lines,
    )


def create_draft(
    db: Session,
    payload: DraftCreate,
    *,
    source_type: str = "manual",
    attachment_path: str | None = None,
    attachment_original_name: str | None = None,
    parse_message: str | None = None,
    require_lines: bool = True,
) -> InvReceiptDraft:
    ctx = get_tenant()
    if require_lines and not payload.lines:
        raise DraftServiceError("At least one line is required.")

    now = datetime.now()
    draft = InvReceiptDraft(
        status="registered",
        source_type=source_type,
        receipt_at=payload.receipt_at,
        suppliers_id=payload.suppliers_id,
        reference_no=payload.reference_no,
        notes=payload.notes,
        attachment_path=attachment_path,
        attachment_original_name=attachment_original_name,
        parse_message=parse_message,
        created_at=now,
        updated_at=now,
    )
    stamp_new(draft, ctx)
    db.add(draft)
    db.flush()

    for idx, line in enumerate(payload.lines, start=1):
        _add_line_entity(db, draft.inv_receipt_draft_id, line, idx, now)

    db.commit()
    db.refresh(draft)
    return draft


def _add_line_entity(
    db: Session,
    draft_id: int,
    line: DraftLineCreate,
    default_line_no: int,
    now: datetime,
) -> InvReceiptDraftLine:
    ctx = get_tenant()
    item_id, item_cd, item_nm = _item_ref_from_line(line)
    if item_id is not None:
        item = db.scalar(select(Item).where(Item.item_id == item_id, Item.co_id == ctx.co_id))
        if not item or item.deleted_at is not None:
            raise DraftServiceError(f"Item {item_id} not found.")
        item_cd = item_cd or item.item_cd
        item_nm = item_nm or item.item_nm
    elif not item_cd and not item_nm:
        raise DraftServiceError("item_id or item_cd/item_nm is required.")
    try:
        location_id = resolve_location_id(db, line.location_id)
    except MasterError as e:
        raise DraftServiceError(str(e)) from e
    entity = InvReceiptDraftLine(
        inv_receipt_draft_id=draft_id,
        line_no=line.line_no or default_line_no,
        item_id=item_id,
        item_cd=item_cd,
        item_nm=item_nm,
        location_id=location_id,
        lot=line.lot.strip(),
        qty=line.qty,
        created_at=now,
        updated_at=now,
    )
    stamp_new(entity, ctx)
    db.add(entity)
    return entity


def add_draft_line(db: Session, draft_id: int, line: DraftLineCreate) -> DraftRead:
    ctx = get_tenant()
    draft = db.scalar(
        select(InvReceiptDraft)
        .options(selectinload(InvReceiptDraft.lines))
        .where(
            InvReceiptDraft.co_id == ctx.co_id,
            InvReceiptDraft.inv_receipt_draft_id == draft_id,
            InvReceiptDraft.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if not draft:
        raise DraftServiceError(f"Draft {draft_id} not found.")
    if draft.status != "registered":
        raise DraftServiceError("Lines can only be added to registered drafts.")

    now = datetime.now()
    max_line = max((ln.line_no for ln in draft.lines if ln.deleted_at is None), default=0)
    _add_line_entity(db, draft_id, line, max_line + 1, now)
    db.commit()
    return get_draft(db, draft_id)


def _load_registered_draft_for_update(db: Session, draft_id: int) -> InvReceiptDraft:
    ctx = get_tenant()
    draft = db.scalar(
        select(InvReceiptDraft)
        .options(selectinload(InvReceiptDraft.lines))
        .where(
            InvReceiptDraft.co_id == ctx.co_id,
            InvReceiptDraft.inv_receipt_draft_id == draft_id,
            InvReceiptDraft.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if not draft:
        raise DraftServiceError(f"Draft {draft_id} not found.")
    if draft.status != "registered":
        raise DraftServiceError("Only registered drafts can be edited.")
    return draft


def _apply_line_upsert(
    db: Session,
    draft_id: int,
    draft: InvReceiptDraft,
    lines: list[DraftLineUpsert],
    now: datetime,
) -> None:
    ctx = get_tenant()
    active = {
        ln.inv_receipt_draft_line_id: ln
        for ln in draft.lines
        if ln.deleted_at is None
    }
    kept_ids: set[int] = set()

    for idx, line_in in enumerate(lines, start=1):
        line_no = line_in.line_no or idx
        if line_in.inv_receipt_draft_line_id:
            entity = active.get(line_in.inv_receipt_draft_line_id)
            if not entity:
                raise DraftServiceError(f"Line {line_in.inv_receipt_draft_line_id} not found.")
            item_id, item_cd, item_nm = _item_ref_from_line(line_in)
            if item_id is not None:
                item = db.scalar(
                    select(Item).where(Item.item_id == item_id, Item.co_id == ctx.co_id)
                )
                if not item or item.deleted_at is not None:
                    raise DraftServiceError(f"Item {item_id} not found.")
                item_cd = item_cd or item.item_cd
                item_nm = item_nm or item.item_nm
            elif not item_cd and not item_nm:
                raise DraftServiceError("item_id or item_cd/item_nm is required.")
            try:
                location_id = resolve_location_id(db, line_in.location_id)
            except MasterError as e:
                raise DraftServiceError(str(e)) from e
            entity.item_id = item_id
            entity.item_cd = item_cd
            entity.item_nm = item_nm
            entity.location_id = location_id
            entity.lot = line_in.lot.strip()
            entity.qty = line_in.qty
            entity.line_no = line_no
            stamp_update(entity, ctx)
            kept_ids.add(entity.inv_receipt_draft_line_id)
        else:
            _add_line_entity(db, draft_id, line_in, line_no, now)

    for line_id, entity in active.items():
        if line_id not in kept_ids:
            entity.deleted_at = now
            stamp_update(entity, ctx)


def update_draft(db: Session, draft_id: int, payload: DraftUpdate) -> DraftRead:
    draft = _load_registered_draft_for_update(db, draft_id)
    ctx = get_tenant()
    now = datetime.now()
    draft.receipt_at = payload.receipt_at
    draft.suppliers_id = payload.suppliers_id
    draft.reference_no = payload.reference_no
    draft.notes = payload.notes
    stamp_update(draft, ctx)
    _apply_line_upsert(db, draft_id, draft, payload.lines, now)
    db.commit()
    return get_draft(db, draft_id)


def list_drafts(
    db: Session,
    status: DraftStatus | None = None,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    suppliers_id: int | None = None,
    supplier_q: str | None = None,
    reference_no: str | None = None,
    item_id: int | None = None,
    item_q: str | None = None,
    lot: str | None = None,
) -> list[DraftListItem]:
    ctx = get_tenant()
    stmt = (
        select(
            InvReceiptDraft.inv_receipt_draft_id,
            InvReceiptDraft.status,
            InvReceiptDraft.source_type,
            InvReceiptDraft.receipt_at,
            InvReceiptDraft.reference_no,
            InvReceiptDraft.suppliers_id,
            InvReceiptDraft.notes,
            InvReceiptDraft.approved_at,
            InvReceiptDraft.cancelled_at,
            InvReceiptDraft.created_at,
            InvReceiptDraft.attachment_path,
            InvReceiptDraft.parse_message,
            Supplier.suppliers_nm,
            func.count(InvReceiptDraftLine.inv_receipt_draft_line_id).label("line_count"),
        )
        .outerjoin(Supplier, Supplier.suppliers_id == InvReceiptDraft.suppliers_id)
        .outerjoin(
            InvReceiptDraftLine,
            (InvReceiptDraftLine.inv_receipt_draft_id == InvReceiptDraft.inv_receipt_draft_id)
            & (InvReceiptDraftLine.deleted_at.is_(None)),
        )
        .where(
            InvReceiptDraft.co_id == ctx.co_id,
            InvReceiptDraft.deleted_at.is_(None),
        )
        .group_by(
            InvReceiptDraft.inv_receipt_draft_id,
            InvReceiptDraft.status,
            InvReceiptDraft.source_type,
            InvReceiptDraft.receipt_at,
            InvReceiptDraft.reference_no,
            InvReceiptDraft.suppliers_id,
            InvReceiptDraft.notes,
            InvReceiptDraft.approved_at,
            InvReceiptDraft.cancelled_at,
            InvReceiptDraft.created_at,
            InvReceiptDraft.attachment_path,
            InvReceiptDraft.parse_message,
            Supplier.suppliers_nm,
        )
        .order_by(InvReceiptDraft.created_at.desc())
    )
    if status:
        stmt = stmt.where(InvReceiptDraft.status == status.value)
    if date_from:
        stmt = stmt.where(InvReceiptDraft.receipt_at >= datetime.combine(date_from, time.min))
    if date_to:
        stmt = stmt.where(InvReceiptDraft.receipt_at <= datetime.combine(date_to, time.max))
    if suppliers_id is not None:
        stmt = stmt.where(InvReceiptDraft.suppliers_id == suppliers_id)
    supplier_value = (supplier_q or "").strip()
    if supplier_value:
        stmt = stmt.where(Supplier.suppliers_nm.like(f"%{supplier_value}%"))
    reference_value = (reference_no or "").strip()
    if reference_value:
        stmt = stmt.where(InvReceiptDraft.reference_no.like(f"%{reference_value}%"))
    if item_id is not None:
        stmt = stmt.where(
            exists(
                select(1).where(
                    InvReceiptDraftLine.inv_receipt_draft_id == InvReceiptDraft.inv_receipt_draft_id,
                    InvReceiptDraftLine.item_id == item_id,
                    InvReceiptDraftLine.deleted_at.is_(None),
                )
            )
        )
    item_match = draft_line_matches_item_q(
        co_id=ctx.co_id,
        draft_id_col=InvReceiptDraft.inv_receipt_draft_id,
        line_model=InvReceiptDraftLine,
        line_draft_id_col=InvReceiptDraftLine.inv_receipt_draft_id,
        item_q=item_q,
    )
    if item_match is not None:
        stmt = stmt.where(item_match)
    lot_value = (lot or "").strip()
    if lot_value:
        lot_pattern = f"%{lot_value}%"
        stmt = stmt.where(
            exists(
                select(1).where(
                    InvReceiptDraftLine.inv_receipt_draft_id == InvReceiptDraft.inv_receipt_draft_id,
                    InvReceiptDraftLine.lot.like(lot_pattern),
                    InvReceiptDraftLine.deleted_at.is_(None),
                )
            )
        )

    rows = db.execute(stmt).all()
    return [
        DraftListItem(
            inv_receipt_draft_id=r.inv_receipt_draft_id,
            status=DraftStatus(r.status),
            source_type=SourceType(r.source_type or "manual"),
            receipt_at=r.receipt_at,
            reference_no=r.reference_no,
            suppliers_id=r.suppliers_id,
            supplier_nm=r.suppliers_nm,
            notes=r.notes,
            line_count=int(r.line_count),
            approved_at=r.approved_at,
            cancelled_at=r.cancelled_at,
            created_at=r.created_at,
            has_attachment=bool(r.attachment_path),
            parse_message=r.parse_message,
        )
        for r in rows
    ]


def get_draft(db: Session, draft_id: int) -> DraftRead:
    ctx = get_tenant()
    draft = db.scalar(
        select(InvReceiptDraft)
        .options(
            selectinload(InvReceiptDraft.lines).selectinload(InvReceiptDraftLine.item),
            selectinload(InvReceiptDraft.lines).selectinload(InvReceiptDraftLine.location),
            selectinload(InvReceiptDraft.supplier),
        )
        .where(
            InvReceiptDraft.co_id == ctx.co_id,
            InvReceiptDraft.inv_receipt_draft_id == draft_id,
            InvReceiptDraft.deleted_at.is_(None),
        )
    )
    if not draft:
        raise DraftServiceError(f"Draft {draft_id} not found.")
    active_lines = [ln for ln in draft.lines if ln.deleted_at is None]
    orphan_cds = {
        (ln.item_cd or "").strip()
        for ln in active_lines
        if ln.item is None and ln.item_cd and (ln.item_cd or "").strip()
    }
    itemtyp_by_cd = _itemtyp_id_by_item_cd(db, orphan_cds)
    return _draft_to_read(draft, itemtyp_by_cd)


def approve_draft(db: Session, draft_id: int) -> DraftRead:
    ctx = get_tenant()
    draft = db.scalar(
        select(InvReceiptDraft)
        .options(selectinload(InvReceiptDraft.lines))
        .where(
            InvReceiptDraft.co_id == ctx.co_id,
            InvReceiptDraft.inv_receipt_draft_id == draft_id,
            InvReceiptDraft.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if not draft:
        raise DraftServiceError(f"Draft {draft_id} not found.")
    if draft.status != "registered":
        raise DraftServiceError(f"Draft must be 'registered' to approve (current: {draft.status}).")

    active_lines = [ln for ln in draft.lines if ln.deleted_at is None]
    if not active_lines:
        raise DraftServiceError("Cannot approve: no lines on draft. Add lines first.")

    try:
        validate_lines_item_cd_for_approve(active_lines)
    except MasterError as e:
        raise DraftServiceError(str(e)) from e

    actual_at = draft.receipt_at
    try:
        for line in active_lines:
            try:
                item_id = resolve_draft_line_item_id(db, line)
            except MasterError as e:
                raise DraftServiceError(str(e)) from e
            apply_gr(
                db,
                item_id=item_id,
                location_id=line.location_id,
                lot=line.lot,
                qty=line.qty,
                actual_at=actual_at,
                inv_receipt_draft_id=draft.inv_receipt_draft_id,
            )
        draft.status = "approved"
        draft.approved_at = datetime.now()
        stamp_update(draft, ctx)
        db.commit()
    except InventoryError as e:
        db.rollback()
        raise DraftServiceError(str(e)) from e

    return get_draft(db, draft_id)


def cancel_draft(db: Session, draft_id: int) -> DraftRead:
    ctx = get_tenant()
    draft = db.scalar(
        select(InvReceiptDraft)
        .options(selectinload(InvReceiptDraft.lines))
        .where(
            InvReceiptDraft.co_id == ctx.co_id,
            InvReceiptDraft.inv_receipt_draft_id == draft_id,
            InvReceiptDraft.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if not draft:
        raise DraftServiceError(f"Draft {draft_id} not found.")
    if draft.status == "cancelled":
        raise DraftServiceError("Draft is already cancelled.")

    try:
        if draft.status == "approved":
            actual_at = datetime.now()
            for line in draft.lines:
                if line.deleted_at is not None:
                    continue
                apply_cancel_reversal(
                    db,
                    item_id=line.item_id,
                    location_id=line.location_id,
                    lot=line.lot,
                    qty=line.qty,
                    actual_at=actual_at,
                    inv_receipt_draft_id=draft.inv_receipt_draft_id,
                )
            draft.status = "registered"
            draft.approved_at = None
        elif draft.status == "registered":
            draft.status = "cancelled"
            draft.cancelled_at = datetime.now()
        else:
            raise DraftServiceError(f"Draft cannot be cancelled (current: {draft.status}).")
        stamp_update(draft, ctx)
        db.commit()
    except InventoryError as e:
        db.rollback()
        raise DraftServiceError(str(e)) from e

    return get_draft(db, draft_id)


def restore_draft(db: Session, draft_id: int) -> DraftRead:
    ctx = get_tenant()
    draft = db.scalar(
        select(InvReceiptDraft)
        .where(
            InvReceiptDraft.co_id == ctx.co_id,
            InvReceiptDraft.inv_receipt_draft_id == draft_id,
            InvReceiptDraft.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if not draft:
        raise DraftServiceError(f"Draft {draft_id} not found.")
    if draft.status != "cancelled":
        raise DraftServiceError("Only cancelled drafts can be restored to registered.")

    now = datetime.now()
    draft.status = "registered"
    draft.cancelled_at = None
    stamp_update(draft, ctx)
    db.commit()
    return get_draft(db, draft_id)


def suggest_draft_lots(db: Session, q: str | None = None, *, limit: int = 20) -> list[str]:
    ctx = get_tenant()
    stmt = (
        select(InvReceiptDraftLine.lot)
        .distinct()
        .join(
            InvReceiptDraft,
            InvReceiptDraft.inv_receipt_draft_id == InvReceiptDraftLine.inv_receipt_draft_id,
        )
        .where(
            InvReceiptDraft.co_id == ctx.co_id,
            InvReceiptDraftLine.co_id == ctx.co_id,
            InvReceiptDraft.deleted_at.is_(None),
            InvReceiptDraftLine.deleted_at.is_(None),
        )
        .order_by(InvReceiptDraftLine.lot)
    )
    if q:
        term = q.strip()
        if term:
            stmt = stmt.where(InvReceiptDraftLine.lot.like(f"%{term}%"))
    stmt = stmt.limit(min(max(limit, 1), 50))
    return [row[0] for row in db.execute(stmt).all()]


def delete_draft(db: Session, draft_id: int) -> None:
    ctx = get_tenant()
    draft = db.scalar(
        select(InvReceiptDraft)
        .options(selectinload(InvReceiptDraft.lines))
        .where(
            InvReceiptDraft.co_id == ctx.co_id,
            InvReceiptDraft.inv_receipt_draft_id == draft_id,
            InvReceiptDraft.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if not draft:
        raise DraftServiceError(f"Draft {draft_id} not found.")
    if draft.status not in ("registered", "cancelled"):
        raise DraftServiceError("Only registered or cancelled drafts can be deleted.")

    now = datetime.now()
    for line in draft.lines:
        if line.deleted_at is None:
            line.deleted_at = now
            stamp_update(line, ctx)
    draft.deleted_at = now
    stamp_update(draft, ctx)
    db.commit()
