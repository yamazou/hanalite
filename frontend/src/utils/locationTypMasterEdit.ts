import type { LocationTyp } from '../types/masters'
import { buildRecordSnapshotMap } from './gridRowChange'
import { EMPTY_MASTER_ROW_DATES, type MasterRowDates } from './masterGridDates'

export type EditLocationTypRow = {
  key: string
  locationtyp_id?: number
  locationtyp_cd: string
  locationtyp_nm: string
} & MasterRowDates

let nextKey = 0

export function newLocationTypEditKey(): string {
  nextKey += 1
  return `new-${nextKey}`
}

export function locationTypDropdownLabel(row: LocationTyp): string {
  return `${row.locationtyp_cd} / ${row.locationtyp_nm}`
}

/** Resolve Location Type from Excel import: match code, then name. */
export function resolveLocationtypId(
  label: string | undefined,
  locationtyps: LocationTyp[]
): number | '' {
  const raw = (label ?? '').trim()
  if (!raw) return ''
  const lower = raw.toLowerCase()
  const byCode = locationtyps.find((t) => t.locationtyp_cd.trim().toLowerCase() === lower)
  if (byCode) return byCode.locationtyp_id
  const byName = locationtyps.find((t) => t.locationtyp_nm.trim().toLowerCase() === lower)
  return byName?.locationtyp_id ?? ''
}

export function listRowToEditLocationTypRow(row: LocationTyp): EditLocationTypRow {
  return {
    key: `locationtyp-${row.locationtyp_id}`,
    locationtyp_id: row.locationtyp_id,
    locationtyp_cd: row.locationtyp_cd,
    locationtyp_nm: row.locationtyp_nm,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }
}

export function emptyEditLocationTypRow(): EditLocationTypRow {
  return {
    key: newLocationTypEditKey(),
    locationtyp_cd: '',
    locationtyp_nm: '',
    ...EMPTY_MASTER_ROW_DATES,
  }
}

export function isBlankLocationTypRow(row: EditLocationTypRow): boolean {
  return row.locationtyp_cd.trim() === '' && row.locationtyp_nm.trim() === ''
}

export function isActiveLocationTypRow(row: EditLocationTypRow): boolean {
  return row.locationtyp_cd.trim() !== '' && row.locationtyp_nm.trim() !== ''
}

export function listRowsToEditLocationTypRows(rows: LocationTyp[]): EditLocationTypRow[] {
  return rows.map(listRowToEditLocationTypRow)
}

export function buildLocationTypPayload(row: EditLocationTypRow) {
  return {
    locationtyp_cd: row.locationtyp_cd.trim(),
    locationtyp_nm: row.locationtyp_nm.trim(),
  }
}

export type LocationTypRowSnapshot = ReturnType<typeof buildLocationTypPayload>

export function locationTypRowSnapshot(row: EditLocationTypRow): LocationTypRowSnapshot | null {
  if (!isActiveLocationTypRow(row)) return null
  return buildLocationTypPayload(row)
}

export function locationTypRowSnapshotsFromEditRows(
  rows: EditLocationTypRow[]
): Map<number, LocationTypRowSnapshot> {
  return buildRecordSnapshotMap(
    rows,
    (row) => row.locationtyp_id,
    locationTypRowSnapshot
  )
}
