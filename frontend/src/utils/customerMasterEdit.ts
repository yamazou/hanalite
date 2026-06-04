import type { CustomerMaster } from '../types/masters'
import { buildRecordSnapshotMap } from './gridRowChange'
import { EMPTY_MASTER_ROW_DATES, type MasterRowDates } from './masterGridDates'

export type EditCustomerRow = {
  key: string
  customers_id?: number
  customers_cd: string
  customers_nm: string
} & MasterRowDates

let nextKey = 0

export function newCustomerEditKey(): string {
  nextKey += 1
  return `new-${nextKey}`
}

export function listRowToEditCustomerRow(row: CustomerMaster): EditCustomerRow {
  return {
    key: `customer-${row.customers_id}`,
    customers_id: row.customers_id,
    customers_cd: row.customers_cd,
    customers_nm: row.customers_nm,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }
}

export function emptyEditCustomerRow(): EditCustomerRow {
  return {
    key: newCustomerEditKey(),
    customers_cd: '',
    customers_nm: '',
    ...EMPTY_MASTER_ROW_DATES,
  }
}

export function isBlankCustomerRow(row: EditCustomerRow): boolean {
  return row.customers_cd.trim() === '' && row.customers_nm.trim() === ''
}

export function isActiveCustomerRow(row: EditCustomerRow): boolean {
  return row.customers_cd.trim() !== '' && row.customers_nm.trim() !== ''
}

export function listRowsToEditCustomerRows(rows: CustomerMaster[]): EditCustomerRow[] {
  return rows.map(listRowToEditCustomerRow)
}

export function buildCustomerPayload(row: EditCustomerRow) {
  return {
    customers_cd: row.customers_cd.trim(),
    customers_nm: row.customers_nm.trim(),
  }
}

export type CustomerRowSnapshot = ReturnType<typeof buildCustomerPayload>

export function customerRowSnapshot(row: EditCustomerRow): CustomerRowSnapshot | null {
  if (!isActiveCustomerRow(row)) return null
  return buildCustomerPayload(row)
}

export function customerRowSnapshotsFromEditRows(
  rows: EditCustomerRow[]
): Map<number, CustomerRowSnapshot> {
  return buildRecordSnapshotMap(
    rows,
    (row) => row.customers_id,
    customerRowSnapshot
  )
}
