import type { LocationMaster } from '../types/masters'
import { buildRecordSnapshotMap } from './gridRowChange'
import { EMPTY_MASTER_ROW_DATES, type MasterRowDates } from './masterGridDates'

export type EditLocationRow = {
  key: string
  location_id?: number
  location_cd: string
  location_nm: string
  locationtyp_id: number | ''
} & MasterRowDates

let nextKey = 0

export function newLocationEditKey(): string {
  nextKey += 1
  return `new-${nextKey}`
}

export function listRowToEditLocationRow(row: LocationMaster): EditLocationRow {
  return {
    key: `loc-${row.location_id}`,
    location_id: row.location_id,
    location_cd: row.location_cd,
    location_nm: row.location_nm,
    locationtyp_id: row.locationtyp_id != null ? row.locationtyp_id : '',
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }
}

export function emptyEditLocationRow(): EditLocationRow {
  return {
    key: newLocationEditKey(),
    location_cd: '',
    location_nm: '',
    locationtyp_id: '',
    ...EMPTY_MASTER_ROW_DATES,
  }
}

/** Blank when code, name, and location type are empty. */
export function isBlankLocationRow(row: EditLocationRow): boolean {
  return (
    row.location_cd.trim() === '' &&
    row.location_nm.trim() === '' &&
    row.locationtyp_id === ''
  )
}

export function isActiveLocationRow(row: EditLocationRow): boolean {
  return row.location_cd.trim() !== '' && row.locationtyp_id !== ''
}

export function listRowsToEditLocationRows(rows: LocationMaster[]): EditLocationRow[] {
  return rows.map(listRowToEditLocationRow)
}

export function buildLocationPayload(row: EditLocationRow) {
  return {
    location_cd: row.location_cd.trim(),
    location_nm: row.location_nm.trim(),
    locationtyp_id: row.locationtyp_id === '' ? null : row.locationtyp_id,
  }
}

export type LocationRowSnapshot = ReturnType<typeof buildLocationPayload>

export function locationRowSnapshot(row: EditLocationRow): LocationRowSnapshot | null {
  if (!isActiveLocationRow(row)) return null
  return buildLocationPayload(row)
}

export function locationRowSnapshotsFromEditRows(
  rows: EditLocationRow[]
): Map<number, LocationRowSnapshot> {
  return buildRecordSnapshotMap(
    rows,
    (row) => row.location_id,
    locationRowSnapshot
  )
}
