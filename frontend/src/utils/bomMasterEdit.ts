import type { BomRow } from '../types/boms'

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
  return (
    row.p_item_cd.trim() === '' &&
    row.c_item_cd.trim() === '' &&
    row.c_req_qty.trim() === ''
  )
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
