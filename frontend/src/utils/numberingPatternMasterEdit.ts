import type { NumberingPatternMaster } from '../types/masters'
import { buildRecordSnapshotMap } from './gridRowChange'
import { EMPTY_MASTER_ROW_DATES, type MasterRowDates } from './masterGridDates'

export const NUMBERING_SEQ_RESET_SCOPES = ['never', 'daily', 'monthly', 'yearly'] as const

export const NUMBERING_ELEMENT_SLOT_KEYS = [
  'element_1',
  'element_2',
  'element_3',
  'element_4',
  'element_5',
  'element_6',
  'element_7',
  'element_8',
  'element_9',
  'element_10',
] as const

export type EditNumberingPatternRow = {
  key: string
  numbering_pattern_id?: number
  numbering_pattern_cd: string
  numbering_pattern_nm: string
  element_1: string
  element_2: string
  element_3: string
  element_4: string
  element_5: string
  element_6: string
  element_7: string
  element_8: string
  element_9: string
  element_10: string
  seq_reset_scope: string
  numbering_image: string
} & MasterRowDates

let nextKey = 0

export function newNumberingPatternEditKey(): string {
  nextKey += 1
  return `new-${nextKey}`
}

function elementFieldValue(
  row: NumberingPatternMaster,
  key: (typeof NUMBERING_ELEMENT_SLOT_KEYS)[number]
): string {
  const v = row[key]
  return v ?? ''
}

export function listRowToEditNumberingPatternRow(
  row: NumberingPatternMaster
): EditNumberingPatternRow {
  return {
    key: `numpat-${row.numbering_pattern_id}`,
    numbering_pattern_id: row.numbering_pattern_id,
    numbering_pattern_cd: row.numbering_pattern_cd,
    numbering_pattern_nm: row.numbering_pattern_nm,
    element_1: elementFieldValue(row, 'element_1'),
    element_2: elementFieldValue(row, 'element_2'),
    element_3: elementFieldValue(row, 'element_3'),
    element_4: elementFieldValue(row, 'element_4'),
    element_5: elementFieldValue(row, 'element_5'),
    element_6: elementFieldValue(row, 'element_6'),
    element_7: elementFieldValue(row, 'element_7'),
    element_8: elementFieldValue(row, 'element_8'),
    element_9: elementFieldValue(row, 'element_9'),
    element_10: elementFieldValue(row, 'element_10'),
    seq_reset_scope: row.seq_reset_scope,
    numbering_image: row.numbering_image,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }
}

export function emptyEditNumberingPatternRow(): EditNumberingPatternRow {
  return {
    key: newNumberingPatternEditKey(),
    numbering_pattern_cd: '',
    numbering_pattern_nm: '',
    element_1: '',
    element_2: '',
    element_3: '',
    element_4: '',
    element_5: '',
    element_6: '',
    element_7: '',
    element_8: '',
    element_9: '',
    element_10: '',
    seq_reset_scope: 'daily',
    numbering_image: '',
    ...EMPTY_MASTER_ROW_DATES,
  }
}

export function isBlankNumberingPatternRow(row: EditNumberingPatternRow): boolean {
  return row.numbering_pattern_cd.trim() === '' && row.numbering_pattern_nm.trim() === ''
}

export function isActiveNumberingPatternRow(row: EditNumberingPatternRow): boolean {
  return row.numbering_pattern_cd.trim() !== '' && row.numbering_pattern_nm.trim() !== ''
}

export function listRowsToEditNumberingPatternRows(
  rows: NumberingPatternMaster[]
): EditNumberingPatternRow[] {
  return rows.map(listRowToEditNumberingPatternRow)
}

export function buildNumberingPatternPayload(row: EditNumberingPatternRow) {
  const slot = (v: string) => {
    const s = v.trim()
    return s ? s.toUpperCase() : null
  }
  return {
    numbering_pattern_cd: row.numbering_pattern_cd.trim(),
    numbering_pattern_nm: row.numbering_pattern_nm.trim(),
    element_1: slot(row.element_1),
    element_2: slot(row.element_2),
    element_3: slot(row.element_3),
    element_4: slot(row.element_4),
    element_5: slot(row.element_5),
    element_6: slot(row.element_6),
    element_7: slot(row.element_7),
    element_8: slot(row.element_8),
    element_9: slot(row.element_9),
    element_10: slot(row.element_10),
    seq_reset_scope: row.seq_reset_scope,
  }
}

export type NumberingPatternRowSnapshot = ReturnType<typeof buildNumberingPatternPayload>

export function numberingPatternRowSnapshot(
  row: EditNumberingPatternRow
): NumberingPatternRowSnapshot | null {
  if (!isActiveNumberingPatternRow(row)) return null
  return buildNumberingPatternPayload(row)
}

export function numberingPatternRowSnapshotsFromEditRows(
  rows: EditNumberingPatternRow[]
): Map<number, NumberingPatternRowSnapshot> {
  return buildRecordSnapshotMap(
    rows,
    (row) => row.numbering_pattern_id,
    numberingPatternRowSnapshot
  )
}
