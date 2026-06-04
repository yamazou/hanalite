import { ensureTrailingBlankRow } from './gridTrailingBlankRow'

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

/** Remove checked rows from the edit grid only (no API). Used by grid context-menu Delete row. */
export function removeSelectedGridRows<T extends { key: string }>(
  rows: T[],
  selectedKeys: Set<string>,
  isBlank: (row: T) => boolean,
  createBlank: (existing: T[]) => T
): T[] {
  if (selectedKeys.size === 0) return rows
  const drop = new Set(selectedKeys)
  return ensureTrailingBlankRow(
    rows.filter((row) => !drop.has(row.key)),
    isBlank,
    createBlank
  )
}

export function savedCountMessage(count: number, entityLabel: string): string {
  if (count === 0) return 'No changes to save.'
  return count === 1 ? `1 ${entityLabel} saved.` : `${count} ${entityLabel} saved.`
}

/** Persisted rows removed from the grid (context-menu Delete row) — deleted on Update. */
export function persistedIdsPendingDelete<TRow, TId extends number>(
  rows: TRow[],
  savedSnapshots: Map<TId, unknown>,
  getRecordId: (row: TRow) => TId | null | undefined
): TId[] {
  const present = new Set<TId>()
  for (const row of rows) {
    const id = getRecordId(row)
    if (id != null) present.add(id)
  }
  const pending: TId[] = []
  for (const id of savedSnapshots.keys()) {
    if (!present.has(id)) pending.push(id)
  }
  return pending
}

export function masterPersistResultMessage(
  savedCount: number,
  deletedCount: number,
  entityLabel: string
): string {
  if (savedCount === 0 && deletedCount === 0) return savedCountMessage(0, entityLabel)
  const parts: string[] = []
  if (deletedCount > 0) {
    parts.push(
      deletedCount === 1
        ? `1 ${entityLabel} deleted`
        : `${deletedCount} ${entityLabel} deleted`
    )
  }
  if (savedCount > 0) {
    parts.push(
      savedCount === 1 ? `1 ${entityLabel} saved` : `${savedCount} ${entityLabel} saved`
    )
  }
  return `${parts.join(', ')}.`
}
