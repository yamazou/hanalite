from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.deps import require_tenant
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.auth import (
    CompanyMasterCreate,
    CompanyMasterOut,
    CompanyMasterUpdate,
)
from app.schemas.masters import (
    ItemCreate,
    ItemDetailOut,
    ItemListOut,
    ItemSearchOut,
    ItemTypCreate,
    ItemTypOut,
    ItemTypUpdate,
    LocationTypCreate,
    LocationTypOut,
    LocationTypUpdate,
    LocationCreate,
    LocationOut,
    LocationUpdate,
    ItemUpdate,
    MoveTypCreate,
    MoveTypMasterOut,
    MoveTypUpdate,
    NumberingElementCreate,
    NumberingElementOut,
    NumberingElementUpdate,
    NumberingPatternCreate,
    NumberingPatternOut,
    NumberingPatternUpdate,
    CustomerCreate,
    CustomerOut,
    CustomerUpdate,
    SupplierCreate,
    SupplierOut,
    SupplierUpdate,
)
from app.services.auth_service import (
    AuthError,
    create_company,
    delete_company,
    list_companies_master,
    update_company,
)
from app.services.masters import (
    MasterError,
    create_customer,
    create_item,
    create_itemtyp,
    create_location,
    create_locationtyp,
    create_movetyp,
    create_numbering_element,
    create_numbering_pattern,
    create_supplier,
    delete_customer,
    delete_item,
    delete_itemtyp,
    delete_location,
    delete_locationtyp,
    delete_movetyp,
    delete_numbering_element,
    delete_numbering_pattern,
    delete_supplier,
    get_item,
    list_items,
    list_itemtyps,
    list_locations,
    list_locationtyps,
    list_movetyps,
    list_numbering_elements,
    list_numbering_patterns,
    list_customers,
    list_suppliers,
    search_items,
    update_customer,
    update_item,
    update_itemtyp,
    update_location,
    update_locationtyp,
    update_movetyp,
    update_numbering_element,
    update_numbering_pattern,
    update_supplier,
)

router = APIRouter(
    prefix="/masters",
    tags=["masters"],
    dependencies=[Depends(require_tenant)],
)


def _handle_error(e: MasterError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(e))


def _handle_auth_error(e: AuthError) -> HTTPException:
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


@router.put("/itemtyps/{itemtyp_id}", response_model=ItemTypOut)
def api_update_itemtyp(
    itemtyp_id: int, payload: ItemTypUpdate, db: Annotated[Session, Depends(get_db)]
):
    try:
        row = update_itemtyp(db, itemtyp_id, payload)
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


@router.put("/suppliers/{suppliers_id}", response_model=SupplierOut)
def api_update_supplier(
    suppliers_id: int, payload: SupplierUpdate, db: Annotated[Session, Depends(get_db)]
):
    try:
        row = update_supplier(db, suppliers_id, payload)
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


@router.get("/customers", response_model=list[CustomerOut])
def api_list_customers(db: Annotated[Session, Depends(get_db)]):
    return list_customers(db)


@router.post("/customers", response_model=CustomerOut, status_code=201)
def api_create_customer(payload: CustomerCreate, db: Annotated[Session, Depends(get_db)]):
    try:
        row = create_customer(db, payload)
        db.commit()
        return row
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.put("/customers/{customers_id}", response_model=CustomerOut)
def api_update_customer(
    customers_id: int, payload: CustomerUpdate, db: Annotated[Session, Depends(get_db)]
):
    try:
        row = update_customer(db, customers_id, payload)
        db.commit()
        return row
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.delete("/customers/{customers_id}", status_code=204, response_class=Response)
def api_delete_customer(customers_id: int, db: Annotated[Session, Depends(get_db)]):
    try:
        delete_customer(db, customers_id)
        db.commit()
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.get("/locationtyps", response_model=list[LocationTypOut])
def api_list_locationtyps(db: Annotated[Session, Depends(get_db)]):
    return list_locationtyps(db)


