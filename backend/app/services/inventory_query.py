"""Inventory read models and balance snapshots."""

from __future__ import annotations

import re
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.inventory import InvBalance, InvCurrent, InvGrgi, MoveTyp
from app.models.masters import Item, ItemTyp, Location
from app.schemas.inventory import (
    BalanceItem,
    CurrentStockItem,
    GrgiHistoryItem,
    LotTraceBalance,
    LotTraceCurrent,
    LotTraceHistory,
    LotTraceResult,
)


class InventoryQueryError(Exception):
    pass


_FAR_FUTURE = datetime(9999, 12, 31, 23, 59, 59)


def _gr_dates_by_lot_subquery():
    """Earliest GR actual_at per item, location, and lot."""
    return (
        select(
            InvGrgi.item_id.label("gr_item_id"),
            InvGrgi.location_id.label("gr_location_id"),
            InvGrgi.lot.label("gr_lot"),
            func.min(InvGrgi.actual_at).label("gr_date"),
        )
        .join(MoveTyp, MoveTyp.movetyps_id == InvGrgi.movetyps_id)
        .where(
            InvGrgi.deleted_at.is_(None),
            MoveTyp.deleted_at.is_(None),
            func.upper(MoveTyp.movetyps_cd) == "GR",
        )
        .group_by(InvGrgi.item_id, InvGrgi.location_id, InvGrgi.lot)
    ).subquery()


def pick_oldest_gr_lot_for_item(
    db: Session,
    item_id: int,
    *,
    location_id: int | None = None,
) -> str | None:
    """FIFO lot from current stock (qty > 0) by earliest GR date."""
    gr_dates = _gr_dates_by_lot_subquery()

    def _pick(*, loc_id: int | None) -> str | None:
        stmt = (
            select(InvCurrent.lot)
            .select_from(InvCurrent)
            .outerjoin(
                gr_dates,
                (gr_dates.c.gr_item_id == InvCurrent.item_id)
                & (gr_dates.c.gr_location_id == InvCurrent.location_id)
                & (gr_dates.c.gr_lot == InvCurrent.lot),
            )
            .where(
                InvCurrent.item_id == item_id,
                InvCurrent.deleted_at.is_(None),
                InvCurrent.qty > 0,
            )
        )
        if loc_id is not None:
            stmt = stmt.where(InvCurrent.location_id == loc_id)
        stmt = stmt.order_by(
            func.coalesce(gr_dates.c.gr_date, _FAR_FUTURE).asc(),
            InvCurrent.lot.asc(),
        ).limit(1)
        return db.scalar(stmt)

    if location_id is not None:
        found = _pick(loc_id=location_id)
        if found:
            return found
    return _pick(loc_id=None)


def list_current_stock(
    db: Session,
    *,
    lot: str | None = None,
    item_q: str | None = None,
    location_q: str | None = None,
    include_zero: bool = False,
) -> list[CurrentStockItem]:
    gr_dates = _gr_dates_by_lot_subquery()

    stmt = (
        select(
            InvCurrent,
            Item.item_cd,
            Item.item_nm,
            Item.itemtyp_id,
            ItemTyp.itemtyp_nm,
            Location.location_cd,
            Location.location_nm,
            gr_dates.c.gr_date,
        )
        .join(Item, Item.item_id == InvCurrent.item_id)
        .join(ItemTyp, ItemTyp.itemtyp_id == Item.itemtyp_id)
        .join(Location, Location.location_id == InvCurrent.location_id)
        .outerjoin(
            gr_dates,
            (gr_dates.c.gr_item_id == InvCurrent.item_id)
            & (gr_dates.c.gr_location_id == InvCurrent.location_id)
            & (gr_dates.c.gr_lot == InvCurrent.lot),
        )
        .where(InvCurrent.deleted_at.is_(None), Item.deleted_at.is_(None))
    )
    if not include_zero:
        stmt = stmt.where(InvCurrent.qty > 0)
    if lot:
        lot_term = lot.strip()
        if lot_term:
            stmt = stmt.where(InvCurrent.lot.like(f"%{lot_term}%"))
    if item_q:
        item_term = item_q.strip()
        if item_term:
            item_pattern = f"%{item_term}%"
            item_label = func.concat(Item.item_cd, " - ", Item.item_nm)
            stmt = stmt.where(
                or_(
                    Item.item_cd.like(item_pattern),
                    Item.item_nm.like(item_pattern),
                    item_label.like(item_pattern),
                )
            )
    if location_q:
        location_term = location_q.strip()
        if location_term:
            location_pattern = f"%{location_term}%"
            stmt = stmt.where(
                or_(
                    Location.location_cd.like(location_pattern),
                    Location.location_nm.like(location_pattern),
                )
            )
    stmt = stmt.order_by(InvCurrent.location_id, InvCurrent.lot, InvCurrent.item_id)

    rows = db.execute(stmt).all()
    return [
        CurrentStockItem(
            inv_current_id=c.inv_current_id,
            item_id=c.item_id,
            location_id=c.location_id,
            location_cd=location_cd,
            location_nm=location_nm,
            item_cd=item_cd,
            item_nm=item_nm,
            itemtyp_id=itemtyp_id,
            itemtyp_nm=itemtyp_nm,
            lot=c.lot,
            gr_date=gr_date,
            qty=c.qty,
            updated_at=c.updated_at,
        )
        for c, item_cd, item_nm, itemtyp_id, itemtyp_nm, location_cd, location_nm, gr_date in rows
    ]


