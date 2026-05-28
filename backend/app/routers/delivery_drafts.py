from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.delivery_drafts import (
    DeliveryDraftCreate,
    DeliveryDraftLineCreate,
    DeliveryDraftListItem,
    DeliveryDraftRead,
    DeliveryDraftStatus,
    DeliveryDraftUpdate,
)
from app.services.delivery_drafts import (
    DeliveryDraftServiceError,
    add_delivery_draft_line,
    approve_delivery_draft,
    cancel_delivery_draft,
    create_delivery_draft,
    restore_delivery_draft,
    from_receipt_payload,
    get_delivery_draft,
    list_delivery_drafts,
    update_delivery_draft,
)
from app.services.excel_import import ExcelImportError, build_template_workbook, parse_excel_to_draft_create

router = APIRouter(prefix="/sls-delivery-drafts", tags=["sls-delivery-drafts"])


@router.get("", response_model=list[DeliveryDraftListItem])
def api_list_delivery_drafts(
    db: Annotated[Session, Depends(get_db)],
    status: DeliveryDraftStatus | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    suppliers_id: int | None = Query(default=None, gt=0),
    reference_no: str | None = Query(default=None, max_length=100),
    item_id: int | None = Query(default=None, gt=0),
    lot: str | None = Query(default=None, min_length=1, max_length=50),
):
    return list_delivery_drafts(
        db,
        status=status,
        date_from=date_from,
        date_to=date_to,
        suppliers_id=suppliers_id,
        reference_no=reference_no,
        item_id=item_id,
        lot=lot,
    )


@router.post("", response_model=DeliveryDraftRead, status_code=201)
def api_create_delivery_draft(
    payload: DeliveryDraftCreate,
    db: Annotated[Session, Depends(get_db)],
):
    if not payload.lines:
        raise HTTPException(status_code=400, detail="At least one line is required.")
    try:
        draft = create_delivery_draft(db, payload, source_type="manual", require_lines=True)
        return get_delivery_draft(db, draft.sls_delivery_draft_id)
    except DeliveryDraftServiceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/template")
def download_delivery_template():
    content = build_template_workbook()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="hanalite_delivery_template.xlsx"'},
    )


@router.post("/import", response_model=DeliveryDraftRead, status_code=201)
async def api_import_delivery_excel(
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(..., description="Excel .xlsx file"),
    delivery_at: str | None = Form(default=None),
    suppliers_id: int | None = Form(default=None),
    reference_no: str | None = Form(default=None),
    notes: str | None = Form(default=None),
):
    filename = (file.filename or "").lower()
    if not filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files are supported.")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file.")

    parsed_delivery_at = _parse_form_datetime(delivery_at)

    try:
        parsed_receipt_payload = parse_excel_to_draft_create(
            db,
            raw,
            receipt_at=parsed_delivery_at,
            suppliers_id=suppliers_id,
            reference_no=reference_no,
            notes=notes,
        )
        payload = from_receipt_payload(parsed_receipt_payload)
        draft = create_delivery_draft(db, payload, source_type="excel", require_lines=True)
        return get_delivery_draft(db, draft.sls_delivery_draft_id)
    except ExcelImportError as e:
        msg = str(e)
        if e.row:
            msg = f"Row {e.row}: {msg}"
        raise HTTPException(status_code=400, detail=msg) from e
    except DeliveryDraftServiceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.put("/{draft_id}", response_model=DeliveryDraftRead)
def api_update_delivery_draft(
    draft_id: int,
    payload: DeliveryDraftUpdate,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return update_delivery_draft(db, draft_id, payload)
    except DeliveryDraftServiceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/{draft_id}", response_model=DeliveryDraftRead)
def api_get_delivery_draft(
    draft_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return get_delivery_draft(db, draft_id)
    except DeliveryDraftServiceError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/{draft_id}/lines", response_model=DeliveryDraftRead)
def api_add_delivery_draft_line(
    draft_id: int,
    line: DeliveryDraftLineCreate,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return add_delivery_draft_line(db, draft_id, line)
    except DeliveryDraftServiceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/{draft_id}/approve", response_model=DeliveryDraftRead)
def api_approve_delivery_draft(
    draft_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return approve_delivery_draft(db, draft_id)
    except DeliveryDraftServiceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/{draft_id}/cancel", response_model=DeliveryDraftRead)
def api_cancel_delivery_draft(
    draft_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return cancel_delivery_draft(db, draft_id)
    except DeliveryDraftServiceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/{draft_id}/restore", response_model=DeliveryDraftRead)
def api_restore_delivery_draft(
    draft_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return restore_delivery_draft(db, draft_id)
    except DeliveryDraftServiceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


def _parse_form_datetime(delivery_at: str | None) -> datetime | None:
    if not delivery_at:
        return None
    try:
        return datetime.fromisoformat(delivery_at.replace("Z", "+00:00").split("+")[0])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid delivery_at: {delivery_at}") from e
