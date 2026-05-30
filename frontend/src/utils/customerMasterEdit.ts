import type { CustomerMaster } from '../types/masters'

export type EditCustomerRow = {
  key: string
  customers_id?: number
  customers_cd: string
  customers_nm: string
}

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
  }
}

export function emptyEditCustomerRow(): EditCustomerRow {
  return {
    key: newCustomerEditKey(),
    customers_cd: '',
    customers_nm: '',
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
