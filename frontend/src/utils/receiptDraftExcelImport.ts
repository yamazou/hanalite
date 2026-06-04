import * as XLSX from 'xlsx'
import type { Item, Supplier } from '../types'
import type { LocationMaster } from '../types/masters'
import type { DraftListItem } from '../types'
import { parseDateInputValue, toDateInputValue } from './format'
import {
  emptyEditLine,
  findItemByCd,
  findItemByNm,
  type EditLineRow,
} from './draftEdit'
import { RECEIPT_DRAFT_EXCEL_HEADERS } from './receiptDraftExcel'
import {
  emptyEditReceiptDraftHeaderRow,
  isBlankReceiptDraftHeaderRow,
  type EditReceiptDraftHeaderRow,
} from './receiptDraftListEdit'

export type ReceiptExcelParsedLine = {
  line_no: number
  item_cd: string
  item_nm: string
  location_cd: string
  location_nm: string
  lot: string
  qty: string
}

export type ReceiptExcelDraftGroup = {
  excelRowStart: number
  groupKey: string
  receiptId: number | null
  receipt_at: string
  reference_no: string
  supplier_nm: string
  notes: string
  lines: ReceiptExcelParsedLine[]
}

function parseReceiptExcelDate(raw: string): string {
  const text = raw.trim()
  if (!text || text === '-') return toDateInputValue()
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (mdy) {
    const month = mdy[1]!.padStart(2, '0')
    const day = mdy[2]!.padStart(2, '0')
    return `${mdy[3]}-${month}-${day}`
  }
  return parseDateInputValue(text)
}

