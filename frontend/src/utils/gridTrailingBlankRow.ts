/** Keep one empty row at the bottom; append another when the last row receives input. */
export function ensureTrailingBlankRow<T>(
  rows: T[],
  isBlank: (row: T) => boolean,
  createBlank: (existing: T[]) => T
): T[] {
  if (rows.length === 0) {
    return [createBlank([])]
  }
  const last = rows[rows.length - 1]
  if (!isBlank(last)) {
    return [...rows, createBlank(rows)]
  }
  return rows
}

export function updateRowWithTrailingBlank<T extends { key: string }>(
  rows: T[],
  key: string,
  patch: Partial<T>,
  isBlank: (row: T) => boolean,
  createBlank: (existing: T[]) => T
): T[] {
  const mapped = rows.map((row) => (row.key === key ? { ...row, ...patch } : row))
  return ensureTrailingBlankRow(mapped, isBlank, createBlank)
}
