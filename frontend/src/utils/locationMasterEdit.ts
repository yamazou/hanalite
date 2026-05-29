import type { LocationMaster } from '../types/masters'

export type EditLocationRow = {
  key: string
  location_id?: number
  location_cd: string
  location_nm: string
  location_type: LocationMaster['location_type'] | ''
}

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
    location_type: row.location_type,
  }
}

export function emptyEditLocationRow(): EditLocationRow {
  return {
    key: newLocationEditKey(),
    location_cd: '',
    location_nm: '',
    location_type: '',
  }
}

/** Blank when code and name are empty; location_type may be unset on trailing row. */
export function isBlankLocationRow(row: EditLocationRow): boolean {
  return row.location_cd.trim() === '' && row.location_nm.trim() === ''
}

export function isActiveLocationRow(row: EditLocationRow): boolean {
  return (
    row.location_cd.trim() !== '' &&
    row.location_nm.trim() !== '' &&
    row.location_type !== ''
  )
}

export function listRowsToEditLocationRows(rows: LocationMaster[]): EditLocationRow[] {
  return rows.map(listRowToEditLocationRow)
}

export function buildLocationPayload(row: EditLocationRow) {
  return {
    location_cd: row.location_cd.trim(),
    location_nm: row.location_nm.trim(),
    location_type: row.location_type as LocationMaster['location_type'],
  }
}