def suggest_current_lots(db: Session, q: str | None = None, *, limit: int = 20) -> list[str]:
    stmt = (
        select(InvCurrent.lot)
        .distinct()
        .where(InvCurrent.deleted_at.is_(None))
        .order_by(InvCurrent.lot)
    )
    if q:
        term = q.strip()
        if term:
            stmt = stmt.where(InvCurrent.lot.like(f"%{term}%"))
    stmt = stmt.limit(min(max(limit, 1), 50))
    return [row[0] for row in db.execute(stmt).all()]


def list_grgi_history(
    db: Session, limit: int = 50, location_id: int | None = None
) -> list[GrgiHistoryItem]:
    stmt = (
        select(
            InvGrgi,
            Item.item_nm,
            MoveTyp.movetyps_cd,
            MoveTyp.movetyps_nm,
            Location.location_cd,
            Location.location_nm,
        )
        .join(Item, Item.item_id == InvGrgi.item_id)
        .join(MoveTyp, MoveTyp.movetyps_id == InvGrgi.movetyps_id)
        .join(Location, Location.location_id == InvGrgi.location_id)
        .where(InvGrgi.deleted_at.is_(None))
    )
    if location_id:
        stmt = stmt.where(InvGrgi.location_id == location_id)
    stmt = stmt.order_by(InvGrgi.actual_at.desc(), InvGrgi.inv_grgi_id.desc()).limit(limit)
    rows = db.execute(stmt).all()
    return [
        GrgiHistoryItem(
            inv_grgi_id=g.inv_grgi_id,
            item_id=g.item_id,
            location_id=g.location_id,
            location_cd=location_cd,
            location_nm=location_nm,
            item_nm=item_nm,
            lot=g.lot,
            move_qty=g.move_qty,
            qty=g.qty,
            movetyps_cd=movetyp_cd,
            movetyps_nm=movetyp_nm,
            actual_at=g.actual_at,
            created_at=g.created_at,
        )
        for g, item_nm, movetyp_cd, movetyp_nm, location_cd, location_nm in rows
    ]


def trace_lot(db: Session, lot: str, location_id: int | None = None) -> LotTraceResult:
    lot = lot.strip()
    if not lot:
        raise InventoryQueryError("Lot number is required.")

    current_rows = db.execute(
        select(
            InvCurrent,
            Item.item_nm,
            Item.itemtyp_id,
            ItemTyp.itemtyp_nm,
            Location.location_cd,
            Location.location_nm,
        )
        .join(Item, Item.item_id == InvCurrent.item_id)
        .join(ItemTyp, ItemTyp.itemtyp_id == Item.itemtyp_id)
        .join(Location, Location.location_id == InvCurrent.location_id)
        .where(InvCurrent.deleted_at.is_(None), InvCurrent.lot == lot)
        .order_by(InvCurrent.location_id, InvCurrent.item_id)
    ).all()

    history_rows = db.execute(
        select(
            InvGrgi,
            Item.item_nm,
            MoveTyp.movetyps_cd,
            MoveTyp.movetyps_nm,
            Location.location_cd,
            Location.location_nm,
        )
        .join(Item, Item.item_id == InvGrgi.item_id)
        .join(MoveTyp, MoveTyp.movetyps_id == InvGrgi.movetyps_id)
        .join(Location, Location.location_id == InvGrgi.location_id)
        .where(InvGrgi.deleted_at.is_(None), InvGrgi.lot == lot)
        .order_by(InvGrgi.actual_at.asc(), InvGrgi.inv_grgi_id.asc())
    ).all()

    balance_rows = db.execute(
        select(InvBalance, Item.item_nm, Location.location_cd, Location.location_nm)
        .join(Item, Item.item_id == InvBalance.item_id)
        .join(Location, Location.location_id == InvBalance.location_id)
        .where(InvBalance.deleted_at.is_(None), InvBalance.lot == lot)
        .order_by(InvBalance.period_year_month.desc())
    ).all()
    if location_id:
        current_rows = [row for row in current_rows if row[0].location_id == location_id]
        history_rows = [row for row in history_rows if row[0].location_id == location_id]
        balance_rows = [row for row in balance_rows if row[0].location_id == location_id]

    return LotTraceResult(
        lot=lot,
        current=[
            LotTraceCurrent(
                item_id=c.item_id,
                location_id=c.location_id,
                location_cd=location_cd,
                location_nm=location_nm,
                item_nm=item_nm,
                itemtyp_id=itemtyp_id,
                itemtyp_nm=itemtyp_nm,
                lot=c.lot,
                qty=c.qty,
                updated_at=c.updated_at,
            )
            for c, item_nm, itemtyp_id, itemtyp_nm, location_cd, location_nm in current_rows
        ],
        history=[
            LotTraceHistory(
                inv_grgi_id=g.inv_grgi_id,
                item_id=g.item_id,
                location_id=g.location_id,
                location_cd=location_cd,
                location_nm=location_nm,
                item_nm=item_nm,
                movetyps_cd=movetyp_cd,
                movetyps_nm=movetyp_nm,
                move_qty=g.move_qty,
                qty=g.qty,
                actual_at=g.actual_at,
                created_at=g.created_at,
            )
            for g, item_nm, movetyp_cd, movetyp_nm, location_cd, location_nm in history_rows
        ],
        balances=[
            LotTraceBalance(
                period_year_month=b.period_year_month,
                item_id=b.item_id,
                location_id=b.location_id,
                location_cd=location_cd,
                location_nm=location_nm,
                item_nm=item_nm,
                lot=b.lot,
                beg_at=b.beg_at,
                beg_qty=b.beg_qty,
                qty=b.qty,
            )
            for b, item_nm, location_cd, location_nm in balance_rows
        ],
    )


