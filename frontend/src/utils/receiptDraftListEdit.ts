import type { DraftListItem } from '../types'
import type { DraftCreatePayload, DraftListItem } from '../types'
import { dateInputToIso, parseDateInputValue, toDateInputValue } from './format'
import { snapshotsEqual } from './gridRowChange'

export type EditReceiptDraftHeaderRow = {
  key: string
  inv_receipt_draft_id?: number
  receipt_at: string
  reference_no: string
  suppliers_id: number | ''
  supplier_nm: string
  notes: string
  /** Row from Excel import preview; persisted on Update. */
  pendingExcelImport?: boolean
}

let nextKey = 0

export function newReceiptDraftHeaderEditKey(): string {
  nextKey += 1
  return `new-receipt-${nextKey}`
}

export function emptyEditReceiptDraftHeaderRow(): EditReceiptDraftHeaderRow {
  return {
    key: newReceiptDraftHeaderEditKey(),
    receipt_at: toDateInputValue(),
    reference_no: '',
    suppliers_id: '',
    supplier_nm: '',
    notes: '',
  }
}

export function isBlankReceiptDraftHeaderRow(row: EditReceiptDraftHeaderRow): boolean {
  return (
    row.reference_no.trim() === '' &&
    row.suppliers_id === '' &&
    !row.notes.trim()
  )
}

export function isActiveReceiptDraftHeaderRow(row: EditReceiptDraftHeaderRow): boolean {
  return row.receipt_at.trim() !== ''
}

export function listDraftToEditHeaderRow(row: DraftListItem): EditReceiptDraftHeaderRow {
  return {
    key: `draft-${row.inv_receipt_draft_id}`,
    inv_receipt_draft_id: row.inv_receipt_draft_id,
    receipt_at: parseDateInputValue(row.receipt_at),
    reference_no: row.reference_no ?? '',
    suppliers_id: row.suppliers_id ?? '',
    supplier_nm: row.supplier_nm ?? '',
    notes: row.notes ?? '',
  }
}

export type ReceiptDraftHeaderRowSnapshot = {
  receipt_at: string
  reference_no: string
  suppliers_id: number | null
  notes: string
}

export function headerRowSnapshot(
  row: EditReceiptDraftHeaderRow
): ReceiptDraftHeaderRowSnapshot | null {
  if (!isActiveReceiptDraftHeaderRow(row)) return null
  return {
    receipt_at: row.receipt_at,
    reference_no: row.reference_no.trim() || null,
    suppliers_id: row.suppliers_id === '' ? null : Number(row.suppliers_id),
    notes: row.notes.trim() || null,
  }
}

export function headerRowSnapshotsFromDrafts(
  drafts: DraftListItem[]
): Map<number, ReceiptDraftHeaderRowSnapshot> {
  const map = new Map<number, ReceiptDraftHeaderRowSnapshot>()
  for (const draft of drafts) {
    if (draft.status !== 'registered') continue
    const snapshot = headerRowSnapshot(listDraftToEditHeaderRow(draft))
    if (snapshot) map.set(draft.inv_receipt_draft_id, snapshot)
  }
  return map
}

export function changedRegisteredHeaderDraftIds(
  edits: Map<number, EditReceiptDraftHeaderRow>,
  savedSnapshots: Map<number, ReceiptDraftHeaderRowSnapshot>
): number[] {
  const ids: number[] = []
  for (const [id, row] of edits) {
    const current = headerRowSnapshot(row)
    const saved = savedSnapshots.get(id)
    if (!current || !saved) continue
    if (!snapshotsEqual(current, saved)) ids.push(id)
  }
  return ids
}

export function buildCreateReceiptDraftPayload(
  row: EditReceiptDraftHeaderRow,
  lines: DraftCreatePayload['lines'] = []
): DraftCreatePayload {
  return {
    receipt_at: dateInputToIso(row.receipt_at),
    suppliers_id: row.suppliers_id === '' ? null : Number(row.suppliers_id),
    reference_no: row.reference_no.trim() || null,
    notes: row.notes.trim() || null,
    lines,
  }
}

export function buildUpdateReceiptDraftHeaderPayload(
  row: EditReceiptDraftHeaderRow,
  existingLines: DraftCreatePayload['lines']
): DraftCreatePayload {
  return {
    receipt_at: dateInputToIso(row.receipt_at),
    suppliers_id: row.suppliers_id === '' ? null : Number(row.suppliers_id),
    reference_no: row.reference_no.trim() || null,
    notes: row.notes.trim() || null,
    lines: existingLines,
  }
}

export function receiptDraftHeaderRowSaveError(
  rows: EditReceiptDraftHeaderRow[]
): string | null {
  const incomplete = rows.filter(
    (row) => !isBlankReceiptDraftHeaderRow(row) && !isActiveReceiptDraftHeaderRow(row)
  )
  if (incomplete.length === 0) return null
  return 'Enter Receipt Date for each row.'
}
