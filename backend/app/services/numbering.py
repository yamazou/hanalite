"""Lot number generation from Numbering Pattern masters."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_tenant
from app.models.masters import Item, NumberingElement, NumberingPattern, NumberingSequence
from app.tenant import stamp_new

ELEMENT_SLOT_FIELDS = tuple(f"element_{i}" for i in range(1, 11))


class NumberingError(Exception):
    pass


def lot_needs_auto_number(lot: str | None) -> bool:
    if lot is None:
        return True
    s = lot.strip()
    return s == "" or s == "*"


def _period_key(reset_scope: str, at: datetime) -> str:
    if reset_scope == "daily":
        return at.strftime("%Y%m%d")
    if reset_scope == "monthly":
        return at.strftime("%Y%m")
    if reset_scope == "yearly":
        return at.strftime("%Y")
    return ""


def _element_slots(pattern: NumberingPattern) -> list[str]:
    slots: list[str] = []
    for field in ELEMENT_SLOT_FIELDS:
        raw = getattr(pattern, field)
        if raw and str(raw).strip():
            slots.append(str(raw).strip().upper())
    return slots


def _load_element_map(
    db: Session, element_cds: list[str]
) -> dict[str, NumberingElement]:
    if not element_cds:
        return {}
    ctx = get_tenant()
    rows = db.scalars(
        select(NumberingElement).where(
            NumberingElement.co_id == ctx.co_id,
            NumberingElement.deleted_at.is_(None),
            NumberingElement.numbering_element_cd.in_(element_cds),
        )
    ).all()
    return {row.numbering_element_cd.upper(): row for row in rows}


def preview_numbering_image(
    element_cds: list[str], element_map: dict[str, NumberingElement]
) -> str:
    parts: list[str] = []
    for cd in element_cds:
        el = element_map.get(cd.upper())
        if el is None:
            parts.append(cd)
            continue
        kind = el.element_kind
        if kind == "literal":
            text = (el.literal_text or "").strip()
            parts.append(text if text else (el.preview_sample or "").strip() or cd)
            continue
        sample = (el.preview_sample or "").strip()
        if sample:
            parts.append(sample)
            continue
        if kind.startswith("date_"):
            parts.append(cd)
        elif kind == "item_cd":
            parts.append("ITEM")
        elif kind in ("sequence", "revision"):
            width = el.seq_width or 2
            parts.append("*" * width)
        else:
            parts.append(cd)
    return "".join(parts)[:100]


def _next_sequence_value(
    db: Session,
    *,
    pattern_id: int,
    scope_key: str,
    period_key: str,
) -> int:
    ctx = get_tenant()
    row = db.scalar(
        select(NumberingSequence)
        .where(
            NumberingSequence.co_id == ctx.co_id,
            NumberingSequence.numbering_pattern_id == pattern_id,
            NumberingSequence.scope_key == scope_key,
            NumberingSequence.period_key == period_key,
        )
        .with_for_update()
    )
    now = datetime.now()
    if row is None:
        row = NumberingSequence(
            numbering_pattern_id=pattern_id,
            scope_key=scope_key,
            period_key=period_key,
            last_value=0,
            updated_at=now,
        )
        stamp_new(row, ctx)
        db.add(row)
        db.flush()
    row.last_value = int(row.last_value) + 1
    row.updated_at = now
    return int(row.last_value)


def _resolve_element_value(
    db: Session,
    *,
    element: NumberingElement,
    pattern: NumberingPattern,
    item_cd: str,
    at: datetime,
    revision_no: str | None,
) -> str:
    kind = element.element_kind
    if kind == "date_yy":
        return at.strftime("%y")
    if kind == "date_mm":
        return at.strftime("%m")
    if kind == "date_dd":
        return at.strftime("%d")
    if kind == "date_yyyy":
        return at.strftime("%Y")
    if kind == "item_cd":
        return item_cd
    if kind == "literal":
        return (element.literal_text or "").strip()
    if kind == "revision":
        width = element.seq_width or 2
        raw = (revision_no or "00").strip() or "00"
        return raw[-width:].rjust(width, "0")[:width]
    if kind == "sequence":
        width = element.seq_width or 2
        period = _period_key(pattern.seq_reset_scope, at)
        seq = _next_sequence_value(
            db,
            pattern_id=pattern.numbering_pattern_id,
            scope_key=item_cd,
            period_key=period,
        )
        return str(seq).rjust(width, "0")[-width:]
    raise NumberingError(f"Unknown element kind: {kind}")


def generate_lot_for_item(
    db: Session,
    *,
    item_id: int,
    at: datetime | None = None,
    revision_no: str | None = None,
) -> str | None:
    """Return next lot string for item, or None when no pattern is linked."""
    ctx = get_tenant()
    item = db.scalar(
        select(Item).where(Item.item_id == item_id, Item.co_id == ctx.co_id)
    )
    if not item or item.deleted_at is not None:
        return None
    if item.numbering_pattern_id is None:
        return None
    pattern = db.scalar(
        select(NumberingPattern).where(
            NumberingPattern.numbering_pattern_id == item.numbering_pattern_id,
            NumberingPattern.co_id == ctx.co_id,
            NumberingPattern.deleted_at.is_(None),
        )
    )
    if pattern is None:
        return None
    slots = _element_slots(pattern)
    if not slots:
        return None
    element_map = _load_element_map(db, slots)
    missing = [cd for cd in slots if cd.upper() not in element_map]
    if missing:
        raise NumberingError(f"Numbering element(s) not found: {', '.join(missing)}")
    when = at or datetime.now()
    parts: list[str] = []
    for cd in slots:
        el = element_map[cd.upper()]
        parts.append(
            _resolve_element_value(
                db,
                element=el,
                pattern=pattern,
                item_cd=item.item_cd,
                at=when,
                revision_no=revision_no,
            )
        )
    lot = "".join(parts).strip()
    if not lot:
        raise NumberingError("Generated lot is empty.")
    if len(lot) > 50:
        raise NumberingError("Generated lot exceeds 50 characters.")
    return lot


def resolve_lot_for_item(
    db: Session,
    *,
    item_id: int | None,
    lot: str,
    at: datetime | None = None,
    revision_no: str | None = None,
) -> str:
    """Keep manual lot; auto-generate when blank or '*'."""
    if not lot_needs_auto_number(lot):
        return lot.strip()
    if item_id is None:
        return lot.strip()
    generated = generate_lot_for_item(
        db, item_id=item_id, at=at, revision_no=revision_no
    )
    if generated:
        return generated
    stripped = lot.strip()
    if stripped:
        return stripped
    raise NumberingError("Lot is required (no numbering pattern on item).")
