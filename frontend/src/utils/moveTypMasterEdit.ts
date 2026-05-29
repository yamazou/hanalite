import type { MoveTypMaster } from '../types/masters'

export type EditMoveTypRow = {
  key: string
  movetyps_id?: number
  movetyps_cd: string
  movetyps_nm: string
}

let nextKey = 0

export function newMoveTypEditKey(): string {
  nextKey += 1
  return `new-${nextKey}`
}

export function listRowToEditMoveTypRow(row: MoveTypMaster): EditMoveTypRow {
  return {
    key: `movetyp-${row.movetyps_id}`,
    movetyps_id: row.movetyps_id,
    movetyps_cd: row.movetyps_cd,
    movetyps_nm: row.movetyps_nm ?? '',
  }
}

export function emptyEditMoveTypRow(): EditMoveTypRow {
  return {
    key: newMoveTypEditKey(),
    movetyps_cd: '',
    movetyps_nm: '',
  }
}

export function isBlankMoveTypRow(row: EditMoveTypRow): boolean {
  return row.movetyps_cd.trim() === '' && row.movetyps_nm.trim() === ''
}

export function isActiveMoveTypRow(row: EditMoveTypRow): boolean {
  return row.movetyps_cd.trim() !== ''
}

export function listRowsToEditMoveTypRows(rows: MoveTypMaster[]): EditMoveTypRow[] {
  return rows.map(listRowToEditMoveTypRow)
}

export function buildMoveTypPayload(row: EditMoveTypRow) {
  const name = row.movetyps_nm.trim()
  return {
    movetyps_cd: row.movetyps_cd.trim(),
    movetyps_nm: name || null,
  }
}
