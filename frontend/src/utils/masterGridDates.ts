import type { GridColumnDef } from '../components/ResizableGridTable'
import { toFilterCellValue } from './gridColumnFilter'
import { formatDateTime } from './format'

export const MASTER_CREATED_UPDATED_COLUMNS: GridColumnDef[] = [
  { key: 'created_at', label: 'Created Date', defaultWidth: 140 },
  { key: 'updated_at', label: 'Updated Date', defaultWidth: 140 },
]

export type MasterRowDates = {
  created_at: string | null
  updated_at: string | null
}

export const EMPTY_MASTER_ROW_DATES: MasterRowDates = {
  created_at: null,
  updated_at: null,
}

export function masterDateFilterValue(row: MasterRowDates, col: string): string {
  if (col === 'created_at') {
    return toFilterCellValue(
      formatDateTime(row.created_at) === '-' ? null : formatDateTime(row.created_at)
    )
  }
  if (col === 'updated_at') {
    return toFilterCellValue(
      formatDateTime(row.updated_at) === '-' ? null : formatDateTime(row.updated_at)
    )
  }
  return toFilterCellValue('')
}

export function masterDateExportValue(row: MasterRowDates, col: string): string {
  if (col === 'created_at') return formatDateTime(row.created_at)
  if (col === 'updated_at') return formatDateTime(row.updated_at)
  return ''
}

export function masterDateCellText(row: MasterRowDates, colKey: string): string {
  if (colKey === 'created_at') return formatDateTime(row.created_at)
  if (colKey === 'updated_at') return formatDateTime(row.updated_at)
  return ''
}

export function isMasterDateColumn(colKey: string): boolean {
  return colKey === 'created_at' || colKey === 'updated_at'
}
