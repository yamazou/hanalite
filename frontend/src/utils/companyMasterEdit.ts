import type { CompanyMaster } from '../types/auth'
import { buildRecordSnapshotMap } from './gridRowChange'
import { EMPTY_MASTER_ROW_DATES, type MasterRowDates } from './masterGridDates'

export type EditCompanyRow = {
  key: string
  co_id?: number
  company_cd: string
  company_nm: string
} & MasterRowDates

let nextKey = 0

export function newCompanyEditKey(): string {
  nextKey += 1
  return `new-${nextKey}`
}

export function listRowToEditCompanyRow(row: CompanyMaster): EditCompanyRow {
  return {
    key: `company-${row.co_id}`,
    co_id: row.co_id,
    company_cd: row.company_cd,
    company_nm: row.company_nm,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }
}

export function emptyEditCompanyRow(): EditCompanyRow {
  return {
    key: newCompanyEditKey(),
    company_cd: '',
    company_nm: '',
    ...EMPTY_MASTER_ROW_DATES,
  }
}

export function isBlankCompanyRow(row: EditCompanyRow): boolean {
  return row.company_cd.trim() === '' && row.company_nm.trim() === ''
}

export function isActiveCompanyRow(row: EditCompanyRow): boolean {
  return row.company_cd.trim() !== '' && row.company_nm.trim() !== ''
}

export function listRowsToEditCompanyRows(rows: CompanyMaster[]): EditCompanyRow[] {
  return rows.map(listRowToEditCompanyRow)
}

export function buildCompanyPayload(row: EditCompanyRow) {
  return {
    company_cd: row.company_cd.trim(),
    company_nm: row.company_nm.trim(),
  }
}

export type CompanyRowSnapshot = ReturnType<typeof buildCompanyPayload>

export function companyRowSnapshot(row: EditCompanyRow): CompanyRowSnapshot | null {
  if (!isActiveCompanyRow(row)) return null
  return buildCompanyPayload(row)
}

export function companyRowSnapshotsFromEditRows(
  rows: EditCompanyRow[]
): Map<number, CompanyRowSnapshot> {
  return buildRecordSnapshotMap(rows, (row) => row.co_id, companyRowSnapshot)
}
