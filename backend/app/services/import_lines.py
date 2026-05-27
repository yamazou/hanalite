"""Shared tabular import helpers (Excel / PDF)."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy.orm import Session

from app.schemas.drafts import DraftLineCreate
from app.services.masters import MasterError, resolve_item_by_ref

HEADER_ALIASES: dict[str, list[str]] = {
    "item_id": ["item_id", "品目id", "品目ID", "itemid", "id"],
    "item_cd": ["item_cd", "品目コード", "品目cd", "itemcode", "code", "コード"],
    "item_nm": ["item_nm", "品目名", "item_name", "品目", "item"],
    "lot": ["lot", "ロット", "lot_no", "lotno", "ロット番号", "ロットno"],
    "qty": ["qty", "数量", "quantity", "入荷数量", "入数"],
    "line_no": ["line_no", "行", "行番号", "lineno", "line", "#", "no"],
}


class ExcelImportError(Exception):
    def __init__(self, message: str, row: int | None = None):
        self.row = row
        super().__init__(message)


def _norm_header(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().lower().replace(" ", "").replace("_", "")


def _match_column(header: str, aliases: list[str]) -> bool:
    h = _norm_header(header)
    for alias in aliases:
        a = alias.lower().replace(" ", "").replace("_", "")
        if h == a or h.endswith(a) or a in h:
            return True
    return False


def _find_column_map(headers: list[Any]) -> dict[str, int]:
    col_map: dict[str, int] = {}
    for idx, cell in enumerate(headers):
        text = str(cell).strip() if cell is not None else ""
        if not text:
            continue
        for field, aliases in HEADER_ALIASES.items():
            if field not in col_map and _match_column(text, aliases):
                col_map[field] = idx
                break
    return col_map


def _cell_value(row: tuple, col: int | None) -> Any:
    if col is None or col >= len(row):
        return None
    return row[col]


def _resolve_item_id(
    db: Session,
    item_id_raw: Any,
    item_cd_raw: Any,
    item_nm_raw: Any,
    row_num: int,
) -> int:
    item_id: int | None = None
    if item_id_raw is not None and str(item_id_raw).strip() != "":
        try:
            item_id = int(float(str(item_id_raw)))
        except (ValueError, TypeError) as e:
            raise ExcelImportError(f"Invalid item_id: {item_id_raw}", row_num) from e

    item_cd = str(item_cd_raw).strip() if item_cd_raw is not None and str(item_cd_raw).strip() else None
    item_nm = str(item_nm_raw).strip() if item_nm_raw is not None and str(item_nm_raw).strip() else None

    try:
        item = resolve_item_by_ref(db, item_id=item_id, item_cd=item_cd, item_nm=item_nm)
        return item.item_id
    except MasterError as e:
        raise ExcelImportError(str(e), row_num) from e


def parse_data_rows(
    db: Session,
    rows: list[tuple | list],
    *,
    header_row_idx: int = 0,
    row_offset: int = 0,
) -> list[DraftLineCreate]:
    if not rows:
        raise ExcelImportError("No rows to parse.")

    headers = list(rows[header_row_idx])
    col_map = _find_column_map(headers)
    if "lot" not in col_map or "qty" not in col_map:
        raise ExcelImportError("Required columns: lot (ロット), qty (数量).")
    if "item_id" not in col_map and "item_cd" not in col_map and "item_nm" not in col_map:
        raise ExcelImportError("Need item_id, item_cd, or item_nm.")

    lines: list[DraftLineCreate] = []
    line_no = 0
    for i, row in enumerate(rows[header_row_idx + 1 :]):
        row_num = header_row_idx + 2 + i + row_offset
        row_tuple = tuple(row) if not isinstance(row, tuple) else row
        if not row_tuple or not any(c is not None and str(c).strip() != "" for c in row_tuple):
            continue

        lot_val = _cell_value(row_tuple, col_map.get("lot"))
        qty_val = _cell_value(row_tuple, col_map.get("qty"))
        if lot_val is None or str(lot_val).strip() == "":
            continue

        try:
            qty = Decimal(str(qty_val))
        except (InvalidOperation, TypeError) as e:
            raise ExcelImportError(f"Invalid qty: {qty_val}", row_num) from e
        if qty <= 0:
            raise ExcelImportError(f"qty must be > 0 (got {qty})", row_num)

        item_id = _resolve_item_id(
            db,
            _cell_value(row_tuple, col_map.get("item_id")),
            _cell_value(row_tuple, col_map.get("item_cd")),
            _cell_value(row_tuple, col_map.get("item_nm")),
            row_num,
        )

        line_no_raw = _cell_value(row_tuple, col_map.get("line_no"))
        if line_no_raw is not None and str(line_no_raw).strip() != "":
            parsed_line_no = int(float(str(line_no_raw)))
        else:
            line_no += 1
            parsed_line_no = line_no

        lines.append(
            DraftLineCreate(
                item_id=item_id,
                lot=str(lot_val).strip(),
                qty=qty,
                line_no=parsed_line_no,
            )
        )

    return lines


def find_header_row_index(rows: list[tuple | list], max_scan: int = 15) -> int:
    for i, row in enumerate(rows[:max_scan]):
        if row and any(cell is not None and str(cell).strip() for cell in row):
            if "lot" in _find_column_map(list(row)) and "qty" in _find_column_map(list(row)):
                return i
    return 0


def parse_pdf_tables(db: Session, tables: list[list[list[Any]]]) -> list[DraftLineCreate]:
    all_lines: list[DraftLineCreate] = []
    for table in tables:
        if not table or len(table) < 2:
            continue
        try:
            header_idx = find_header_row_index(table)
            lines = parse_data_rows(db, table, header_row_idx=header_idx)
            if len(lines) > len(all_lines):
                all_lines = lines
        except ExcelImportError:
            continue
    return all_lines
