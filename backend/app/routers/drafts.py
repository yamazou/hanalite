from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from sqlalchemy import select

from app.database import get_db
from app.models.drafts import InvReceiptDraft
from app.schemas.drafts import DraftCreate, DraftLineCreate, DraftListItem, DraftRead, DraftStatus
from app.services.drafts import (
    DraftServiceError,
    add_draft_line,
    approve_draft,
    cancel_draft,
    create_draft,
    get_draft,
    list_drafts,
)
from app.services.excel_import import ExcelImportError, build_template_workbook, parse_excel_to_draft_create
from app.services.pdf_import import (
    PdfImportError,
    get_attachment_full_path,
    parse_pdf_to_draft_create,
    save_pdf_file,
)

router = APIRouter(prefix="/receipt-drafts", tags=["receipt-drafts"])


@router.get("", response_model=list[DraftListItem])
def api_list_drafts(
    db: Annotated[Session, Depends(get_db)],
    status: DraftStatus | None = Query(default=None),
):
    return list_drafts(db, status=status)


@router.post("", response_model=DraftRead, status_code=201)
def api_create_draft(
    payload: DraftCreate,
    db: Annotated[Session, Depends(get_db)],
):
    if not payload.lines:
        raise HTTPException(status_code=400, detail="At least one line is required.")
    try:
        draft = create_draft(db, payload, source_type="manual", require_lines=True)
        return get_draft(db, draft.inv_receipt_draft_id)
    except DraftServiceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/template")
def download_excel_template():
    content = build_template_workbook()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="hanalite_receipt_template.xlsx"'},
    )


@router.post("/import", response_model=DraftRead, status_code=201)
async def api_import_excel(
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(..., description="Excel .xlsx file"),
    receipt_at: str | None = Form(default=None),
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

    parsed_receipt_at = _parse_form_datetime(receipt_at)

    try:
        payload = parse_excel_to_draft_create(
            db,
            raw,
            receipt_at=parsed_receipt_at,
            suppliers_id=suppliers_id,
            reference_no=reference_no,
            notes=notes,
        )
        draft = create_draft(db, payload, source_type="excel", require_lines=True)
        return get_draft(db, draft.inv_receipt_draft_id)
    except ExcelImportError as e:
        msg = str(e)
        if e.row:
            msg = f"Row {e.row}: {msg}"
        raise HTTPException(status_code=400, detail=msg) from e
    except DraftServiceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/import-pdf", response_model=DraftRead, status_code=201)
async def api_import_pdf(
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(..., description="PDF receipt list"),
    receipt_at: str | None = Form(default=None),
    suppliers_id: int | None = Form(default=None),
    reference_no: str | None = Form(default=None),
    notes: str | None = Form(default=None),
):
    filename = (file.filename or "").lower()
    if not filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only .pdf files are supported.")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file.")

    parsed_receipt_at = _parse_form_datetime(receipt_at)

    try:
        stored_name, _ = save_pdf_file(raw, file.filename or "receipt.pdf")
        payload, parse_msg = parse_pdf_to_draft_create(
            db,
            raw,
            receipt_at=parsed_receipt_at,
            suppliers_id=suppliers_id,
            reference_no=reference_no,
            notes=notes,
        )
        draft = create_draft(
            db,
            payload,
            source_type="pdf",
            attachment_path=stored_name,
            attachment_original_name=file.filename,
            parse_message=parse_msg,
            require_lines=False,
        )
        return get_draft(db, draft.inv_receipt_draft_id)
    except PdfImportError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except DraftServiceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/{draft_id}", response_model=DraftRead)
def api_get_draft(
    draft_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return get_draft(db, draft_id)
    except DraftServiceError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/{draft_id}/attachment")
def api_download_attachment(
    draft_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    row = db.scalar(
        select(InvReceiptDraft).where(
            InvReceiptDraft.inv_receipt_draft_id == draft_id,
            InvReceiptDraft.deleted_at.is_(None),
        )
    )
    if not row or not row.attachment_path:
        raise HTTPException(status_code=404, detail="No attachment for this draft.")

    path = get_attachment_full_path(row.attachment_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Attachment file missing on disk.")

    return FileResponse(
        path,
        media_type="application/pdf",
        filename=row.attachment_original_name or "receipt.pdf",
    )


@router.post("/{draft_id}/lines", response_model=DraftRead)
def api_add_draft_line(
    draft_id: int,
    line: DraftLineCreate,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return add_draft_line(db, draft_id, line)
    except DraftServiceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/{draft_id}/approve", response_model=DraftRead)
def api_approve_draft(
    draft_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return approve_draft(db, draft_id)
    except DraftServiceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/{draft_id}/cancel", response_model=DraftRead)
def api_cancel_draft(
    draft_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return cancel_draft(db, draft_id)
    except DraftServiceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


def _parse_form_datetime(receipt_at: str | None) -> datetime | None:
    if not receipt_at:
        return None
    try:
        return datetime.fromisoformat(receipt_at.replace("Z", "+00:00").split("+")[0])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid receipt_at: {receipt_at}") from e
