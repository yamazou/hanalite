import type { DraftDetail, DraftLine, Item } from '../types'
import { parseDateInputValue } from './format'

export const APPROVE_ITEM_CD_REQUIRED_MSG =
  'Please enter the item code. This code will be used to generate the master.'

export function isActiveEditLine(row: EditLineRow): boolean {
  return (
    (row.item_id !== '' || Boolean(row.item_cd.trim()) || Boolean(row.item_nm.trim())) &&
    row.location_id !== '' &&
    Boolean(row.lot.trim()) &&
    Boolean(row.qty)
  )
}

export function activeEditLines(rows: EditLineRow[]): EditLineRow[] {
  return rows.filter(isActiveEditLine)
}

export function findLineMissingItemCd(rows: EditLineRow[]): EditLineRow | undefined {
  return activeEditLines(rows).find((ln) => !ln.item_cd.trim())
}

export function findDraftLineMissingItemCd(lines: DraftLine[]): DraftLine | undefined {
  return lines.find((ln) => !(ln.item_cd ?? '').trim())
}

export function findItemByCd(items: Item[], cd: string): Item | undefined {
  const trimmed = cd.trim()
  if (!trimmed) return undefined
  const lower = trimmed.toLowerCase()
  return items.find((i) => i.item_cd.toLowerCase() === lower)
}

export function findItemByNm(items: Item[], nm: string): Item | undefined {
  const trimmed = nm.trim()
  if (!trimmed) return undefined
  return items.find((i) => i.item_nm === trimmed)
}

export function itemCdFieldPatch(
  items: Item[],
  value: string
): Pick<EditLineRow, 'item_id' | 'item_cd' | 'item_nm'> {
  const match = findItemByCd(items, value)
  if (match) {
    return { item_id: match.item_id, item_cd: match.item_cd, item_nm: match.item_nm }
  }
  return { item_id: '', item_cd: value }
}

export function itemNmFieldPatch(
  items: Item[],
  value: string
): Pick<EditLineRow, 'item_id' | 'item_cd' | 'item_nm'> {
  const match = findItemByNm(items, value)
  if (match) {
    return { item_id: match.item_id, item_cd: match.item_cd, item_nm: match.item_nm }
  }
  return { item_id: '', item_nm: value }
}

export type HeaderEdit = {
  receiptAt: string
  suppliersId: number | ''
  referenceNo: string
  notes: string
}

export type EditLineRow = {
  key: string
  inv_receipt_draft_line_id?: number
  item_id: number | ''
  item_cd: string
  item_nm: string
  location_id: number | ''
  lot: string
  qty: string
  line_no: number
}

export function emptyEditLine(lineNo: number): EditLineRow {
  return {
    key: crypto.randomUUID(),
    item_id: '',
    item_cd: '',
    item_nm: '',
    location_id: '',
    lot: '',
    qty: '',
    line_no: lineNo,
  }
}

export function lineToEditRow(ln: DraftLine): EditLineRow {
  const itemCd = (ln.item_cd ?? '').trim()
  const itemNm = (ln.item_nm ?? '').trim()
  return {
    key: `line-${ln.inv_receipt_draft_line_id}`,
    inv_receipt_draft_line_id: ln.inv_receipt_draft_line_id,
    item_id: ln.item_id ?? '',
    item_cd: itemCd,
    item_nm: itemNm,
    location_id: ln.location_id ?? '',
    lot: ln.lot,
    qty: String(ln.qty),
    line_no: ln.line_no,
  }
}

export function editRowToDraftLine(row: EditLineRow): DraftLine {
  return {
    inv_receipt_draft_line_id: row.inv_receipt_draft_line_id ?? 0,
    line_no: row.line_no,
    item_id: row.item_id === '' ? null : row.item_id,
    item_cd: row.item_cd || null,
    item_nm: row.item_nm || null,
    location_id: row.location_id === '' ? undefined : Number(row.location_id),
    lot: row.lot,
    qty: row.qty,
  }
}

export function headerEditFromDraft(data: DraftDetail): HeaderEdit {
  return {
    receiptAt: parseDateInputValue(data.receipt_at),
    suppliersId: data.suppliers_id ?? '',
    referenceNo: data.reference_no ?? '',
    notes: data.notes ?? '',
  }
}
