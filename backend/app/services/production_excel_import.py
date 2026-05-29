"""Parse production order header from Excel (.xlsx)."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO
from typing import Any

from openpyxl import load_workbook
from sqlalchemy.orm import Session

from app.schemas.production import ProductionOrderCreate
from app.services.masters import MasterError, resolve_item_by_ref


class ProductionExcelImportError(Exception):
    pass


def _normalize_header(value: Any) -> str:
    return str(value or "").strip().lower().replace(" ", "_")


def _cell_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def parse_excel_to_production_create(db: Session, raw: bytes) -> ProductionOrderCreate:
    try:
        wb = load_workbook(BytesIO(raw), data_only=True)
    except Exception as e:  # pragma: no cover
        raise ProductionExcelImportError("Invalid .xlsx file.") from e

    if not wb.sheetnames:
        raise ProductionExcelImportError("Workbook has no sheets.")

    sheet = wb["header"] if "header" in wb.sheetnames else wb[wb.sheetnames[0]]
    header_cells = [c.value for c in next(sheet.iter_rows(min_row=1, max_row=1))]
    value_cells = [c.value for c in next(sheet.iter_rows(min_row=2, max_row=2))]
    if not any(header_cells) or not any(value_cells):
        raise ProductionExcelImportError("Header sheet must have row 1 headers and row 2 values.")

    row: dict[str, Any] = {}
    for idx, raw_key in enumerate(header_cells):
        key = _normalize_header(raw_key)
        if not key:
            continue
        row[key] = value_cells[idx] if idx < len(value_cells) else None

    item_id_raw = row.get("parent_item_id")
    item_cd_raw = row.get("parent_item_cd")
    item_nm_raw = row.get("parent_item_nm")
    try:
        item_id = int(item_id_raw) if item_id_raw not in (None, "") else None
    except Exception:
        raise ProductionExcelImportError("parent_item_id must be an integer.")

    try:
        parent_item = resolve_item_by_ref(
            db,
            item_id=item_id,
            item_cd=_cell_str(item_cd_raw),
            item_nm=_cell_str(item_nm_raw),
        )
    except MasterError as e:
        raise ProductionExcelImportError(str(e)) from e

    planned_qty_raw = row.get("planned_qty")
    lot_raw = row.get("lot")
    notes_raw = row.get("notes")
    production_date_raw = row.get("production_date")
    reference_no_raw = row.get("reference_no")

    try:
        planned_qty = Decimal(str(planned_qty_raw))
    except (InvalidOperation, TypeError):
        raise ProductionExcelImportError("planned_qty must be a number greater than 0.")
    if planned_qty <= 0:
        raise ProductionExcelImportError("planned_qty must be a number greater than 0.")

    lot = _cell_str(lot_raw)
    if not lot:
        raise ProductionExcelImportError("lot is required.")

    production_date = date.today()
    if production_date_raw not in (None, ""):
        if isinstance(production_date_raw, datetime):
            production_date = production_date_raw.date()
        elif isinstance(production_date_raw, date):
            production_date = production_date_raw
        else:
            text = str(production_date_raw).strip()
            try:
                production_date = date.fromisoformat(text[:10])
            except ValueError:
                raise ProductionExcelImportError(
                    "production_date must be YYYY-MM-DD."
                ) from None

    return ProductionOrderCreate(
        production_date=production_date,
        reference_no=_cell_str(reference_no_raw),
        parent_item_id=parent_item.item_id,
        planned_qty=planned_qty,
        lot=lot,
        notes=_cell_str(notes_raw),
    )
