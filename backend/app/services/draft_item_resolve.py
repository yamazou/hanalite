"""Resolve or create master items from draft line references at approve time."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.drafts import InvReceiptDraftLine, SlsDeliveryDraftLine
from app.models.masters import Item, ItemTyp
from app.schemas.masters import ItemCreate
from app.services.masters import MasterError, _normalize_item_cd, _validate_item_cd_unique, create_item

ITEM_CD_REQUIRED_FOR_APPROVE = (
    "Please enter the item code. This code will be used to generate the master."
)


def line_item_cd(line: InvReceiptDraftLine | SlsDeliveryDraftLine) -> str:
    return (line.item_cd or "").strip()


def validate_lines_item_cd_for_approve(
    lines: list[InvReceiptDraftLine] | list[SlsDeliveryDraftLine],
) -> None:
    for line in lines:
        if not line_item_cd(line):
            raise MasterError(ITEM_CD_REQUIRED_FOR_APPROVE)


def _default_itemtyp_id(db: Session) -> int:
    row = db.scalar(
        select(ItemTyp.itemtyp_id).where(ItemTyp.deleted_at.is_(None)).order_by(ItemTyp.itemtyp_id).limit(1)
    )
    if not row:
        raise MasterError("No item type in master. Create an item type first.")
    return int(row)


def _line_cd_nm(line: InvReceiptDraftLine | SlsDeliveryDraftLine) -> tuple[str | None, str | None]:
    cd = line_item_cd(line) or None
    nm = (line.item_nm or "").strip() or None
    return cd, nm


def resolve_draft_line_item_id(db: Session, line: InvReceiptDraftLine | SlsDeliveryDraftLine) -> int:
    """Ensure m_items row exists; update master from draft line code/name when approving."""
    cd, nm = _line_cd_nm(line)

    if line.item_id:
        item = db.get(Item, line.item_id)
        if item and item.deleted_at is None:
            if cd and item.item_cd != _normalize_item_cd(cd):
                _validate_item_cd_unique(db, cd, exclude_item_id=item.item_id)
                item.item_cd = _normalize_item_cd(cd)
            if nm:
                item.item_nm = nm.strip()
            line.item_id = item.item_id
            return item.item_id

    if cd:
        code = _normalize_item_cd(cd)
        existing = db.scalar(select(Item).where(Item.item_cd == code, Item.deleted_at.is_(None)))
        if existing:
            if nm:
                existing.item_nm = nm.strip()
            line.item_id = existing.item_id
            line.item_cd = existing.item_cd
            return existing.item_id

    if not cd:
        raise MasterError(ITEM_CD_REQUIRED_FOR_APPROVE)
    if not nm:
        nm = cd

    try:
        created = create_item(
            db,
            ItemCreate(
                item_cd=cd,
                item_nm=nm,
                itemtyp_id=_default_itemtyp_id(db),
            ),
        )
    except IntegrityError as e:
        raise MasterError("Item code already exists.") from e

    line.item_id = created.item_id
    line.item_cd = created.item_cd
    line.item_nm = created.item_nm
    return created.item_id
