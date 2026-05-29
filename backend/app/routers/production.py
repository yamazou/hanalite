from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.production import (
    ProductionOrderCompleteLineIn,
    ProductionOrderCreate,
    ProductionOrderListItem,
    ProductionOrderRead,
    ProductionOrderRecalculateIn,
    ProductionOrderUpdate,
)
from app.services.production import (
    ProductionError,
    approve_order,
    cancel_order,
    restore_order,
    complete_line,
    complete_order,
    create_order,
    delete_order,
    get_order,
    list_orders,
    recalculate_inputs,
    update_order,
)
from app.services.production_excel_import import (
    ProductionExcelImportError,
    parse_excel_to_production_create,
)

router = APIRouter(prefix="/production/orders", tags=["production"])


def _handle_error(e: ProductionError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=list[ProductionOrderListItem])
def api_list_orders(
    db: Annotated[Session, Depends(get_db)],
    status: str | None = Query(default=None),
):
    return list_orders(db, status=status)


@router.get("/{order_id}", response_model=ProductionOrderRead)
def api_get_order(order_id: int, db: Annotated[Session, Depends(get_db)]):
    try:
        return get_order(db, order_id)
    except ProductionError as e:
        raise _handle_error(e) from e


@router.post("", response_model=ProductionOrderRead, status_code=201)
def api_create_order(payload: ProductionOrderCreate, db: Annotated[Session, Depends(get_db)]):
    try:
        row = create_order(db, payload)
        db.commit()
        return row
    except ProductionError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.post("/import", response_model=ProductionOrderRead, status_code=201)
async def api_import_order_excel(
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(..., description="Excel .xlsx file"),
):
    filename = (file.filename or "").lower()
    if not filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files are supported.")
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file.")
    try:
        payload = parse_excel_to_production_create(db, raw)
        row = create_order(db, payload)
        db.commit()
        return row
    except (ProductionExcelImportError, ProductionError) as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.put("/{order_id}", response_model=ProductionOrderRead)
def api_update_order(
    order_id: int,
    payload: ProductionOrderUpdate,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        row = update_order(db, order_id, payload)
        db.commit()
        return row
    except ProductionError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.post("/{order_id}/recalculate-inputs", response_model=ProductionOrderRead)
def api_recalculate_inputs(
    order_id: int,
    payload: ProductionOrderRecalculateIn,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        row = recalculate_inputs(db, order_id, payload)
        db.commit()
        return row
    except ProductionError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.post("/{order_id}/lines/{line_id}/complete", response_model=ProductionOrderRead)
def api_complete_line(
    order_id: int,
    line_id: int,
    payload: ProductionOrderCompleteLineIn,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        row = complete_line(db, order_id, line_id, actual_qty=Decimal(payload.actual_qty))
        db.commit()
        return row
    except ProductionError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.post("/{order_id}/complete", response_model=ProductionOrderRead)
def api_complete_order(
    order_id: int,
    payload: ProductionOrderCompleteLineIn,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        row = complete_order(db, order_id, actual_qty=Decimal(payload.actual_qty))
        db.commit()
        return row
    except ProductionError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.post("/{order_id}/approve", response_model=ProductionOrderRead)
def api_approve_order(order_id: int, db: Annotated[Session, Depends(get_db)]):
    try:
        row = approve_order(db, order_id)
        db.commit()
        return row
    except ProductionError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.post("/{order_id}/cancel", response_model=ProductionOrderRead)
def api_cancel_order(order_id: int, db: Annotated[Session, Depends(get_db)]):
    try:
        row = cancel_order(db, order_id)
        db.commit()
        return row
    except ProductionError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.post("/{order_id}/restore", response_model=ProductionOrderRead)
def api_restore_order(order_id: int, db: Annotated[Session, Depends(get_db)]):
    try:
        row = restore_order(db, order_id)
        db.commit()
        return row
    except ProductionError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.delete("/{order_id}", status_code=204)
def api_delete_order(order_id: int, db: Annotated[Session, Depends(get_db)]):
    try:
        delete_order(db, order_id)
        db.commit()
    except ProductionError as e:
        db.rollback()
        raise _handle_error(e) from e
