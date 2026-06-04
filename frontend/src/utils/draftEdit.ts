import type { DraftDetail, DraftLine, Item } from '../types'
import { parseDateInputValue } from './format'

export const APPROVE_ITEM_CD_REQUIRED_MSG =
  'Please enter the item code. This code will be used to generate the master.'

export type DraftLineValidationOpts = {
  /** Receipt List detail: location is not edited in the grid. */
  omitLocation?: boolean
}

export function isBlankDraftLine(row: EditLineRow, opts?: DraftLineValidationOpts): boolean {
  if (opts?.omitLocation) {
    return row.item_id === '' && !row.lot.trim() && !row.qty.trim()
  }
  return (
    row.item_id === '' &&
    row.location_id === '' &&
    !row.lot.trim() &&
    !row.qty.trim()
  )
}

export function isActiveEditLine(row: EditLineRow, opts?: DraftLineValidationOpts): boolean {
  if (opts?.omitLocation) {
    return row.item_id !== '' && Boolean(row.lot.trim()) && Boolean(row.qty)
  }
  return (
    row.item_id !== '' &&
    row.location_id !== '' &&
    Boolean(row.lot.trim()) &&
    Boolean(row.qty)
  )
}

export function activeEditLines(
  rows: EditLineRow[],
  opts?: DraftLineValidationOpts
): EditLineRow[] {
  return rows.filter((row) => isActiveEditLine(row, opts))
}

/** First validation problem on partially filled lines, or null if save can proceed. */
export function draftLinesSaveError(
  rows: EditLineRow[],
  fallback: string,
  opts?: DraftLineValidationOpts
): string | null {
  const active = activeEditLines(rows, opts)
  if (active.length > 0) {
    for (const row of active) {
      const qtyNum = Number(row.qty)
      if (!row.qty.trim() || Number.isNaN(qtyNum)) {
        return `Line ${row.line_no}: enter a valid quantity.`
      }
      if (qtyNum <= 0) {
        return `Line ${row.line_no}: quantity must be greater than zero.`
      }
    }
    return null
  }

  const partial = rows.filter(
    (r) => !isBlankDraftLine(r, opts) && !isActiveEditLine(r, opts)
  )
  if (partial.length > 0) {
    const row = partial[0]
    if (row.item_id === '' && !row.item_cd.trim() && !row.item_nm.trim()) {
      return `Line ${row.line_no}: enter item code or name.`
    }
    if (!opts?.omitLocation && row.location_id === '') {
      return `Line ${row.line_no}: select a location.`
    }
    if (!row.lot.trim()) {
      return `Line ${row.line_no}: enter a lot.`
    }
    const qtyNum = Number(row.qty)
    if (!row.qty.trim() || Number.isNaN(qtyNum)) {
      return `Line ${row.line_no}: enter a valid quantity.`
    }
    if (qtyNum <= 0) {
      return `Line ${row.line_no}: quantity must be greater than zero.`
    }
  }

  return fallback
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
  const lower = trimmed.toLowerCase()
  return items.find((i) => i.item_nm.toLowerCase() === lower)
}

export function itemCdFieldPatch(
  items: Item[],
  value: string
): Pick<EditLineRow, 'item_id' | 'itemtyp_id' | 'item_cd' | 'item_nm'> {
  const match = findItemByCd(items, value.trim())
  if (match) {
    return {
      item_id: match.item_id,
      itemtyp_id: match.itemtyp_id,
      item_cd: match.item_cd,
      item_nm: match.item_nm,
    }
  }
  return { item_id: '', itemtyp_id: '', item_cd: value.trim() }
}

export function itemNmFieldPatch(
  items: Item[],
  value: string
): Pick<EditLineRow, 'item_id' | 'itemtyp_id' | 'item_cd' | 'item_nm'> {
  const match = findItemByNm(items, value)
  if (match) {
    return {
      item_id: match.item_id,
      itemtyp_id: match.itemtyp_id,
      item_cd: match.item_cd,
      item_nm: match.item_nm,
    }
  }
  return { item_id: '', itemtyp_id: '', item_nm: value }
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
  itemtyp_id: number | ''
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
    itemtyp_id: '',
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
    itemtyp_id: ln.itemtyp_id ?? '',
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
