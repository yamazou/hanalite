from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.masters import (
    ItemCreate,
    ItemDetailOut,
    ItemListOut,
    ItemSearchOut,
    ItemTypCreate,
    ItemTypOut,
    ItemProcCreate,
    ItemProcOut,
    ItemProcUpdate,
    LocationCreate,
    LocationOut,
    LocationUpdate,
    ItemUpdate,
    MoveTypCreate,
    MoveTypMasterOut,
    SupplierCreate,
    SupplierOut,
)
from app.services.masters import (
    MasterError,
    create_item,
    create_itemtyp,
    create_location,
    create_movetyp,
    create_supplier,
    delete_item,
    delete_itemtyp,
    delete_location,
    delete_movetyp,
    delete_supplier,
    get_item,
    list_items,
    list_itemtyps,
    list_locations,
    list_movetyps,
    list_suppliers,
    search_items,
    update_item,
    update_location,
    create_itemproc,
    delete_itemproc,
    list_itemprocs,
    update_itemproc,
)

router = APIRouter(prefix="/masters", tags=["masters"])


def _handle_error(e: MasterError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(e))


@router.get("/itemtyps", response_model=list[ItemTypOut])
def api_list_itemtyps(db: Annotated[Session, Depends(get_db)]):
    return list_itemtyps(db)


@router.post("/itemtyps", response_model=ItemTypOut, status_code=201)
def api_create_itemtyp(payload: ItemTypCreate, db: Annotated[Session, Depends(get_db)]):
    try:
        row = create_itemtyp(db, payload)
        db.commit()
        return row
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.delete("/itemtyps/{itemtyp_id}", status_code=204, response_class=Response)
def api_delete_itemtyp(itemtyp_id: int, db: Annotated[Session, Depends(get_db)]):
    try:
        delete_itemtyp(db, itemtyp_id)
        db.commit()
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.get("/suppliers", response_model=list[SupplierOut])
def api_list_suppliers(db: Annotated[Session, Depends(get_db)]):
    return list_suppliers(db)


@router.post("/suppliers", response_model=SupplierOut, status_code=201)
def api_create_supplier(payload: SupplierCreate, db: Annotated[Session, Depends(get_db)]):
    try:
        row = create_supplier(db, payload)
        db.commit()
        return row
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.delete("/suppliers/{suppliers_id}", status_code=204, response_class=Response)
def api_delete_supplier(suppliers_id: int, db: Annotated[Session, Depends(get_db)]):
    try:
        delete_supplier(db, suppliers_id)
        db.commit()
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.get("/movetyps", response_model=list[MoveTypMasterOut])
def api_list_movetyps(db: Annotated[Session, Depends(get_db)]):
    return list_movetyps(db)


@router.post("/movetyps", response_model=MoveTypMasterOut, status_code=201)
def api_create_movetyp(payload: MoveTypCreate, db: Annotated[Session, Depends(get_db)]):
    try:
        row = create_movetyp(db, payload)
        db.commit()
        return row
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.delete("/movetyps/{movetyps_id}", status_code=204, response_class=Response)
def api_delete_movetyp(movetyps_id: int, db: Annotated[Session, Depends(get_db)]):
    try:
        delete_movetyp(db, movetyps_id)
        db.commit()
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.get("/locations", response_model=list[LocationOut])
def api_list_locations(db: Annotated[Session, Depends(get_db)]):
    return list_locations(db)


@router.post("/locations", response_model=LocationOut, status_code=201)
def api_create_location(payload: LocationCreate, db: Annotated[Session, Depends(get_db)]):
    try:
        row = create_location(db, payload)
        db.commit()
        return row
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.delete("/locations/{location_id}", status_code=204, response_class=Response)
def api_delete_location(location_id: int, db: Annotated[Session, Depends(get_db)]):
    try:
        delete_location(db, location_id)
        db.commit()
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.put("/locations/{location_id}", response_model=LocationOut)
def api_update_location(
    location_id: int, payload: LocationUpdate, db: Annotated[Session, Depends(get_db)]
):
    try:
        row = update_location(db, location_id, payload)
        db.commit()
        return row
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.get("/items", response_model=list[ItemListOut])
def api_list_items(db: Annotated[Session, Depends(get_db)]):
    return list_items(db)


@router.get("/items/search", response_model=list[ItemSearchOut])
def api_search_items(
    db: Annotated[Session, Depends(get_db)],
    q: str = Query(..., min_length=1, description="Match item_cd or item_nm"),
    limit: int = Query(default=20, ge=1, le=100),
):
    return search_items(db, q, limit=limit)


@router.get("/items/{item_id}", response_model=ItemDetailOut)
def api_get_item(item_id: int, db: Annotated[Session, Depends(get_db)]):
    try:
        return get_item(db, item_id)
    except MasterError as e:
        raise _handle_error(e) from e


@router.post("/items", response_model=ItemDetailOut, status_code=201)
def api_create_item(payload: ItemCreate, db: Annotated[Session, Depends(get_db)]):
    try:
        row = create_item(db, payload)
        db.commit()
        return row
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.put("/items/{item_id}", response_model=ItemDetailOut)
def api_update_item(item_id: int, payload: ItemUpdate, db: Annotated[Session, Depends(get_db)]):
    try:
        row = update_item(db, item_id, payload)
        db.commit()
        return row
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.delete("/items/{item_id}", status_code=204, response_class=Response)
def api_delete_item(item_id: int, db: Annotated[Session, Depends(get_db)]):
    try:
        delete_item(db, item_id)
        db.commit()
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.get("/itemprocs", response_model=list[ItemProcOut])
def api_list_itemprocs(db: Annotated[Session, Depends(get_db)]):
    return list_itemprocs(db)


@router.post("/itemprocs", response_model=ItemProcOut, status_code=201)
def api_create_itemproc(payload: ItemProcCreate, db: Annotated[Session, Depends(get_db)]):
    try:
        row = create_itemproc(db, payload)
        db.commit()
        return row
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.put("/itemprocs/{itemproc_id}", response_model=ItemProcOut)
def api_update_itemproc(
    itemproc_id: int, payload: ItemProcUpdate, db: Annotated[Session, Depends(get_db)]
):
    try:
        row = update_itemproc(db, itemproc_id, payload)
        db.commit()
        return row
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.delete("/itemprocs/{itemproc_id}", status_code=204, response_class=Response)
def api_delete_itemproc(itemproc_id: int, db: Annotated[Session, Depends(get_db)]):
    try:
        delete_itemproc(db, itemproc_id)
        db.commit()
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e
