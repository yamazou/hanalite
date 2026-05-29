from datetime import date, datetime, time

from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.drafts import SlsDeliveryDraft, SlsDeliveryDraftLine
from app.models.masters import Item, Supplier
from app.schemas.delivery_drafts import (
    DeliveryDraftCreate,
    DeliveryDraftLineCreate,
    DeliveryDraftLineRead,
    DeliveryDraftLineUpsert,
    DeliveryDraftListItem,
    DeliveryDraftRead,
    DeliveryDraftStatus,
    DeliveryDraftUpdate,
    DeliverySourceType,
)
from app.schemas.drafts import DraftCreate
from app.services.draft_item_resolve import (
    resolve_draft_line_item_id,
    validate_lines_item_cd_for_approve,
)
from app.services.inventory import InventoryError, apply_movement
from app.services.masters import MasterError, resolve_location_id


class DeliveryDraftServiceError(Exception):
    pass


def _item_ref_from_delivery_line(
    line: DeliveryDraftLineCreate | DeliveryDraftLineUpsert,
) -> tuple[int | None, str | None, str | None]:
    item_id = line.item_id
    item_cd = (line.item_cd or "").strip() or None
    item_nm = (line.item_nm or "").strip() or None
    return item_id, item_cd, item_nm


def _delivery_to_read(draft: SlsDeliveryDraft) -> DeliveryDraftRead:
    lines = [
        DeliveryDraftLineRead(
            sls_delivery_draft_line_id=ln.sls_delivery_draft_line_id,
            line_no=ln.line_no,
            item_id=ln.item_id,
            item_cd=ln.item_cd or (ln.item.item_cd if ln.item else None),
            item_nm=ln.item_nm or (ln.item.item_nm if ln.item else None),
            location_id=ln.location_id,
            location_cd=ln.location.location_cd if ln.location else None,
            location_nm=ln.location.location_nm if ln.location else None,
            lot=ln.lot,
            qty=ln.qty,
        )
        for ln in draft.lines
        if ln.deleted_at is None
    ]
    return DeliveryDraftRead(
        sls_delivery_draft_id=draft.sls_delivery_draft_id,
        status=DeliveryDraftStatus(draft.status),
        delivery_at=draft.delivery_at,
        suppliers_id=draft.suppliers_id,
        supplier_nm=draft.supplier.suppliers_nm if draft.supplier else None,
        reference_no=draft.reference_no,
        notes=draft.notes,
        approved_at=draft.approved_at,
        cancelled_at=draft.cancelled_at,
        created_at=draft.created_at,
        source_type=DeliverySourceType(draft.source_type or "manual"),
        lines=lines,
    )


def create_delivery_draft(
    db: Session,
    payload: DeliveryDraftCreate,
    *,
    source_type: str = "manual",
    require_lines: bool = True,
) -> SlsDeliveryDraft:
    if require_lines and not payload.lines:
        raise DeliveryDraftServiceError("At least one line is required.")

    now = datetime.now()
    draft = SlsDeliveryDraft(
        status="registered",
        source_type=source_type,
        delivery_at=payload.delivery_at,
        suppliers_id=payload.suppliers_id,
        reference_no=payload.reference_no,
        notes=payload.notes,
        created_at=now,
        updated_at=now,
    )
    db.add(draft)
    db.flush()

    for idx, line in enumerate(payload.lines, start=1):
        _add_delivery_line_entity(db, draft.sls_delivery_draft_id, line, idx, now)

    db.commit()
    db.refresh(draft)
    return draft


