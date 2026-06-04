import type { SupplierMaster } from '../types/masters'
import { buildRecordSnapshotMap } from './gridRowChange'
import { EMPTY_MASTER_ROW_DATES, type MasterRowDates } from './masterGridDates'

export type EditSupplierRow = {
  key: string
  suppliers_id?: number
  suppliers_cd: string
  suppliers_nm: string
} & MasterRowDates

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
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }
}

export function emptyEditSupplierRow(): EditSupplierRow {
  return {
    key: newSupplierEditKey(),
    suppliers_cd: '',
    suppliers_nm: '',
    ...EMPTY_MASTER_ROW_DATES,
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

export type SupplierRowSnapshot = ReturnType<typeof buildSupplierPayload>

export function supplierRowSnapshot(row: EditSupplierRow): SupplierRowSnapshot | null {
  if (!isActiveSupplierRow(row)) return null
  return buildSupplierPayload(row)
}

export function supplierRowSnapshotsFromEditRows(
  rows: EditSupplierRow[]
): Map<number, SupplierRowSnapshot> {
  return buildRecordSnapshotMap(
    rows,
    (row) => row.suppliers_id,
    supplierRowSnapshot
  )
}
