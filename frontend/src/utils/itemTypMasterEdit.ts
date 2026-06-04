import type { ItemTyp } from '../types/masters'
import { itemTypColorToDisplay, normalizeItemTypColor } from './itemTypColor'
import { buildRecordSnapshotMap } from './gridRowChange'
import { EMPTY_MASTER_ROW_DATES, type MasterRowDates } from './masterGridDates'

export type EditItemTypRow = {
  key: string
  itemtyp_id?: number
  itemtyp_cd: string
  itemtyp_nm: string
  locationtyp_id: number | ''
  itemtyp_color: string
} & MasterRowDates

let nextKey = 0

export function newItemTypEditKey(): string {
  nextKey += 1
  return `new-${nextKey}`
}

export function listRowToEditItemTypRow(row: ItemTyp): EditItemTypRow {
  return {
    key: `itemtyp-${row.itemtyp_id}`,
    itemtyp_id: row.itemtyp_id,
    itemtyp_cd: row.itemtyp_cd,
    itemtyp_nm: row.itemtyp_nm,
    locationtyp_id: row.locationtyp_id != null ? row.locationtyp_id : '',
    itemtyp_color: itemTypColorToDisplay(row.itemtyp_color),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }
}

export function emptyEditItemTypRow(): EditItemTypRow {
  return {
    key: newItemTypEditKey(),
    itemtyp_cd: '',
    itemtyp_nm: '',
    locationtyp_id: '',
    itemtyp_color: '',
    ...EMPTY_MASTER_ROW_DATES,
  }
}

export function isBlankItemTypRow(row: EditItemTypRow): boolean {
  return (
    row.itemtyp_cd.trim() === '' &&
    row.itemtyp_nm.trim() === '' &&
    row.locationtyp_id === '' &&
    normalizeItemTypColor(row.itemtyp_color) === ''
  )
}

export function isActiveItemTypRow(row: EditItemTypRow): boolean {
  return (
    row.itemtyp_cd.trim() !== '' &&
    row.itemtyp_nm.trim() !== '' &&
    row.locationtyp_id !== ''
  )
}

export function listRowsToEditItemTypRows(rows: ItemTyp[]): EditItemTypRow[] {
  return rows.map(listRowToEditItemTypRow)
}

export type ItemTypPayload = {
  itemtyp_cd: string
  itemtyp_nm: string
  itemtyp_color: string | null
  locationtyp_id: number | null
}

export function buildItemTypPayload(row: EditItemTypRow): ItemTypPayload {
  const color = normalizeItemTypColor(row.itemtyp_color)
  return {
    itemtyp_cd: row.itemtyp_cd.trim(),
    itemtyp_nm: row.itemtyp_nm.trim(),
    itemtyp_color: color || null,
    locationtyp_id: row.locationtyp_id === '' ? null : row.locationtyp_id,
  }
}

export type ItemTypRowSnapshot = ItemTypPayload

export function itemTypRowSnapshot(row: EditItemTypRow): ItemTypRowSnapshot | null {
  if (!isActiveItemTypRow(row)) return null
  return buildItemTypPayload(row)
}

export function itemTypRowSnapshotsFromEditRows(
  rows: EditItemTypRow[]
): Map<number, ItemTypRowSnapshot> {
  return buildRecordSnapshotMap(
    rows,
    (row) => row.itemtyp_id,
    itemTypRowSnapshot
  )
}