def list_balances(
    db: Session,
    period: str | None = None,
    location_id: int | None = None,
    location_q: str | None = None,
) -> list[BalanceItem]:
    stmt = (
        select(InvBalance, Item.item_nm, Location.location_cd, Location.location_nm)
        .join(Item, Item.item_id == InvBalance.item_id)
        .join(Location, Location.location_id == InvBalance.location_id)
        .where(InvBalance.deleted_at.is_(None))
    )
    if period:
        stmt = stmt.where(InvBalance.period_year_month == period)
    if location_id:
        stmt = stmt.where(InvBalance.location_id == location_id)
    location_value = (location_q or "").strip()
    if location_value:
        location_pattern = f"%{location_value}%"
        stmt = stmt.where(
            or_(
                Location.location_cd.like(location_pattern),
                Location.location_nm.like(location_pattern),
            )
        )
    stmt = stmt.order_by(
        InvBalance.period_year_month.desc(), InvBalance.location_id, InvBalance.lot, InvBalance.item_id
    )
    rows = db.execute(stmt).all()
    return [
        BalanceItem(
            inv_balance_id=b.inv_balance_id,
            period_year_month=b.period_year_month,
            item_id=b.item_id,
            location_id=b.location_id,
            location_cd=location_cd,
            location_nm=location_nm,
            item_nm=item_nm,
            lot=b.lot,
            beg_at=b.beg_at,
            beg_qty=b.beg_qty,
            qty=b.qty,
        )
        for b, item_nm, location_cd, location_nm in rows
    ]


def create_period_balance(db: Session, period: str, location_id: int | None = None) -> int:
    if not re.match(r"^\d{6}$", period):
        raise InventoryQueryError("Period must be YYYYMM format.")

    year = int(period[:4])
    month = int(period[4:6])
    beg_at = datetime(year, month, 1)

    currents_stmt = select(InvCurrent).where(InvCurrent.deleted_at.is_(None), InvCurrent.qty > 0)
    if location_id:
        currents_stmt = currents_stmt.where(InvCurrent.location_id == location_id)
    currents = db.scalars(currents_stmt).all()

    now = datetime.now()
    count = 0
    for c in currents:
        existing = db.scalar(
            select(InvBalance).where(
                InvBalance.period_year_month == period,
                InvBalance.item_id == c.item_id,
                InvBalance.location_id == c.location_id,
                InvBalance.lot == c.lot,
            )
        )
        if existing:
            existing.qty = c.qty
            existing.beg_qty = c.qty
            existing.beg_at = beg_at
            existing.updated_at = now
            existing.deleted_at = None
        else:
            db.add(
                InvBalance(
                    period_year_month=period,
                    item_id=c.item_id,
                    location_id=c.location_id,
                    qty=c.qty,
                    lot=c.lot,
                    beg_at=beg_at,
                    beg_qty=c.qty,
                    created_at=now,
                    updated_at=now,
                )
            )
        count += 1
    db.commit()
    return count


def list_movetyps_for_manual(db: Session) -> list[MoveTyp]:
    return list(
        db.scalars(
            select(MoveTyp)
            .where(MoveTyp.deleted_at.is_(None), MoveTyp.movetyps_cd.in_(["GR", "GI", "MV"]))
            .order_by(MoveTyp.movetyps_id)
        ).all()
    )