@router.post("/locationtyps", response_model=LocationTypOut, status_code=201)
def api_create_locationtyp(
    payload: LocationTypCreate, db: Annotated[Session, Depends(get_db)]
):
    try:
        row = create_locationtyp(db, payload)
        db.commit()
        return row
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.put("/locationtyps/{locationtyp_id}", response_model=LocationTypOut)
def api_update_locationtyp(
    locationtyp_id: int,
    payload: LocationTypUpdate,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        row = update_locationtyp(db, locationtyp_id, payload)
        db.commit()
        return row
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.delete("/locationtyps/{locationtyp_id}", status_code=204, response_class=Response)
def api_delete_locationtyp(
    locationtyp_id: int, db: Annotated[Session, Depends(get_db)]
):
    try:
        delete_locationtyp(db, locationtyp_id)
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


@router.put("/movetyps/{movetyps_id}", response_model=MoveTypMasterOut)
def api_update_movetyp(
    movetyps_id: int, payload: MoveTypUpdate, db: Annotated[Session, Depends(get_db)]
):
    try:
        row = update_movetyp(db, movetyps_id, payload)
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


@router.get("/numbering-elements", response_model=list[NumberingElementOut])
def api_list_numbering_elements(db: Annotated[Session, Depends(get_db)]):
    rows = list_numbering_elements(db)
    db.commit()
    return rows


@router.post("/numbering-elements", response_model=NumberingElementOut, status_code=201)
def api_create_numbering_element(
    payload: NumberingElementCreate, db: Annotated[Session, Depends(get_db)]
):
    try:
        row = create_numbering_element(db, payload)
        db.commit()
        return row
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.put("/numbering-elements/{numbering_element_id}", response_model=NumberingElementOut)
def api_update_numbering_element(
    numbering_element_id: int,
    payload: NumberingElementUpdate,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        row = update_numbering_element(db, numbering_element_id, payload)
        db.commit()
        return row
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.delete("/numbering-elements/{numbering_element_id}", status_code=204, response_class=Response)
def api_delete_numbering_element(
    numbering_element_id: int, db: Annotated[Session, Depends(get_db)]
):
    try:
        delete_numbering_element(db, numbering_element_id)
        db.commit()
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.get("/numbering-patterns", response_model=list[NumberingPatternOut])
def api_list_numbering_patterns(db: Annotated[Session, Depends(get_db)]):
    return list_numbering_patterns(db)


@router.post("/numbering-patterns", response_model=NumberingPatternOut, status_code=201)
def api_create_numbering_pattern(
    payload: NumberingPatternCreate, db: Annotated[Session, Depends(get_db)]
):
    try:
        row = create_numbering_pattern(db, payload)
        db.commit()
        return row
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.put("/numbering-patterns/{numbering_pattern_id}", response_model=NumberingPatternOut)
def api_update_numbering_pattern(
    numbering_pattern_id: int,
    payload: NumberingPatternUpdate,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        row = update_numbering_pattern(db, numbering_pattern_id, payload)
        db.commit()
        return row
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.delete("/numbering-patterns/{numbering_pattern_id}", status_code=204, response_class=Response)
def api_delete_numbering_pattern(
    numbering_pattern_id: int, db: Annotated[Session, Depends(get_db)]
):
    try:
        delete_numbering_pattern(db, numbering_pattern_id)
        db.commit()
    except MasterError as e:
        db.rollback()
        raise _handle_error(e) from e


@router.get("/companies", response_model=list[CompanyMasterOut])
def api_list_companies(db: Annotated[Session, Depends(get_db)]):
    return list_companies_master(db)


@router.post("/companies", response_model=CompanyMasterOut, status_code=201)
def api_create_company(payload: CompanyMasterCreate, db: Annotated[Session, Depends(get_db)]):
    try:
        return create_company(db, payload)
    except AuthError as e:
        db.rollback()
        raise _handle_auth_error(e) from e


@router.put("/companies/{co_id}", response_model=CompanyMasterOut)
def api_update_company(
    co_id: int, payload: CompanyMasterUpdate, db: Annotated[Session, Depends(get_db)]
):
    try:
        return update_company(db, co_id, payload)
    except AuthError as e:
        db.rollback()
        raise _handle_auth_error(e) from e


@router.delete("/companies/{co_id}", status_code=204, response_class=Response)
def api_delete_company(co_id: int, db: Annotated[Session, Depends(get_db)]):
    try:
        delete_company(db, co_id)
    except AuthError as e:
        db.rollback()
        raise _handle_auth_error(e) from e


