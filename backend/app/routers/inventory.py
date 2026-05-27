from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.inventory import MoveTyp
from app.models.masters import Item, Location
from app.schemas.inventory import (
    BalanceCreateResult,
    BalanceItem,
    CurrentStockItem,
    GrgiCreate,
    GrgiHistoryItem,
    LocationMoveCreate,
    LotTraceResult,
    MoveTypOut,
)
from app.services.inventory import InventoryError, apply_location_move, apply_movement_by_movetyp_id
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
    location_id: int | None = Query(default=None),
    include_zero: bool = Query(default=False),
):
    return list_current_stock(
        db,
        lot=lot,
        item_id=item_id,
        location_id=location_id,
        include_zero=include_zero,
    )


@router.get("/grgi", response_model=list[GrgiHistoryItem])
def api_list_grgi(
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
    location_id: int | None = Query(default=None),
):
    return list_grgi_history(db, limit=limit, location_id=location_id)


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
            location_id=payload.location_id,
            lot=payload.lot.strip(),
            move_qty=payload.move_qty,
            movetyps_id=payload.movetyps_id,
            actual_at=payload.actual_at,
        )
        db.commit()
        item_nm = db.get(Item, grgi.item_id)
        location = db.get(Location, grgi.location_id)
        movetyp = db.get(MoveTyp, grgi.movetyps_id)
        return GrgiHistoryItem(
            inv_grgi_id=grgi.inv_grgi_id,
            item_id=grgi.item_id,
            location_id=grgi.location_id,
            location_cd=location.location_cd if location else "",
            location_nm=location.location_nm if location else "",
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


@router.post("/move", response_model=list[GrgiHistoryItem], status_code=201)
def api_move_location(
    payload: LocationMoveCreate,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        out_row, in_row = apply_location_move(
            db,
            item_id=payload.item_id,
            from_location_id=payload.from_location_id,
            to_location_id=payload.to_location_id,
            lot=payload.lot.strip(),
            qty=payload.qty,
            actual_at=payload.actual_at,
        )
        db.commit()
        rows = list_grgi_history(db, limit=20)
        by_id = {r.inv_grgi_id: r for r in rows}
        moved = []
        if out_row.inv_grgi_id in by_id:
            moved.append(by_id[out_row.inv_grgi_id])
        if in_row.inv_grgi_id in by_id:
            moved.append(by_id[in_row.inv_grgi_id])
        return moved
    except InventoryError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/trace", response_model=LotTraceResult)
def api_trace_lot(
    db: Annotated[Session, Depends(get_db)],
    lot: str = Query(..., min_length=1),
    location_id: int | None = Query(default=None),
):
    try:
        return trace_lot(db, lot, location_id=location_id)
    except InventoryQueryError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/balances", response_model=list[BalanceItem])
def api_list_balances(
    db: Annotated[Session, Depends(get_db)],
    period: str | None = Query(default=None, pattern=r"^\d{6}$"),
    location_id: int | None = Query(default=None),
):
    return list_balances(db, period=period, location_id=location_id)


@router.post("/balances", response_model=BalanceCreateResult, status_code=201)
def api_create_balance(
    db: Annotated[Session, Depends(get_db)],
    period: str = Query(..., pattern=r"^\d{6}$", description="YYYYMM"),
    location_id: int | None = Query(default=None),
):
    try:
        count = create_period_balance(db, period, location_id=location_id)
        return BalanceCreateResult(period_year_month=period, rows_saved=count)
    except InventoryQueryError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
