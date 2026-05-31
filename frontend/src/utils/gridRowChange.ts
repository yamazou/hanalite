export function buildRecordSnapshotMap<TRow, TId extends number, TSnapshot>(
  rows: TRow[],
  getRecordId: (row: TRow) => TId | undefined,
  toSnapshot: (row: TRow) => TSnapshot | null
): Map<TId, TSnapshot> {
  const map = new Map<TId, TSnapshot>()
  for (const row of rows) {
    const id = getRecordId(row)
    if (id == null) continue
    const snapshot = toSnapshot(row)
    if (snapshot != null) map.set(id, snapshot)
  }
  return map
}

export function snapshotsEqual<TSnapshot extends Record<string, unknown>>(
  a: TSnapshot,
  b: TSnapshot
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as (keyof TSnapshot)[])
  for (const key of keys) {
    if (a[key] !== b[key]) return false
  }
  return true
}

export function isChangedActiveRow<TRow, TId extends number, TSnapshot extends Record<string, unknown>>(
  row: TRow,
  isActive: (row: TRow) => boolean,
  getRecordId: (row: TRow) => TId | undefined,
  toSnapshot: (row: TRow) => TSnapshot | null,
  savedSnapshots: Map<TId, TSnapshot>
): boolean {
  if (!isActive(row)) return false
  const id = getRecordId(row)
  if (id == null) return true
  const current = toSnapshot(row)
  if (current == null) return false
  const saved = savedSnapshots.get(id)
  if (saved == null) return true
  return !snapshotsEqual(current, saved)
}

export function changedActiveRows<TRow, TId extends number, TSnapshot extends Record<string, unknown>>(
  rows: TRow[],
  savedSnapshots: Map<TId, TSnapshot>,
  isActive: (row: TRow) => boolean,
  getRecordId: (row: TRow) => TId | undefined,
  toSnapshot: (row: TRow) => TSnapshot | null
): TRow[] {
  return rows.filter((row) =>
    isChangedActiveRow(row, isActive, getRecordId, toSnapshot, savedSnapshots)
  )
}

export function deleteSelectedConfirm(count: number, entityLabel: string): string {
  return `Delete selected ${count} ${entityLabel}?`
}

export function savedCountMessage(count: number, entityLabel: string): string {
  if (count === 0) return 'No changes to save.'
  return count === 1 ? `1 ${entityLabel} saved.` : `${count} ${entityLabel} saved.`
}
