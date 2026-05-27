"""PDF receipt list import: save file + optional table extraction."""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path

import pdfplumber
from sqlalchemy.orm import Session

from app.config import settings
from app.schemas.drafts import DraftCreate, DraftLineCreate
from app.services.import_lines import ExcelImportError, parse_pdf_tables


class PdfImportError(Exception):
    def __init__(self, message: str):
        super().__init__(message)


def ensure_upload_dir() -> Path:
    path = settings.upload_dir_path
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_pdf_file(file_bytes: bytes, original_name: str) -> tuple[str, str]:
    upload_dir = ensure_upload_dir()
    safe_name = re.sub(r"[^\w.\-]", "_", original_name)[:100]
    stored = f"{uuid.uuid4().hex}_{safe_name}"
    if not stored.lower().endswith(".pdf"):
        stored += ".pdf"
    full_path = upload_dir / stored
    full_path.write_bytes(file_bytes)
    return stored, str(full_path)


def get_attachment_full_path(stored_name: str) -> Path:
    return settings.upload_dir_path / stored_name


def parse_pdf_to_draft_create(
    db: Session,
    file_bytes: bytes,
    *,
    receipt_at: datetime | None = None,
    suppliers_id: int | None = None,
    reference_no: str | None = None,
    notes: str | None = None,
) -> tuple[DraftCreate, str | None]:
    """
    Returns (DraftCreate payload, parse_message).
    Lines may be empty if auto-parse failed.
    """
    try:
        tables: list[list[list]] = []
        with pdfplumber.open(BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                for table in page.extract_tables() or []:
                    if table:
                        tables.append(table)
    except Exception as e:
        raise PdfImportError(f"Cannot read PDF: {e}") from e

    lines: list[DraftLineCreate] = []
    parse_message: str | None = None

    try:
        lines = parse_pdf_tables(db, tables)
    except ExcelImportError as e:
        parse_message = f"Table parse warning: {e}"

    if not lines:
        parse_message = (
            parse_message
            or "PDFを保存しました。明細を自動抽出できませんでした。詳細画面から明細を追加してください。"
        )

    final_receipt_at = receipt_at or datetime.now()
    final_notes = notes
    if parse_message and not lines:
        prefix = f"[PDF import] {parse_message}"
        final_notes = f"{prefix}\n{notes}" if notes else prefix

    payload = DraftCreate(
        receipt_at=final_receipt_at,
        suppliers_id=suppliers_id,
        reference_no=reference_no,
        notes=final_notes,
        lines=lines,
    )
    return payload, parse_message if not lines else None
