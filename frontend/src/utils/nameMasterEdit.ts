import { buildRecordSnapshotMap } from './gridRowChange'

export type EditNameMasterRow = {
  key: string
  record_id?: number
  name: string
}

let nextKey = 0

export function newNameMasterEditKey(): string {
  nextKey += 1
  return `new-${nextKey}`
}

export function emptyEditNameMasterRow(): EditNameMasterRow {
  return { key: newNameMasterEditKey(), name: '' }
}

export function isBlankNameMasterRow(row: EditNameMasterRow): boolean {
  return row.name.trim() === ''
}

export function isActiveNameMasterRow(row: EditNameMasterRow): boolean {
  return row.name.trim() !== ''
}

export function listRowToEditNameMasterRow(
  record_id: number,
  name: string
): EditNameMasterRow {
  return {
    key: `rec-${record_id}`,
    record_id,
    name,
  }
}

export type NameMasterRowSnapshot = { name: string }

export function nameMasterRowSnapshot(row: EditNameMasterRow): NameMasterRowSnapshot | null {
  if (!isActiveNameMasterRow(row)) return null
  return { name: row.name.trim() }
}

export function nameMasterRowSnapshotsFromEditRows(
  rows: EditNameMasterRow[]
): Map<number, NameMasterRowSnapshot> {
  return buildRecordSnapshotMap(
    rows,
    (row) => row.record_id,
    nameMasterRowSnapshot
  )
}
