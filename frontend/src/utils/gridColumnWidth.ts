import type { GridColumnDef } from '../components/ResizableGridTable'

/** Absolute floor (resize handle still usable). */
export const GRID_ABS_MIN_COL_WIDTH = 8

/** Header chrome: filter (12) + drag (12) + padding + resizer gutter — label may be fully clipped. */
export const GRID_HEADER_MIN_FILTERABLE = 36

/** Header chrome without filter button — label may be fully clipped. */
export const GRID_HEADER_MIN_COMPACT = 22

export function resolveColumnMinWidth(col: GridColumnDef, headerFilterable: boolean): number {
  if (col.minWidth != null) return col.minWidth
  if (col.key === 'rownum') return rowNumColumnWidthForRowCount(1)
  if (col.key === 'select') return col.minWidth ?? 26
  if (!col.label.trim()) {
    return headerFilterable ? 28 : 20
  }
  return headerFilterable ? GRID_HEADER_MIN_FILTERABLE : GRID_HEADER_MIN_COMPACT
}

/** Excel-like row header: fit digit count with minimal side padding. */
export function rowNumColumnWidthForRowCount(rowCount: number): number {
  const maxRow = Math.max(1, rowCount)
  const digits = String(maxRow).length
  const digitPx = 8
  const sidePad = 6
  return Math.max(26, digits * digitPx + sidePad)
}

export const GRID_ROWNUM_COLUMN_KEY = 'rownum'
