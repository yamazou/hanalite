from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.drafts import InvReceiptDraft, InvReceiptDraftLine
from app.models.masters import Item, Supplier
from app.schemas.drafts import (
    DraftCreate,
    DraftLineCreate,
    DraftLineRead,
    DraftListItem,
    DraftRead,
    DraftStatus,
    SourceType,
)
from app.services.inventory import InventoryError, apply_cancel_reversal, apply_gr


class DraftServiceError(Exception):
    pass


def _draft_to_read(draft: InvReceiptDraft) -> DraftRead:
    lines = [
        DraftLineRead(
            inv_receipt_draft_line_id=ln.inv_receipt_draft_line_id,
            line_no=ln.line_no,
            item_id=ln.item_id,
            item_nm=ln.item.item_nm if ln.item else None,
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
    item = db.get(Item, line.item_id)
    if not item or item.deleted_at is not None:
        raise DraftServiceError(f"Item {line.item_id} not found.")
    entity = InvReceiptDraftLine(
        inv_receipt_draft_id=draft_id,
        line_no=line.line_no or default_line_no,
        item_id=line.item_id,
        lot=line.lot.strip(),
        qty=line.qty,
        created_at=now,
        updated_at=now,
    )
    db.add(entity)
    return entity


def add_draft_line(db: Session, draft_id: int, line: DraftLineCreate) -> DraftRead:
    draft = db.scalar(
        select(InvReceiptDraft)
        .options(selectinload(InvReceiptDraft.lines))
        .where(
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


def list_drafts(db: Session, status: DraftStatus | None = None) -> list[DraftListItem]:
    stmt = (
        select(
            InvReceiptDraft.inv_receipt_draft_id,
            InvReceiptDraft.status,
            InvReceiptDraft.source_type,
            InvReceiptDraft.receipt_at,
            InvReceiptDraft.reference_no,
            InvReceiptDraft.created_at,
            Supplier.suppliers_nm,
            func.count(InvReceiptDraftLine.inv_receipt_draft_line_id).label("line_count"),
        )
        .outerjoin(Supplier, Supplier.suppliers_id == InvReceiptDraft.suppliers_id)
        .outerjoin(
            InvReceiptDraftLine,
            (InvReceiptDraftLine.inv_receipt_draft_id == InvReceiptDraft.inv_receipt_draft_id)
            & (InvReceiptDraftLine.deleted_at.is_(None)),
        )
        .where(InvReceiptDraft.deleted_at.is_(None))
        .group_by(InvReceiptDraft.inv_receipt_draft_id)
        .order_by(InvReceiptDraft.created_at.desc())
    )
    if status:
        stmt = stmt.where(InvReceiptDraft.status == status.value)

    rows = db.execute(stmt).all()
    return [
        DraftListItem(
            inv_receipt_draft_id=r.inv_receipt_draft_id,
            status=DraftStatus(r.status),
            source_type=SourceType(r.source_type or "manual"),
            receipt_at=r.receipt_at,
            reference_no=r.reference_no,
            supplier_nm=r.suppliers_nm,
            line_count=int(r.line_count),
            created_at=r.created_at,
        )
        for r in rows
    ]


def get_draft(db: Session, draft_id: int) -> DraftRead:
    draft = db.scalar(
        select(InvReceiptDraft)
        .options(
            selectinload(InvReceiptDraft.lines).selectinload(InvReceiptDraftLine.item),
            selectinload(InvReceiptDraft.supplier),
        )
        .where(
            InvReceiptDraft.inv_receipt_draft_id == draft_id,
            InvReceiptDraft.deleted_at.is_(None),
        )
    )
    if not draft:
        raise DraftServiceError(f"Draft {draft_id} not found.")
    return _draft_to_read(draft)


def approve_draft(db: Session, draft_id: int) -> DraftRead:
    draft = db.scalar(
        select(InvReceiptDraft)
        .options(selectinload(InvReceiptDraft.lines))
        .where(
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

    actual_at = draft.receipt_at
    try:
        for line in active_lines:
            apply_gr(
                db,
                item_id=line.item_id,
                lot=line.lot,
                qty=line.qty,
                actual_at=actual_at,
                inv_receipt_draft_id=draft.inv_receipt_draft_id,
            )
        draft.status = "approved"
        draft.approved_at = datetime.now()
        db.commit()
    except InventoryError as e:
        db.rollback()
        raise DraftServiceError(str(e)) from e

    return get_draft(db, draft_id)


def cancel_draft(db: Session, draft_id: int) -> DraftRead:
    draft = db.scalar(
        select(InvReceiptDraft)
        .options(selectinload(InvReceiptDraft.lines))
        .where(
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
                    lot=line.lot,
                    qty=line.qty,
                    actual_at=actual_at,
                    inv_receipt_draft_id=draft.inv_receipt_draft_id,
                )
        draft.status = "cancelled"
        draft.cancelled_at = datetime.now()
        db.commit()
    except InventoryError as e:
        db.rollback()
        raise DraftServiceError(str(e)) from e

    return get_draft(db, draft_id)
