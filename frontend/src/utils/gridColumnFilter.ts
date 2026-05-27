export const FILTER_BLANKS = '(Blanks)'

export function toFilterCellValue(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return FILTER_BLANKS
  const s = String(raw).trim()
  return s === '' ? FILTER_BLANKS : s
}

export function applyColumnFilters<T>(
  rows: T[],
  filters: Record<string, Set<string>>,
  getValue: (row: T, columnKey: string) => string
): T[] {
  const entries = Object.entries(filters)
  if (entries.length === 0) return rows
  return rows.filter((row) =>
    entries.every(([col, allowed]) => {
      if (allowed.size === 0) return false
      return allowed.has(getValue(row, col))
    })
  )
}

export function collectUniqueFilterValues<T>(
  rows: T[],
  columnKey: string,
  getValue: (row: T, columnKey: string) => string
): string[] {
  const values = new Set<string>()
  for (const row of rows) {
    values.add(getValue(row, columnKey))
  }
  return [...values].sort((a, b) => {
    if (a === FILTER_BLANKS) return 1
    if (b === FILTER_BLANKS) return -1
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  })
}

export function isColumnFilterActive(filters: Record<string, Set<string>>, columnKey: string): boolean {
  return columnKey in filters
}
