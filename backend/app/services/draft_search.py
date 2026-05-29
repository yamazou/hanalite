"""Draft list search helpers (receipt / delivery)."""

from __future__ import annotations

import re

from sqlalchemy import ColumnElement, and_, exists, func, or_, select
from sqlalchemy.orm import InstrumentedAttribute

from app.models.masters import Item

_ITEM_Q_SPLIT = re.compile(r"[\s\-—/]+", re.UNICODE)


def item_q_tokens(item_q: str | None) -> list[str]:
    if not item_q:
        return []
    return [t for t in _ITEM_Q_SPLIT.split(item_q.strip()) if t]


def draft_line_matches_item_q(
    *,
    draft_id_col: ColumnElement[int],
    line_model: type,
    line_draft_id_col: InstrumentedAttribute[int],
    item_q: str | None,
) -> ColumnElement[bool] | None:
    """EXISTS: at least one non-deleted line on the draft matches item_q."""
    tokens = item_q_tokens(item_q)
    if not tokens:
        return None

    line_cd = func.coalesce(line_model.item_cd, "")
    line_nm = func.coalesce(line_model.item_nm, "")
    line_label_hyphen = func.concat(line_cd, " - ", line_nm)
    line_label_em = func.concat(line_cd, " — ", line_nm)

    master_cd = func.coalesce(Item.item_cd, "")
    master_nm = func.coalesce(Item.item_nm, "")
    master_label_hyphen = func.concat(master_cd, " - ", master_nm)
    master_label_em = func.concat(master_cd, " — ", master_nm)

    def token_predicate(token: str) -> ColumnElement[bool]:
        pattern = f"%{token}%"
        return or_(
            line_model.item_cd.like(pattern),
            line_model.item_nm.like(pattern),
            line_label_hyphen.like(pattern),
            line_label_em.like(pattern),
            Item.item_cd.like(pattern),
            Item.item_nm.like(pattern),
            master_label_hyphen.like(pattern),
            master_label_em.like(pattern),
        )

    return exists(
        select(1)
        .select_from(line_model)
        .outerjoin(Item, Item.item_id == line_model.item_id)
        .where(
            line_draft_id_col == draft_id_col,
            line_model.deleted_at.is_(None),
            or_(Item.item_id.is_(None), Item.deleted_at.is_(None)),
            and_(*(token_predicate(token) for token in tokens)),
        )
    )
