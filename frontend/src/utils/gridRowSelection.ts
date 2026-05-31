export function selectableDisplayRows<TRow>(
  displayRows: TRow[],
  isBlankRow: (row: TRow) => boolean
): TRow[] {
  return displayRows.filter((row) => !isBlankRow(row))
}

export function selectedSelectableCount<TRow>(
  selectableRows: TRow[],
  selectedKeys: Set<string>,
  getKey: (row: TRow) => string
): number {
  return selectableRows.filter((row) => selectedKeys.has(getKey(row))).length
}