def _add_delivery_line_entity(
    db: Session,
    draft_id: int,
    line: DeliveryDraftLineCreate,
    default_line_no: int,
    now: datetime,
) -> SlsDeliveryDraftLine:
    item_id, item_cd, item_nm = _item_ref_from_delivery_line(line)
    if item_id is not None:
        item = db.get(Item, item_id)
        if not item or item.deleted_at is not None:
            raise DeliveryDraftServiceError(f"Item {item_id} not found.")
        item_cd = item_cd or item.item_cd
        item_nm = item_nm or item.item_nm
    elif not item_cd and not item_nm:
        raise DeliveryDraftServiceError("item_id or item_cd/item_nm is required.")
    try:
        location_id = resolve_location_id(db, line.location_id)
    except MasterError as e:
        raise DeliveryDraftServiceError(str(e)) from e
    entity = SlsDeliveryDraftLine(
        sls_delivery_draft_id=draft_id,
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
    db.add(entity)
    return entity


def add_delivery_draft_line(db: Session, draft_id: int, line: DeliveryDraftLineCreate) -> DeliveryDraftRead:
    draft = db.scalar(
        select(SlsDeliveryDraft)
        .options(selectinload(SlsDeliveryDraft.lines))
        .where(
            SlsDeliveryDraft.sls_delivery_draft_id == draft_id,
            SlsDeliveryDraft.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if not draft:
        raise DeliveryDraftServiceError(f"Draft {draft_id} not found.")
    if draft.status != "registered":
        raise DeliveryDraftServiceError("Lines can only be added to registered drafts.")

    now = datetime.now()
    max_line = max((ln.line_no for ln in draft.lines if ln.deleted_at is None), default=0)
    _add_delivery_line_entity(db, draft_id, line, max_line + 1, now)
    db.commit()
    return get_delivery_draft(db, draft_id)


def _load_registered_delivery_for_update(db: Session, draft_id: int) -> SlsDeliveryDraft:
    draft = db.scalar(
        select(SlsDeliveryDraft)
        .options(selectinload(SlsDeliveryDraft.lines))
        .where(
            SlsDeliveryDraft.sls_delivery_draft_id == draft_id,
            SlsDeliveryDraft.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if not draft:
        raise DeliveryDraftServiceError(f"Draft {draft_id} not found.")
    if draft.status != "registered":
        raise DeliveryDraftServiceError("Only registered drafts can be edited.")
    return draft


def _apply_delivery_line_upsert(
    db: Session,
    draft_id: int,
    draft: SlsDeliveryDraft,
    lines: list[DeliveryDraftLineUpsert],
    now: datetime,
) -> None:
    active = {
        ln.sls_delivery_draft_line_id: ln
        for ln in draft.lines
        if ln.deleted_at is None
    }
    kept_ids: set[int] = set()

    for idx, line_in in enumerate(lines, start=1):
        line_no = line_in.line_no or idx
        if line_in.sls_delivery_draft_line_id:
            entity = active.get(line_in.sls_delivery_draft_line_id)
            if not entity:
                raise DeliveryDraftServiceError(f"Line {line_in.sls_delivery_draft_line_id} not found.")
            item_id, item_cd, item_nm = _item_ref_from_delivery_line(line_in)
            if item_id is not None:
                item = db.get(Item, item_id)
                if not item or item.deleted_at is not None:
                    raise DeliveryDraftServiceError(f"Item {item_id} not found.")
                item_cd = item_cd or item.item_cd
                item_nm = item_nm or item.item_nm
            elif not item_cd and not item_nm:
                raise DeliveryDraftServiceError("item_id or item_cd/item_nm is required.")
            try:
                location_id = resolve_location_id(db, line_in.location_id)
            except MasterError as e:
                raise DeliveryDraftServiceError(str(e)) from e
            entity.item_id = item_id
            entity.item_cd = item_cd
            entity.item_nm = item_nm
            entity.location_id = location_id
            entity.lot = line_in.lot.strip()
            entity.qty = line_in.qty
            entity.line_no = line_no
            entity.updated_at = now
            kept_ids.add(entity.sls_delivery_draft_line_id)
        else:
            _add_delivery_line_entity(db, draft_id, line_in, line_no, now)

    for line_id, entity in active.items():
        if line_id not in kept_ids:
            entity.deleted_at = now
            entity.updated_at = now


def update_delivery_draft(db: Session, draft_id: int, payload: DeliveryDraftUpdate) -> DeliveryDraftRead:
    draft = _load_registered_delivery_for_update(db, draft_id)
    now = datetime.now()
    draft.delivery_at = payload.delivery_at
    draft.suppliers_id = payload.suppliers_id
    draft.reference_no = payload.reference_no
    draft.notes = payload.notes
    draft.updated_at = now
    _apply_delivery_line_upsert(db, draft_id, draft, payload.lines, now)
    db.commit()
    return get_delivery_draft(db, draft_id)


def list_delivery_drafts(
    db: Session,
    status: DeliveryDraftStatus | None = None,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    suppliers_id: int | None = None,
    supplier_q: str | None = None,
    reference_no: str | None = None,
    item_id: int | None = None,
    item_q: str | None = None,
    lot: str | None = None,
) -> list[DeliveryDraftListItem]:
    stmt = (
        select(
            SlsDeliveryDraft.sls_delivery_draft_id,
            SlsDeliveryDraft.status,
            SlsDeliveryDraft.source_type,
            SlsDeliveryDraft.delivery_at,
            SlsDeliveryDraft.reference_no,
            SlsDeliveryDraft.notes,
            SlsDeliveryDraft.approved_at,
            SlsDeliveryDraft.cancelled_at,
            SlsDeliveryDraft.created_at,
            Supplier.suppliers_nm,
            func.count(SlsDeliveryDraftLine.sls_delivery_draft_line_id).label("line_count"),
        )
        .outerjoin(Supplier, Supplier.suppliers_id == SlsDeliveryDraft.suppliers_id)
        .outerjoin(
            SlsDeliveryDraftLine,
            (SlsDeliveryDraftLine.sls_delivery_draft_id == SlsDeliveryDraft.sls_delivery_draft_id)
            & (SlsDeliveryDraftLine.deleted_at.is_(None)),
        )
        .where(SlsDeliveryDraft.deleted_at.is_(None))
        .group_by(SlsDeliveryDraft.sls_delivery_draft_id)
        .order_by(SlsDeliveryDraft.created_at.desc())
    )
    if status:
        stmt = stmt.where(SlsDeliveryDraft.status == status.value)
    if date_from:
        stmt = stmt.where(SlsDeliveryDraft.delivery_at >= datetime.combine(date_from, time.min))
    if date_to:
        stmt = stmt.where(SlsDeliveryDraft.delivery_at <= datetime.combine(date_to, time.max))
    if suppliers_id is not None:
        stmt = stmt.where(SlsDeliveryDraft.suppliers_id == suppliers_id)
    supplier_value = (supplier_q or "").strip()
    if supplier_value:
        stmt = stmt.where(Supplier.suppliers_nm.like(f"%{supplier_value}%"))
    reference_value = (reference_no or "").strip()
    if reference_value:
        stmt = stmt.where(SlsDeliveryDraft.reference_no.like(f"%{reference_value}%"))
    if item_id is not None:
        stmt = stmt.where(
            exists(
                select(1).where(
                    SlsDeliveryDraftLine.sls_delivery_draft_id == SlsDeliveryDraft.sls_delivery_draft_id,
                    SlsDeliveryDraftLine.item_id == item_id,
                    SlsDeliveryDraftLine.deleted_at.is_(None),
                )
            )
        )
    item_value = (item_q or "").strip()
    if item_value:
        item_pattern = f"%{item_value}%"
        item_label = func.concat(Item.item_cd, " - ", Item.item_nm)
        stmt = stmt.where(
            exists(
                select(1)
                .select_from(SlsDeliveryDraftLine)
                .join(Item, Item.item_id == SlsDeliveryDraftLine.item_id)
                .where(
                    SlsDeliveryDraftLine.sls_delivery_draft_id == SlsDeliveryDraft.sls_delivery_draft_id,
                    SlsDeliveryDraftLine.deleted_at.is_(None),
                    or_(
                        Item.item_cd.like(item_pattern),
                        Item.item_nm.like(item_pattern),
                        item_label.like(item_pattern),
                    ),
                )
            )
        )
    lot_value = (lot or "").strip()
    if lot_value:
        lot_pattern = f"%{lot_value}%"
        stmt = stmt.where(
            exists(
                select(1).where(
                    SlsDeliveryDraftLine.sls_delivery_draft_id == SlsDeliveryDraft.sls_delivery_draft_id,
                    SlsDeliveryDraftLine.lot.like(lot_pattern),
                    SlsDeliveryDraftLine.deleted_at.is_(None),
                )
            )
        )

    rows = db.execute(stmt).all()
    return [
        DeliveryDraftListItem(
            sls_delivery_draft_id=r.sls_delivery_draft_id,
            status=DeliveryDraftStatus(r.status),
            source_type=DeliverySourceType(r.source_type or "manual"),
            delivery_at=r.delivery_at,
            reference_no=r.reference_no,
            supplier_nm=r.suppliers_nm,
            notes=r.notes,
            line_count=int(r.line_count),
            approved_at=r.approved_at,
            cancelled_at=r.cancelled_at,
            created_at=r.created_at,
        )
        for r in rows
    ]


def get_delivery_draft(db: Session, draft_id: int) -> DeliveryDraftRead:
    draft = db.scalar(
        select(SlsDeliveryDraft)
        .options(
            selectinload(SlsDeliveryDraft.lines).selectinload(SlsDeliveryDraftLine.item),
            selectinload(SlsDeliveryDraft.lines).selectinload(SlsDeliveryDraftLine.location),
            selectinload(SlsDeliveryDraft.supplier),
        )
        .where(
            SlsDeliveryDraft.sls_delivery_draft_id == draft_id,
            SlsDeliveryDraft.deleted_at.is_(None),
        )
    )
    if not draft:
        raise DeliveryDraftServiceError(f"Draft {draft_id} not found.")
    return _delivery_to_read(draft)


def approve_delivery_draft(db: Session, draft_id: int) -> DeliveryDraftRead:
    draft = db.scalar(
        select(SlsDeliveryDraft)
        .options(selectinload(SlsDeliveryDraft.lines))
        .where(
            SlsDeliveryDraft.sls_delivery_draft_id == draft_id,
            SlsDeliveryDraft.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if not draft:
        raise DeliveryDraftServiceError(f"Draft {draft_id} not found.")
    if draft.status != "registered":
        raise DeliveryDraftServiceError(f"Draft must be 'registered' to approve (current: {draft.status}).")

    active_lines = [ln for ln in draft.lines if ln.deleted_at is None]
    if not active_lines:
        raise DeliveryDraftServiceError("Cannot approve: no lines on draft. Add lines first.")

    try:
        validate_lines_item_cd_for_approve(active_lines)
    except MasterError as e:
        raise DeliveryDraftServiceError(str(e)) from e

    try:
        for line in active_lines:
            try:
                item_id = resolve_draft_line_item_id(db, line)
            except MasterError as e:
                raise DeliveryDraftServiceError(str(e)) from e
            apply_movement(
                db,
                item_id=item_id,
                location_id=line.location_id,
                lot=line.lot,
                move_qty=line.qty,
                movetyps_nm="GI",
                actual_at=draft.delivery_at,
            )
        draft.status = "approved"
        draft.approved_at = datetime.now()
        db.commit()
    except InventoryError as e:
        db.rollback()
        raise DeliveryDraftServiceError(str(e)) from e

    return get_delivery_draft(db, draft_id)


def cancel_delivery_draft(db: Session, draft_id: int) -> DeliveryDraftRead:
    draft = db.scalar(
        select(SlsDeliveryDraft)
        .options(selectinload(SlsDeliveryDraft.lines))
        .where(
            SlsDeliveryDraft.sls_delivery_draft_id == draft_id,
            SlsDeliveryDraft.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if not draft:
        raise DeliveryDraftServiceError(f"Draft {draft_id} not found.")
    if draft.status == "cancelled":
        raise DeliveryDraftServiceError("Draft is already cancelled.")

    try:
        if draft.status == "approved":
            for line in draft.lines:
                if line.deleted_at is not None:
                    continue
                apply_movement(
                    db,
                    item_id=line.item_id,
                    location_id=line.location_id,
                    lot=line.lot,
                    move_qty=line.qty,
                    movetyps_nm="GR",
                    actual_at=datetime.now(),
                )
            draft.status = "registered"
            draft.approved_at = None
        elif draft.status == "registered":
            draft.status = "cancelled"
            draft.cancelled_at = datetime.now()
        else:
            raise DeliveryDraftServiceError(f"Draft cannot be cancelled (current: {draft.status}).")
        db.commit()
    except InventoryError as e:
        db.rollback()
        raise DeliveryDraftServiceError(str(e)) from e

    return get_delivery_draft(db, draft_id)


def restore_delivery_draft(db: Session, draft_id: int) -> DeliveryDraftRead:
    draft = db.scalar(
        select(SlsDeliveryDraft)
        .where(
            SlsDeliveryDraft.sls_delivery_draft_id == draft_id,
            SlsDeliveryDraft.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if not draft:
        raise DeliveryDraftServiceError(f"Draft {draft_id} not found.")
    if draft.status != "cancelled":
        raise DeliveryDraftServiceError("Only cancelled drafts can be restored to registered.")

    now = datetime.now()
    draft.status = "registered"
    draft.cancelled_at = None
    draft.updated_at = now
    db.commit()
    return get_delivery_draft(db, draft_id)


def suggest_delivery_draft_lots(db: Session, q: str | None = None, *, limit: int = 20) -> list[str]:
    stmt = (
        select(SlsDeliveryDraftLine.lot)
        .distinct()
        .join(
            SlsDeliveryDraft,
            SlsDeliveryDraft.sls_delivery_draft_id == SlsDeliveryDraftLine.sls_delivery_draft_id,
        )
        .where(
            SlsDeliveryDraft.deleted_at.is_(None),
            SlsDeliveryDraftLine.deleted_at.is_(None),
        )
        .order_by(SlsDeliveryDraftLine.lot)
    )
    if q:
        term = q.strip()
        if term:
            stmt = stmt.where(SlsDeliveryDraftLine.lot.like(f"%{term}%"))
    stmt = stmt.limit(min(max(limit, 1), 50))
    return [row[0] for row in db.execute(stmt).all()]


def delete_delivery_draft(db: Session, draft_id: int) -> None:
    draft = db.scalar(
        select(SlsDeliveryDraft)
        .options(selectinload(SlsDeliveryDraft.lines))
        .where(
            SlsDeliveryDraft.sls_delivery_draft_id == draft_id,
            SlsDeliveryDraft.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if not draft:
        raise DeliveryDraftServiceError(f"Draft {draft_id} not found.")
    if draft.status != "cancelled":
        raise DeliveryDraftServiceError("Only cancelled drafts can be deleted.")

    now = datetime.now()
    for line in draft.lines:
        if line.deleted_at is None:
            line.deleted_at = now
            line.updated_at = now
    draft.deleted_at = now
    draft.updated_at = now
    db.commit()


def from_receipt_payload(payload: DraftCreate) -> DeliveryDraftCreate:
    return DeliveryDraftCreate(
        delivery_at=payload.receipt_at,
        suppliers_id=payload.suppliers_id,
        reference_no=payload.reference_no,
        notes=payload.notes,
        lines=[
            DeliveryDraftLineCreate(
                item_id=line.item_id,
                location_id=line.location_id,
                lot=line.lot,
                qty=line.qty,
                line_no=line.line_no,
            )
            for line in payload.lines
        ],
    )
