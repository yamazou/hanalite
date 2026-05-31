import type { BomRow } from '../types/boms'
import type { Item } from '../types'
import { buildRecordSnapshotMap } from './gridRowChange'
import { findItemByCd } from './draftEdit'

export type EditBomRow = {
  key: string
  bom_id?: number
  p_item_cd: string
  p_item_nm: string
  p_itemtyp_id?: number
  c_item_cd: string
  c_item_nm: string
  c_itemtyp_id?: number
  level: string
  from_location_id: number | ''
  to_location_id: number | ''
  c_req_qty: string
}

let nextKey = 0

export function newBomEditKey(): string {
  nextKey += 1
  return `new-${nextKey}`
}

export function listRowToEditBomRow(row: BomRow): EditBomRow {
  return {
    key: `bom-${row.bom_id}`,
    bom_id: row.bom_id,
    p_item_cd: row.p_item_cd,
    p_item_nm: row.p_item_nm,
    c_item_cd: row.c_item_cd,
    c_item_nm: row.c_item_nm,
    level: String(row.level),
    from_location_id: row.from_location_id,
    to_location_id: row.to_location_id,
    c_req_qty: String(row.c_req_qty),
  }
}

export function emptyEditBomRow(): EditBomRow {
  return {
    key: newBomEditKey(),
    p_item_cd: '',
    p_item_nm: '',
    c_item_cd: '',
    c_item_nm: '',
    level: '',
    from_location_id: '',
    to_location_id: '',
    c_req_qty: '',
  }
}

export function isBlankBomRow(row: EditBomRow): boolean {
  const parentResolved = row.p_item_cd.trim() !== '' && row.p_item_nm.trim() !== ''
  const childResolved = row.c_item_cd.trim() !== '' && row.c_item_nm.trim() !== ''
  return !parentResolved && !childResolved && row.c_req_qty.trim() === ''
}

export function bomParentCdFieldPatch(
  items: Item[],
  value: string
): Pick<EditBomRow, 'p_item_cd' | 'p_item_nm' | 'p_itemtyp_id'> {
  const match = findItemByCd(items, value)
  if (match) {
    return {
      p_item_cd: match.item_cd,
      p_item_nm: match.item_nm,
      p_itemtyp_id: match.itemtyp_id,
    }
  }
  return { p_item_cd: value.trim(), p_item_nm: '', p_itemtyp_id: undefined }
}

export function bomChildCdFieldPatch(
  items: Item[],
  value: string
): Pick<EditBomRow, 'c_item_cd' | 'c_item_nm' | 'c_itemtyp_id'> {
  const match = findItemByCd(items, value)
  if (match) {
    return {
      c_item_cd: match.item_cd,
      c_item_nm: match.item_nm,
      c_itemtyp_id: match.itemtyp_id,
    }
  }
  return { c_item_cd: value.trim(), c_item_nm: '', c_itemtyp_id: undefined }
}

export function isActiveBomRow(row: EditBomRow): boolean {
  const qty = Number(row.c_req_qty)
  const levelNo = Number(row.level)
  return (
    row.p_item_cd.trim() !== '' &&
    row.c_item_cd.trim() !== '' &&
    row.level.trim() !== '' &&
    row.from_location_id !== '' &&
    row.to_location_id !== '' &&
    Number.isInteger(levelNo) &&
    levelNo >= 0 &&
    Number.isFinite(qty) &&
    qty > 0
  )
}

export function listRowsToEditBomRows(rows: BomRow[]): EditBomRow[] {
  return rows.map(listRowToEditBomRow)
}

export type BomRowSnapshot = {
  p_item_cd: string
  c_item_cd: string
  level: string
  from_location_id: number
  to_location_id: number
  c_req_qty: string
}

export function bomRowSnapshot(row: EditBomRow): BomRowSnapshot | null {
  if (!isActiveBomRow(row)) return null
  return {
    p_item_cd: row.p_item_cd.trim(),
    c_item_cd: row.c_item_cd.trim(),
    level: row.level.trim(),
    from_location_id: Number(row.from_location_id),
    to_location_id: Number(row.to_location_id),
    c_req_qty: row.c_req_qty.trim(),
  }
}

export function bomRowSnapshotsFromEditRows(rows: EditBomRow[]): Map<number, BomRowSnapshot> {
  return buildRecordSnapshotMap(
    rows,
    (row) => row.bom_id,
    bomRowSnapshot
  )
}
