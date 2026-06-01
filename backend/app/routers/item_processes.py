from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.itemprocs import (
    ItemProcessFinalItemRead,
    ItemProcessFinalItemsSave,
    ItemProcessesOut,
    ItemProcessesSave,
)
from app.services.itemprocs import (
    ItemProcError,
    get_item_processes,
    list_item_process_final_items,
    save_item_process_final_items,
    save_item_processes,
)

router = APIRouter(prefix="/masters/items", tags=["item-processes"])


def _handle_error(e: ItemProcError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(e))


@router.get("/processes/final-items", response_model=list[ItemProcessFinalItemRead])
def api_list_item_process_final_items(db: Annotated[Session, Depends(get_db)]):
    return list_item_process_final_items(db)


@router.put("/processes/final-items", response_model=list[ItemProcessFinalItemRead])
def api_save_item_process_final_items(
    payload: ItemProcessFinalItemsSave,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        rows = save_item_process_final_items(db, payload)
        db.commit()
        return rows
    except ItemProcError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.get("/{item_id}/processes", response_model=ItemProcessesOut)
def api_get_item_processes(item_id: int, db: Annotated[Session, Depends(get_db)]):
    try:
        return get_item_processes(db, item_id)
    except ItemProcError as e:
        raise _handle_error(e) from e


@router.put("/{item_id}/processes", response_model=ItemProcessesOut)
def api_save_item_processes(
    item_id: int,
    payload: ItemProcessesSave,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        row = save_item_processes(db, item_id, payload)
        db.commit()
        return row
    except ItemProcError as e:
        db.rollback()
        raise _handle_error(e) from e