export type MergeReceiptDraftImportResult = {
  registeredEdits: Map<number, EditReceiptDraftHeaderRow>
  headerNewRows: EditReceiptDraftHeaderRow[]
  linesByDraftId: Map<number, EditLineRow[]>
  linesByNewKey: Map<string, EditLineRow[]>
  insertedCount: number
  updatedCount: number
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

const HEADER_INDEX = new Map(
  RECEIPT_DRAFT_EXCEL_HEADERS.map((label, index) => [normalizeHeader(label), index])
)

function cellStr(row: (string | number | null | undefined)[], field: string): string {
  const idx = HEADER_INDEX.get(normalizeHeader(field))
  if (idx == null || idx >= row.length) return ''
  const raw = row[idx]
  if (raw == null || raw === '') return ''
  return String(raw).trim()
}

function parseReceiptId(raw: string): number | null {
  const text = raw.trim()
  if (!text || text === '-') return null
  const n = Number(text)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

function resolveLocation(
  locationCd: string,
  locationNm: string,
  locations: LocationMaster[]
): Pick<EditLineRow, 'location_id'> {
  const cd = locationCd.trim()
  const nm = locationNm.trim()
  if (cd) {
    const lower = cd.toLowerCase()
    const byCode = locations.find((l) => l.location_cd.toLowerCase() === lower)
    if (byCode) return { location_id: byCode.location_id }
  }
  if (nm) {
    const lower = nm.toLowerCase()
    const byNm = locations.find((l) => l.location_nm.toLowerCase() === lower)
    if (byNm) return { location_id: byNm.location_id }
  }
  if (cd && nm) {
    const label = `${cd} ${nm}`.trim().toLowerCase()
    const byLabel = locations.find(
      (l) => `${l.location_cd} ${l.location_nm}`.trim().toLowerCase() === label
    )
    if (byLabel) return { location_id: byLabel.location_id }
  }
  return { location_id: '' }
}

function buildEditLine(
  parsed: ReceiptExcelParsedLine,
  items: Item[],
  locations: LocationMaster[]
): EditLineRow | null {
  const itemCd = parsed.item_cd.trim()
  const itemNm = parsed.item_nm.trim()
  const lot = parsed.lot.trim()
  const qtyRaw = parsed.qty.trim().replace(/,/g, '')
  if (!itemCd && !itemNm && !lot && !qtyRaw) return null

  const row = emptyEditLine(parsed.line_no)
  const byCd = itemCd ? findItemByCd(items, itemCd) : undefined
  const byNm = !byCd && itemNm ? findItemByNm(items, itemNm) : undefined
  const item = byCd ?? byNm
  if (item) {
    row.item_id = item.item_id
    row.itemtyp_id = item.itemtyp_id
    row.item_cd = item.item_cd
    row.item_nm = item.item_nm
  } else {
    row.item_cd = itemCd
    row.item_nm = itemNm
  }
  row.lot = lot
  row.qty = qtyRaw
  Object.assign(row, resolveLocation(parsed.location_cd, parsed.location_nm, locations))
  return row
}

function findSupplier(
  suppliers: Supplier[],
  supplierNm: string
): Pick<EditReceiptDraftHeaderRow, 'suppliers_id' | 'supplier_nm'> {
  const text = supplierNm.trim()
  if (!text || text === '-') return { suppliers_id: '', supplier_nm: '' }
  const lower = text.toLowerCase()
  const match = suppliers.find((s) => s.suppliers_nm.toLowerCase() === lower)
  if (match) {
    return { suppliers_id: match.suppliers_id, supplier_nm: match.suppliers_nm }
  }
  return { suppliers_id: '', supplier_nm: text }
}

export async function parseReceiptDraftListExcel(file: File): Promise<ReceiptExcelDraftGroup[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName =
    workbook.SheetNames.find((n) => n === 'Receipt List') ?? workbook.SheetNames[0]
  if (!sheetName) throw new Error('Workbook has no sheets.')

  const sheet = workbook.Sheets[sheetName]
  const table = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })
  if (table.length < 2) {
    throw new Error('No data rows found (header row required).')
  }

  const headerRow = table[0] ?? []
  const headerNorm = headerRow.map((c) => normalizeHeader(String(c ?? '')))
  const hasReceipt = headerNorm.some((h) => h === normalizeHeader('Receipt'))
  const hasDate = headerNorm.some((h) => h === normalizeHeader('Receipt Date'))
  if (!hasReceipt || !hasDate) {
    throw new Error(
      'Invalid header row. Export from Receipt List and import the same file format.'
    )
  }

  const groups: ReceiptExcelDraftGroup[] = []
  let current: ReceiptExcelDraftGroup | null = null

  for (let rowIndex = 1; rowIndex < table.length; rowIndex++) {
    const line = table[rowIndex] ?? []
    const receiptRaw = cellStr(line, 'Receipt')
    const parsedId = parseReceiptId(receiptRaw)
    const lineNoRaw = cellStr(line, 'Line No')
    const itemCd = cellStr(line, 'Item Code')
    const itemNm = cellStr(line, 'Item Name')
    const lot = cellStr(line, 'Lot')
    const qty = cellStr(line, 'Qty')
    const hasLine = Boolean(itemCd || itemNm || lot || qty)
    const hasHeader =
      cellStr(line, 'Receipt Date') ||
      cellStr(line, 'Reference No.') ||
      cellStr(line, 'Supplier') ||
      cellStr(line, 'Notes') ||
      receiptRaw

    if (!hasHeader && !hasLine) continue

    const effectiveId = parsedId ?? current?.receiptId ?? null
    const groupKey =
      effectiveId != null
        ? `id-${effectiveId}`
        : receiptRaw
          ? `ref-${receiptRaw}`
          : current?.groupKey ?? `new-${rowIndex + 1}`

    if (!current || current.groupKey !== groupKey) {
      const receiptAtRaw = cellStr(line, 'Receipt Date')
      current = {
        excelRowStart: rowIndex + 1,
        groupKey,
        receiptId: effectiveId,
        receipt_at: parseReceiptExcelDate(receiptAtRaw),
        reference_no: cellStr(line, 'Reference No.'),
        supplier_nm: cellStr(line, 'Supplier'),
        notes: cellStr(line, 'Notes'),
        lines: [],
      }
      groups.push(current)
    }

    if (!current) continue

    if (hasLine) {
      const lineNo = Number(lineNoRaw) || current.lines.length + 1
      current.lines.push({
        line_no: lineNo,
        item_cd: itemCd,
        item_nm: itemNm,
        location_cd: cellStr(line, 'Location Code'),
        location_nm: cellStr(line, 'Location Name'),
        lot,
        qty,
      })
    }
  }

  if (groups.length === 0) {
    throw new Error('No receipt rows found in Excel.')
  }
  return groups
}

