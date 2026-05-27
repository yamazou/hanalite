from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.inventory import MoveTyp
from app.models.masters import Item
from app.schemas.inventory import (
    BalanceCreateResult,
    BalanceItem,
    CurrentStockItem,
    GrgiCreate,
    GrgiHistoryItem,
    LotTraceResult,
    MoveTypOut,
)
from app.services.inventory import InventoryError, apply_movement_by_movetyp_id
from app.services.inventory_query import (
    InventoryQueryError,
    create_period_balance,
    list_balances,
    list_current_stock,
    list_grgi_history,
    list_movetyps_for_manual,
    trace_lot,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/currents", response_model=list[CurrentStockItem])
def api_list_currents(
    db: Annotated[Session, Depends(get_db)],
    lot: str | None = Query(default=None),
    item_id: int | None = Query(default=None),
    include_zero: bool = Query(default=False),
):
    return list_current_stock(db, lot=lot, item_id=item_id, include_zero=include_zero)


@router.get("/grgi", response_model=list[GrgiHistoryItem])
def api_list_grgi(
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
):
    return list_grgi_history(db, limit=limit)


@router.get("/movetyps", response_model=list[MoveTypOut])
def api_list_movetyps(db: Annotated[Session, Depends(get_db)]):
    return list_movetyps_for_manual(db)


@router.post("/grgi", response_model=GrgiHistoryItem, status_code=201)
def api_create_grgi(
    payload: GrgiCreate,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        grgi = apply_movement_by_movetyp_id(
            db,
            item_id=payload.item_id,
            lot=payload.lot.strip(),
            move_qty=payload.move_qty,
            movetyps_id=payload.movetyps_id,
            actual_at=payload.actual_at,
        )
        db.commit()
        item_nm = db.get(Item, grgi.item_id)
        movetyp = db.get(MoveTyp, grgi.movetyps_id)
        return GrgiHistoryItem(
            inv_grgi_id=grgi.inv_grgi_id,
            item_id=grgi.item_id,
            item_nm=item_nm.item_nm if item_nm else "",
            lot=grgi.lot,
            move_qty=grgi.move_qty,
            qty=grgi.qty,
            movetyps_nm=movetyp.movetyps_nm if movetyp else "",
            actual_at=grgi.actual_at,
            created_at=grgi.created_at,
        )
    except InventoryError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/trace", response_model=LotTraceResult)
def api_trace_lot(
    db: Annotated[Session, Depends(get_db)],
    lot: str = Query(..., min_length=1),
):
    try:
        return trace_lot(db, lot)
    except InventoryQueryError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/balances", response_model=list[BalanceItem])
def api_list_balances(
    db: Annotated[Session, Depends(get_db)],
    period: str | None = Query(default=None, pattern=r"^\d{6}$"),
):
    return list_balances(db, period=period)


@router.post("/balances", response_model=BalanceCreateResult, status_code=201)
def api_create_balance(
    db: Annotated[Session, Depends(get_db)],
    period: str = Query(..., pattern=r"^\d{6}$", description="YYYYMM"),
):
    try:
        count = create_period_balance(db, period)
        return BalanceCreateResult(period_year_month=period, rows_saved=count)
    except InventoryQueryError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
