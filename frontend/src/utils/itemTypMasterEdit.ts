import type { ItemTyp } from '../types/masters'
import { itemTypColorToDisplay, normalizeItemTypColor } from './itemTypColor'

export type EditItemTypRow = {
  key: string
  itemtyp_id?: number
  itemtyp_cd: string
  itemtyp_nm: string
  itemtyp_color: string
}

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
    itemtyp_color: itemTypColorToDisplay(row.itemtyp_color),
  }
}

export function emptyEditItemTypRow(): EditItemTypRow {
  return {
    key: newItemTypEditKey(),
    itemtyp_cd: '',
    itemtyp_nm: '',
    itemtyp_color: '',
  }
}

export function isBlankItemTypRow(row: EditItemTypRow): boolean {
  return (
    row.itemtyp_cd.trim() === '' &&
    row.itemtyp_nm.trim() === '' &&
    normalizeItemTypColor(row.itemtyp_color) === ''
  )
}

export function isActiveItemTypRow(row: EditItemTypRow): boolean {
  return row.itemtyp_cd.trim() !== '' && row.itemtyp_nm.trim() !== ''
}

export function listRowsToEditItemTypRows(rows: ItemTyp[]): EditItemTypRow[] {
  return rows.map(listRowToEditItemTypRow)
}

export type ItemTypPayload = {
  itemtyp_cd: string
  itemtyp_nm: string
  itemtyp_color: string | null
}

export function buildItemTypPayload(row: EditItemTypRow): ItemTypPayload {
  const color = normalizeItemTypColor(row.itemtyp_color)
  return {
    itemtyp_cd: row.itemtyp_cd.trim(),
    itemtyp_nm: row.itemtyp_nm.trim(),
    itemtyp_color: color || null,
  }
}
