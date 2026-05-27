from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.boms import BomCreate, BomOut, BomUpdate
from app.services.boms import BomError, create_bom, delete_bom, list_boms, update_bom

router = APIRouter(prefix="/boms", tags=["boms"])


def _handle_error(e: BomError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=list[BomOut])
def api_list_boms(
    db: Annotated[Session, Depends(get_db)],
    p_item_id: int | None = Query(default=None, gt=0),
):
    return list_boms(db, p_item_id=p_item_id)


@router.post("", response_model=BomOut, status_code=201)
def api_create_bom(payload: BomCreate, db: Annotated[Session, Depends(get_db)]):
    try:
        row = create_bom(db, payload)
        db.commit()
        return row
    except BomError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.put("/{bom_id}", response_model=BomOut)
def api_update_bom(
    bom_id: int,
    payload: BomUpdate,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        row = update_bom(db, bom_id, payload)
        db.commit()
        return row
    except BomError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.delete("/{bom_id}", status_code=204, response_class=Response)
def api_delete_bom(bom_id: int, db: Annotated[Session, Depends(get_db)]):
    try:
        delete_bom(db, bom_id)
        db.commit()
    except BomError as e:
        db.rollback()
        raise _handle_error(e) from e
