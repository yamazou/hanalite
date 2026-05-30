import type { SupplierMaster } from '../types/masters'

export type EditSupplierRow = {
  key: string
  suppliers_id?: number
  suppliers_cd: string
  suppliers_nm: string
}

let nextKey = 0

export function newSupplierEditKey(): string {
  nextKey += 1
  return `new-${nextKey}`
}

export function listRowToEditSupplierRow(row: SupplierMaster): EditSupplierRow {
  return {
    key: `supplier-${row.suppliers_id}`,
    suppliers_id: row.suppliers_id,
    suppliers_cd: row.suppliers_cd,
    suppliers_nm: row.suppliers_nm,
  }
}

export function emptyEditSupplierRow(): EditSupplierRow {
  return {
    key: newSupplierEditKey(),
    suppliers_cd: '',
    suppliers_nm: '',
  }
}

export function isBlankSupplierRow(row: EditSupplierRow): boolean {
  return row.suppliers_cd.trim() === '' && row.suppliers_nm.trim() === ''
}

export function isActiveSupplierRow(row: EditSupplierRow): boolean {
  return row.suppliers_cd.trim() !== '' && row.suppliers_nm.trim() !== ''
}

export function listRowsToEditSupplierRows(rows: SupplierMaster[]): EditSupplierRow[] {
  return rows.map(listRowToEditSupplierRow)
}

export function buildSupplierPayload(row: EditSupplierRow) {
  return {
    suppliers_cd: row.suppliers_cd.trim(),
    suppliers_nm: row.suppliers_nm.trim(),
  }
}
