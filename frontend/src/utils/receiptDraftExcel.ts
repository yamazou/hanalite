import type { DraftDetail, DraftListItem, SourceType } from '../types'
import type { LocationMaster } from '../types/masters'
import { downloadExcelSheet, exportFilename } from './exportExcel'
import { formatDate, formatDateTime, formatQty, statusLabel } from './format'
import type { EditReceiptDraftHeaderRow } from './receiptDraftListEdit'
import { activeEditLines, type EditLineRow } from './draftEdit'

export const RECEIPT_DRAFT_EXCEL_SHEET = 'Receipt List'

export const RECEIPT_DRAFT_EXCEL_HEADERS = [
  'Receipt',
  'Receipt Date',
  'Reference No.',
  'Source',
  'Status',
  'Supplier',
  'Notes',
  'Rows',
  'Created',
  'Approved at',
  'Cancelled at',
  'Line No',
  'Item Code',
  'Item Name',
  'Location Code',
  'Location Name',
  'Lot',
  'Qty',
] as const

const SOURCE_LABEL: Record<SourceType, string> = {
  manual: 'Manual',
  excel: 'Excel',
  pdf: 'PDF',
}

const EMPTY_LINE: (string | number)[] = ['', '', '', '', '', '', '']

function cellQty(value: string | number | null | undefined): string | number {
  if (value === '' || value == null) return ''
  return formatQty(value)
}

function headerCells(
  draft: DraftListItem,
  headerEdit?: EditReceiptDraftHeaderRow
): (string | number)[] {
  const receiptAt = headerEdit?.receipt_at ?? draft.receipt_at
  const referenceNo = headerEdit?.reference_no ?? draft.reference_no ?? ''
  const supplierNm = headerEdit?.supplier_nm ?? draft.supplier_nm ?? ''
  const notes = headerEdit?.notes ?? draft.notes ?? ''

  return [
    draft.inv_receipt_draft_id,
    formatDate(receiptAt),
    referenceNo.trim() || '-',
    SOURCE_LABEL[draft.source_type] ?? draft.source_type,
    statusLabel[draft.status] ?? draft.status,
    supplierNm.trim() || '-',
    notes.trim() || '-',
    draft.line_count,
    formatDateTime(draft.created_at),
    formatDateTime(draft.approved_at),
    formatDateTime(draft.cancelled_at),
  ]
}

function lineCellsFromDetail(
  line: DraftDetail['lines'][number],
  locations: LocationMaster[]
): (string | number)[] {
  const loc = locations.find((l) => l.location_id === line.location_id)
  return [
    line.line_no,
    (line.item_cd ?? '').trim(),
    (line.item_nm ?? '').trim(),
    loc?.location_cd ?? line.location_cd ?? '',
    loc?.location_nm ?? line.location_nm ?? '',
    line.lot,
    cellQty(line.qty),
  ]
}

function lineCellsFromEdit(row: EditLineRow, locations: LocationMaster[]): (string | number)[] {
  const loc = locations.find((l) => l.location_id === row.location_id)
  return [
    row.line_no,
    row.item_cd.trim(),
    row.item_nm.trim(),
    loc?.location_cd ?? '',
    loc?.location_nm ?? '',
    row.lot.trim(),
    cellQty(row.qty),
  ]
}

function appendEditLineRows(
  rows: (string | number)[][],
  header: (string | number)[],
  editLines: EditLineRow[],
  locations: LocationMaster[]
): void {
  const lines = activeEditLines(editLines).sort((a, b) => a.line_no - b.line_no)
  if (lines.length === 0) {
    rows.push([...header, ...EMPTY_LINE])
    return
  }
  for (const line of lines) {
    rows.push([...header, ...lineCellsFromEdit(line, locations)])
  }
}

export function buildReceiptDraftExportBodyRows(args: {
  drafts: DraftListItem[]
  headerEdits: Map<number, EditReceiptDraftHeaderRow>
  detailByDraftId: Map<number, DraftDetail>
  liveLinesByDraftId: Map<number, EditLineRow[]>
  locations: LocationMaster[]
}): (string | number)[][] {
  const rows: (string | number)[][] = []

  for (const draft of args.drafts) {
    const draftId = draft.inv_receipt_draft_id
    const header = headerCells(
      draft,
      draft.status === 'registered' ? args.headerEdits.get(draftId) : undefined
    )
    const liveLines = args.liveLinesByDraftId.get(draftId)
    const detail = args.detailByDraftId.get(draftId)

    if (liveLines) {
      appendEditLineRows(rows, header, liveLines, args.locations)
      continue
    }
    if (detail) {
      const lines = [...detail.lines].sort((a, b) => a.line_no - b.line_no)
      if (lines.length === 0) {
        rows.push([...header, ...EMPTY_LINE])
        continue
      }
      for (const line of lines) {
        rows.push([...header, ...lineCellsFromDetail(line, args.locations)])
      }
      continue
    }
    rows.push([...header, ...EMPTY_LINE])
  }

  return rows
}

export function downloadReceiptDraftExcel(body: (string | number)[][]): void {
  downloadExcelSheet(
    RECEIPT_DRAFT_EXCEL_SHEET,
    [...RECEIPT_DRAFT_EXCEL_HEADERS],
    body,
    exportFilename('receipt_drafts')
  )
}
