import type { DraftLine, DraftListItem } from '../types'
import { compareValues, type SortDir } from '../hooks/useGridSort'
import { formatDateTime, formatQty, statusLabel } from './format'
import { toFilterCellValue } from './gridColumnFilter'

export function compareDraftListItems(
  a: DraftListItem,
  b: DraftListItem,
  key: string,
  dir: SortDir,
  sourceLabel: Record<string, string>
): number {
  const value = (row: DraftListItem): unknown => {
    switch (key) {
      case 'source':
        return sourceLabel[row.source_type] ?? row.source_type
      case 'status':
        return row.status
      case 'date':
        return row.receipt_at
      case 'reference':
        return row.reference_no
      case 'supplier':
        return row.supplier_nm
      case 'notes':
        return row.notes
      case 'lines':
        return row.line_count
      case 'created':
        return row.created_at
      case 'approved':
        return row.approved_at
      case 'cancelled':
        return row.cancelled_at
      case 'pdf':
        return row.has_attachment ? 1 : 0
      default:
        return ''
    }
  }
  return compareValues(value(a), value(b), dir)
}

export function getDraftListFilterValue(
  row: DraftListItem,
  key: string,
  sourceLabel: Record<string, string>,
  pdfOpenLabel: string
): string {
  switch (key) {
    case 'source':
      return toFilterCellValue(sourceLabel[row.source_type] ?? row.source_type)
    case 'status':
      return toFilterCellValue(statusLabel[row.status] ?? row.status)
    case 'date':
      return toFilterCellValue(formatDateTime(row.receipt_at) === '-' ? null : formatDateTime(row.receipt_at))
    case 'reference':
      return toFilterCellValue(row.reference_no)
    case 'supplier':
      return toFilterCellValue(row.supplier_nm)
    case 'notes':
      return toFilterCellValue(row.notes)
    case 'lines':
      return toFilterCellValue(String(row.line_count))
    case 'created':
      return toFilterCellValue(formatDateTime(row.created_at) === '-' ? null : formatDateTime(row.created_at))
    case 'approved':
      return toFilterCellValue(formatDateTime(row.approved_at) === '-' ? null : formatDateTime(row.approved_at))
    case 'cancelled':
      return toFilterCellValue(formatDateTime(row.cancelled_at) === '-' ? null : formatDateTime(row.cancelled_at))
    case 'pdf':
      return row.has_attachment ? pdfOpenLabel : '-'
    default:
      return ''
  }
}

export function compareDraftLines(a: DraftLine, b: DraftLine, key: string, dir: SortDir): number {
  const value = (row: DraftLine): unknown => {
    switch (key) {
      case 'item':
        return row.item_nm ?? ''
      case 'location':
        return `${row.location_cd ?? ''} ${row.location_nm ?? ''}`.trim()
      case 'lot':
        return row.lot
      case 'qty':
        return Number(row.qty)
      default:
        return ''
    }
  }
  return compareValues(value(a), value(b), dir)
}

export function getDraftLineFilterValue(row: DraftLine, key: string): string {
  switch (key) {
    case 'item': {
      const name = row.item_nm ?? '-'
      return toFilterCellValue(`${name} (ID:${row.item_id})`)
    }
    case 'location': {
      const text = `${row.location_cd ?? '-'} ${row.location_nm ?? ''}`.trim()
      return toFilterCellValue(text === '-' ? null : text)
    }
    case 'lot':
      return toFilterCellValue(row.lot)
    case 'qty':
      return toFilterCellValue(formatQty(row.qty))
    default:
      return ''
  }
}
