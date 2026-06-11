import type { NumberingElementMaster } from '../types/masters'
import { buildRecordSnapshotMap } from './gridRowChange'
import { EMPTY_MASTER_ROW_DATES, type MasterRowDates } from './masterGridDates'

export const NUMBERING_ELEMENT_KINDS = [
  'date_yy',
  'date_mm',
  'date_dd',
  'date_yyyy',
  'sequence',
  'revision',
  'item_cd',
  'literal',
] as const

export type EditNumberingElementRow = {
  key: string
  numbering_element_id?: number
  numbering_element_cd: string
  numbering_element_nm: string
  element_kind: string
  seq_width: number | ''
  literal_text: string
  preview_sample: string
} & MasterRowDates

let nextKey = 0

export function newNumberingElementEditKey(): string {
  nextKey += 1
  return `new-${nextKey}`
}

export function listRowToEditNumberingElementRow(
  row: NumberingElementMaster
): EditNumberingElementRow {
  return {
    key: `numel-${row.numbering_element_id}`,
    numbering_element_id: row.numbering_element_id,
    numbering_element_cd: row.numbering_element_cd,
    numbering_element_nm: row.numbering_element_nm,
    element_kind: row.element_kind,
    seq_width: row.seq_width ?? '',
    literal_text: row.literal_text ?? '',
    preview_sample: row.preview_sample,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }
}

export function emptyEditNumberingElementRow(): EditNumberingElementRow {
  return {
    key: newNumberingElementEditKey(),
    numbering_element_cd: '',
    numbering_element_nm: '',
    element_kind: 'date_yy',
    seq_width: '',
    literal_text: '',
    preview_sample: '',
    ...EMPTY_MASTER_ROW_DATES,
  }
}

export function isBlankNumberingElementRow(row: EditNumberingElementRow): boolean {
  return row.numbering_element_cd.trim() === '' && row.numbering_element_nm.trim() === ''
}

export function isActiveNumberingElementRow(row: EditNumberingElementRow): boolean {
  return row.numbering_element_cd.trim() !== '' && row.numbering_element_nm.trim() !== ''
}

export function listRowsToEditNumberingElementRows(
  rows: NumberingElementMaster[]
): EditNumberingElementRow[] {
  return rows.map(listRowToEditNumberingElementRow)
}

export function buildNumberingElementPayload(row: EditNumberingElementRow) {
  return {
    numbering_element_cd: row.numbering_element_cd.trim(),
    numbering_element_nm: row.numbering_element_nm.trim(),
    element_kind: row.element_kind,
    seq_width: row.seq_width === '' ? null : Number(row.seq_width),
    literal_text: row.literal_text.trim() || null,
    preview_sample: row.preview_sample.trim(),
  }
}

export type NumberingElementRowSnapshot = ReturnType<typeof buildNumberingElementPayload>

export function numberingElementRowSnapshot(
  row: EditNumberingElementRow
): NumberingElementRowSnapshot | null {
  if (!isActiveNumberingElementRow(row)) return null
  return buildNumberingElementPayload(row)
}

export function numberingElementRowSnapshotsFromEditRows(
  rows: EditNumberingElementRow[]
): Map<number, NumberingElementRowSnapshot> {
  return buildRecordSnapshotMap(
    rows,
    (row) => row.numbering_element_id,
    numberingElementRowSnapshot
  )
}