function groupToEditLines(
  group: ReceiptExcelDraftGroup,
  items: Item[],
  locations: LocationMaster[]
): EditLineRow[] {
  const rows: EditLineRow[] = []
  for (const parsed of group.lines) {
    const row = buildEditLine(parsed, items, locations)
    if (row) rows.push(row)
  }
  return rows
}

function groupToHeaderRow(
  group: ReceiptExcelDraftGroup,
  suppliers: Supplier[],
  action: 'insert' | 'update',
  draftId?: number
): EditReceiptDraftHeaderRow {
  const supplier = findSupplier(suppliers, group.supplier_nm)
  return {
    key:
      action === 'update' && draftId != null
        ? `draft-${draftId}`
        : `import-new-${group.excelRowStart}`,
    inv_receipt_draft_id: draftId,
    receipt_at: group.receipt_at,
    reference_no: group.reference_no.trim() === '-' ? '' : group.reference_no.trim(),
    ...supplier,
    notes: group.notes.trim() === '-' ? '' : group.notes.trim(),
    pendingExcelImport: action === 'insert',
  }
}

/** Merge parsed Excel groups into list grid state (no API save). */
export function mergeReceiptDraftImportPreview(
  groups: ReceiptExcelDraftGroup[],
  drafts: DraftListItem[],
  registeredEdits: Map<number, EditReceiptDraftHeaderRow>,
  headerNewRows: EditReceiptDraftHeaderRow[],
  items: Item[],
  locations: LocationMaster[],
  suppliers: Supplier[]
): MergeReceiptDraftImportResult {
  let insertedCount = 0
  let updatedCount = 0
  const nextRegistered = new Map(registeredEdits)
  const linesByDraftId = new Map<number, EditLineRow[]>()
  const linesByNewKey = new Map<string, EditLineRow[]>()
  const dataNewRows = headerNewRows.filter(
    (row, index) =>
      !(index === headerNewRows.length - 1 && isBlankReceiptDraftHeaderRow(row))
  )
  const trailing =
    headerNewRows.length > 0 &&
    isBlankReceiptDraftHeaderRow(headerNewRows[headerNewRows.length - 1])
      ? headerNewRows[headerNewRows.length - 1]
      : emptyEditReceiptDraftHeaderRow()

  const newFromImport: EditReceiptDraftHeaderRow[] = []

  for (const group of groups) {
    const editLines = groupToEditLines(group, items, locations)
    if (group.receiptId != null) {
      const existing = drafts.find((d) => d.inv_receipt_draft_id === group.receiptId)
      if (existing?.status === 'registered') {
        const header = groupToHeaderRow(group, suppliers, 'update', group.receiptId)
        nextRegistered.set(group.receiptId, header)
        if (editLines.length > 0) linesByDraftId.set(group.receiptId, editLines)
        updatedCount += 1
        continue
      }
    }
    const header = groupToHeaderRow(group, suppliers, 'insert')
    newFromImport.push(header)
    if (editLines.length > 0) linesByNewKey.set(header.key, editLines)
    insertedCount += 1
  }

  return {
    registeredEdits: nextRegistered,
    headerNewRows: [...dataNewRows, ...newFromImport, trailing],
    linesByDraftId,
    linesByNewKey,
    insertedCount,
    updatedCount,
  }
}
