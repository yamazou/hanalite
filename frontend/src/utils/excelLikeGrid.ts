/** Columns that are UI-only and excluded from sort / filter / Excel export. */
const NON_DATA_COLUMNS = new Set(['rownum', 'select', 'actions'])

export function isGridDataColumn(columnKey: string): boolean {
  return !NON_DATA_COLUMNS.has(columnKey)
}
