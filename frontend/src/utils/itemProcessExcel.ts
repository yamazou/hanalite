import * as XLSX from 'xlsx'
import type {
  CustomerMaster,
  ItemDetail,
  ItemListRow,
  ItemPayload,
  ItemTyp,
  LocationMaster,
} from '../types/masters'
import { resolveItemtypId } from './itemTypDisplay'
import type { ItemProcessesOut } from '../types/itemprocs'
import { exportFilename, downloadExcelSheetWithRedColumns } from './exportExcel'
import {
  emptyEditFinalItemRow,
  ensureItemProcessEditRows,
  finalItemFieldsFromCatalogItem,
  isActiveFinalItemRow,
  isBlankFinalItemRow,
  isBlankItemProcessInputRow,
  isBlankItemProcessRow,
  mergeFinalItemRowsForDisplay,
  stableFinalItemKey,
  type EditFinalItemRow,
  type FinalItemCatalogLookups,
} from './itemProcessEdit'
import {
  createBlankProcessRowForDetail,
  emptyEditProcessRow,
  type EditInputRow,
  type EditProcessRow,
} from './productionEdit'
import { ensureTrailingBlankRow } from './gridTrailingBlankRow'

export const ITEM_PROCESS_EXCEL_SHEET = 'Item Processes'

export const ITEM_PROCESS_EXCEL_HEADERS = [
  'Output Item Code',
  'Output Item Name',
  'Item Type Code',
  'Customer Code',
  'Line No',
  'WIP Location Code',
  'Process Output',
  'Input Item Code',
  'Input Item Name',
  'Req Qty',
] as const

/** User-editable columns (red in export). Import works with these five alone. */
export const ITEM_PROCESS_EXCEL_REQUIRED_HEADERS = [
  'Output Item Code',
  'Line No',
  'WIP Location Code',
  'Input Item Code',
  'Req Qty',
] as const

export const ITEM_PROCESS_EXCEL_REQUIRED_COLUMN_INDICES = ITEM_PROCESS_EXCEL_REQUIRED_HEADERS.map(
  (header) => ITEM_PROCESS_EXCEL_HEADERS.indexOf(header)
)

export type ItemProcessExcelRow = Record<(typeof ITEM_PROCESS_EXCEL_HEADERS)[number], string>

const HEADER_ALIASES: Record<string, keyof ItemProcessExcelRow> = {
  'output item code': 'Output Item Code',
  'output item name': 'Output Item Name',
  'item type code': 'Item Type Code',
  'customer code': 'Customer Code',
  'line no': 'Line No',
  'wip location code': 'WIP Location Code',
  'process output': 'Process Output',
  'process output item code': 'Process Output',
  'input item code': 'Input Item Code',
  'input item name': 'Input Item Name',
  'req qty': 'Req Qty',
}

function cellText(value: unknown): string {
  if (value == null || value === '') return ''
  return typeof value === 'number' ? String(value) : String(value).trim()
}

function findLocationByCd(
  locations: LocationMaster[],
  cd: string
): LocationMaster | undefined {
  const trimmed = cd.trim()
  if (!trimmed) return undefined
  const lower = trimmed.toLowerCase()
  return locations.find((loc) => loc.location_cd.trim().toLowerCase() === lower)
}

function findItemByCd(items: ItemListRow[], cd: string): ItemListRow | undefined {
  const trimmed = cd.trim()
  if (!trimmed) return undefined
  const lower = trimmed.toLowerCase()
  return items.find((item) => item.item_cd.trim().toLowerCase() === lower)
}

function findItemByNm(items: ItemListRow[], nm: string): ItemListRow | undefined {
  const trimmed = nm.trim()
  if (!trimmed) return undefined
  return items.find((item) => item.item_nm === trimmed)
}

function resolveImportItem(
  items: ItemListRow[],
  cd: string,
  nm: string
): ItemListRow | undefined {
  return findItemByCd(items, cd) ?? findItemByNm(items, nm)
}

export function buildItemProcessExportBodyRows(args: {
  finalItems: EditFinalItemRow[]
  processDataByItemId: Map<number, ItemProcessesOut>
  liveEditsByItemId?: Map<number, { processRows: EditProcessRow[]; inputRows: EditInputRow[] }>
}): (string | number)[][] {
  const rows: (string | number)[][] = []
  for (const finalItem of args.finalItems) {
    if (!isActiveFinalItemRow(finalItem)) continue
    const itemId = Number(finalItem.item_id)
    const live = args.liveEditsByItemId?.get(itemId)
    if (live) {
      rows.push(...editDraftToExportRows(finalItem, live.processRows, live.inputRows))
      continue
    }
    const data = args.processDataByItemId.get(itemId)
    if (!data || data.processes.length === 0) {
      rows.push(outputOnlyExportRow(finalItem))
      continue
    }
    rows.push(...itemProcessesOutToExportRows(finalItem, data))
  }
  return rows
}

function outputOnlyExportRow(finalItem: EditFinalItemRow): (string | number)[] {
  return [
    finalItem.item_cd,
    finalItem.item_nm,
    finalItem.itemtyp_cd,
    finalItem.customer_cd,
    '',
    '',
    '',
    '',
    '',
    '',
  ]
}

function itemProcessesOutToExportRows(
  finalItem: EditFinalItemRow,
  data: ItemProcessesOut
): (string | number)[][] {
  const rows: (string | number)[][] = []
  const sorted = [...data.processes].sort((a, b) => a.line_no - b.line_no)
  if (sorted.length === 0) return [outputOnlyExportRow(finalItem)]
  for (const proc of sorted) {
    const inputs = [...proc.inputs].sort((a, b) => a.input_no - b.input_no)
    if (inputs.length === 0) {
      rows.push(processExportRow(finalItem, proc.line_no, proc, null))
      continue
    }
    for (const inp of inputs) {
      rows.push(processExportRow(finalItem, proc.line_no, proc, inp))
    }
  }
  return rows
}

function editDraftToExportRows(
  finalItem: EditFinalItemRow,
  processRows: EditProcessRow[],
  inputRows: EditInputRow[]
): (string | number)[][] {
  const activeProcesses = processRows
    .filter((row) => !isBlankItemProcessRow(row))
    .sort((a, b) => a.line_no - b.line_no)
  if (activeProcesses.length === 0) return [outputOnlyExportRow(finalItem)]
  const rows: (string | number)[][] = []
  for (const proc of activeProcesses) {
    const inputs = inputRows
      .filter((row) => row.line_no === proc.line_no && !isBlankItemProcessInputRow(row))
      .sort((a, b) => a.key.localeCompare(b.key))
    if (inputs.length === 0) {
      rows.push([
        finalItem.item_cd,
        finalItem.item_nm,
        finalItem.itemtyp_cd,
        finalItem.customer_cd,
        proc.line_no,
        proc.wip_location_cd,
        proc.output_item_cd,
        '',
        '',
        '',
      ])
      continue
    }
    for (const inp of inputs) {
      rows.push([
        finalItem.item_cd,
        finalItem.item_nm,
        finalItem.itemtyp_cd,
        finalItem.customer_cd,
        proc.line_no,
        proc.wip_location_cd,
        proc.output_item_cd,
        inp.item_cd,
        inp.item_nm,
        inp.req_qty,
      ])
    }
  }
  return rows
}

function processExportRow(
  finalItem: EditFinalItemRow,
  lineNo: number,
  proc: ItemProcessesOut['processes'][number],
  inp: ItemProcessesOut['processes'][number]['inputs'][number] | null
): (string | number)[] {
  return [
    finalItem.item_cd,
    finalItem.item_nm,
    finalItem.itemtyp_cd,
    finalItem.customer_cd,
    lineNo,
    proc.wip_location_cd,
    proc.output_item_cd,
    inp?.item_cd ?? '',
    inp?.item_nm ?? '',
    inp?.req_qty ?? '',
  ]
}

export async function downloadItemProcessExcel(body: (string | number)[][]): Promise<void> {
  await downloadExcelSheetWithRedColumns(
    ITEM_PROCESS_EXCEL_SHEET,
    [...ITEM_PROCESS_EXCEL_HEADERS],
    body,
    exportFilename('item_processes'),
    ITEM_PROCESS_EXCEL_REQUIRED_COLUMN_INDICES
  )
}

export async function parseItemProcessExcelFile(file: File): Promise<ItemProcessExcelRow[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Workbook has no sheets.')
  const sheet = workbook.Sheets[sheetName]
  const table = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })
  if (table.length < 2) throw new Error('No data rows found (header row required).')

  const headerCells = (table[0] ?? []).map((cell) => cellText(cell))
  const columnIndexByHeader = new Map<keyof ItemProcessExcelRow, number>()
  headerCells.forEach((header, index) => {
    const mapped = HEADER_ALIASES[header.trim().toLowerCase()]
    if (mapped) columnIndexByHeader.set(mapped, index)
  })
  if (!columnIndexByHeader.has('Output Item Code')) {
    throw new Error('Missing required column: Output Item Code')
  }

  const rows: ItemProcessExcelRow[] = []
  for (let rowIndex = 1; rowIndex < table.length; rowIndex++) {
    const line = table[rowIndex] ?? []
    const record = {} as ItemProcessExcelRow
    let hasValue = false
    for (const header of ITEM_PROCESS_EXCEL_HEADERS) {
      const colIndex = columnIndexByHeader.get(header)
      const value = colIndex == null ? '' : cellText(line[colIndex])
      record[header] = value
      if (value) hasValue = true
    }
    if (hasValue) rows.push(record)
  }
  if (rows.length === 0) throw new Error('No data rows found below the header.')
  return rows
}

export type ItemProcessImportResult = {
  finalItemRows: EditFinalItemRow[]
  processDraftByItemId: Map<number, { processRows: EditProcessRow[]; inputRows: EditInputRow[] }>
  addedOutputItems: number
  updatedOutputItems: number
  importedProcessItems: number
}

export type EnsureItemsForImportResult = {
  items: ItemListRow[]
  createdCount: number
}

/** @deprecated Use EnsureItemsForImportResult */
export type EnsureOutputItemsForImportResult = EnsureItemsForImportResult

type ImportItemToEnsure = {
  code: string
  name: string
  typeLabel: string
  customerCd: string
  label: string
}

function importItemEnsureKey(code: string, name: string): string {
  const c = code.trim().toLowerCase()
  if (c) return `cd:${c}`
  return `nm:${name.trim()}`
}

function collectItemsToEnsureFromImport(parsed: ItemProcessExcelRow[]): ImportItemToEnsure[] {
  const seen = new Set<string>()
  const result: ImportItemToEnsure[] = []

  const add = (
    code: string,
    name: string,
    typeLabel: string,
    customerCd: string,
    label: string
  ) => {
    const trimmedCode = code.trim()
    const trimmedName = name.trim()
    if (!trimmedCode && !trimmedName) return
    const key = importItemEnsureKey(trimmedCode, trimmedName)
    if (seen.has(key)) return
    seen.add(key)
    result.push({
      code: trimmedCode || trimmedName,
      name: trimmedName || trimmedCode,
      typeLabel: typeLabel.trim(),
      customerCd: customerCd.trim(),
      label,
    })
  }

  for (const row of parsed) {
    add(
      row['Output Item Code'],
      row['Output Item Name'],
      row['Item Type Code'],
      row['Customer Code'],
      'output item'
    )
    add(row['Input Item Code'], row['Input Item Name'], '', '', 'input item')
    const processOutputCd = row['Process Output'].trim()
    if (processOutputCd) {
      add(processOutputCd, processOutputCd, '', '', 'process output item')
    }
  }

  return result
}

async function createImportItemIfMissing(args: {
  items: ItemListRow[]
  entry: ImportItemToEnsure
  itemtyps: ItemTyp[]
  customers: CustomerMaster[]
  createItem: (payload: ItemPayload) => Promise<ItemDetail>
}): Promise<{ items: ItemListRow[]; created: boolean }> {
  const { entry } = args
  let items = args.items
  if (resolveImportItem(items, entry.code, entry.name)) {
    return { items, created: false }
  }

  const itemtyp_id = entry.typeLabel ? resolveItemtypId(entry.typeLabel, args.itemtyps) : null
  if (entry.typeLabel && itemtyp_id === '') {
    throw new Error(`Item type not found: ${entry.typeLabel} (${entry.label} ${entry.code})`)
  }

  let customer1_id: number | null = null
  if (entry.customerCd) {
    const customer = findCustomerByCd(args.customers, entry.customerCd)
    if (!customer) {
      throw new Error(`Customer not found: ${entry.customerCd} (${entry.label} ${entry.code})`)
    }
    customer1_id = customer.customers_id
  }

  const created = await args.createItem({
    item_cd: entry.code,
    item_nm: entry.name,
    itemtyp_id: itemtyp_id === '' ? null : itemtyp_id,
    customer1_id,
  })
  items = [...items, itemListRowFromDetail(created, args.itemtyps, args.customers)]
  return { items, created: true }
}

function findCustomerByCd(
  customers: CustomerMaster[],
  cd: string
): CustomerMaster | undefined {
  const trimmed = cd.trim()
  if (!trimmed) return undefined
  const lower = trimmed.toLowerCase()
  return customers.find((c) => c.customers_cd.trim().toLowerCase() === lower)
}

function itemListRowFromDetail(
  detail: ItemDetail,
  itemtyps: ItemTyp[],
  customers: CustomerMaster[]
): ItemListRow {
  const itemtyp = detail.itemtyp_id != null
    ? itemtyps.find((t) => t.itemtyp_id === detail.itemtyp_id)
    : undefined
  const customer =
    detail.customer1_id != null
      ? customers.find((c) => c.customers_id === detail.customer1_id)
      : undefined
  return {
    item_id: detail.item_id,
    item_cd: detail.item_cd,
    item_nm: detail.item_nm,
    itemtyp_id: detail.itemtyp_id,
    itemtyp_nm: itemtyp?.itemtyp_nm ?? null,
    supplier1_id: detail.supplier1_id,
    supplier1_nm: null,
    supplier2_id: detail.supplier2_id,
    supplier3_id: detail.supplier3_id,
    customer1_id: detail.customer1_id,
    customer1_nm: customer?.customers_nm ?? null,
    customer2_id: detail.customer2_id,
    customer2_nm: null,
  }
}

/** Create missing output/input/process-output items in Items master before merge. */
export async function ensureItemsForItemProcessImport(args: {
  parsed: ItemProcessExcelRow[]
  items: ItemListRow[]
  itemtyps: ItemTyp[]
  customers: CustomerMaster[]
  createItem: (payload: ItemPayload) => Promise<ItemDetail>
}): Promise<EnsureItemsForImportResult> {
  let items = [...args.items]
  let createdCount = 0

  for (const entry of collectItemsToEnsureFromImport(args.parsed)) {
    const result = await createImportItemIfMissing({
      items,
      entry,
      itemtyps: args.itemtyps,
      customers: args.customers,
      createItem: args.createItem,
    })
    items = result.items
    if (result.created) createdCount += 1
  }

  return { items, createdCount }
}

/** @deprecated Use ensureItemsForItemProcessImport */
export const ensureOutputItemsForItemProcessImport = ensureItemsForItemProcessImport

export function mergeItemProcessImportRows(args: {
  parsed: ItemProcessExcelRow[]
  existingFinalItems: EditFinalItemRow[]
  apiFinalItems: Pick<
    EditFinalItemRow,
    'item_id' | 'item_cd' | 'item_nm' | 'itemtyp_cd' | 'customer_cd'
  >[]
  items: ItemListRow[]
  locations: LocationMaster[]
  lookups: FinalItemCatalogLookups
}): ItemProcessImportResult {
  const grouped = new Map<string, ItemProcessExcelRow[]>()
  for (const row of args.parsed) {
    const outputCd = row['Output Item Code'].trim()
    if (!outputCd) continue
    const key = outputCd.toLowerCase()
    const bucket = grouped.get(key) ?? []
    bucket.push(row)
    grouped.set(key, bucket)
  }
  if (grouped.size === 0) {
    throw new Error('No output item rows found in the import file.')
  }

  const processDraftByItemId = new Map<
    number,
    { processRows: EditProcessRow[]; inputRows: EditInputRow[] }
  >()
  let addedOutputItems = 0
  let updatedOutputItems = 0
  let importedProcessItems = 0

  const importedFinalItems: EditFinalItemRow[] = []
  for (const [, groupRows] of grouped) {
    const first = groupRows[0]
    const item =
      resolveImportItem(args.items, first['Output Item Code'], first['Output Item Name']) ??
      findItemByCd(args.items, first['Output Item Code'])
    if (!item) {
      throw new Error(
        `Output item could not be resolved after import: ${first['Output Item Code']}`
      )
    }
    importedFinalItems.push({
      key: stableFinalItemKey(item.item_id),
      ...finalItemFieldsFromCatalogItem(item, args.lookups),
    })

    const { processRows, inputRows } = buildDraftFromImportGroup(
      groupRows,
      item.item_id,
      args.items,
      args.locations
    )
    if (processRows.some((row) => !isBlankItemProcessRow(row))) {
      processDraftByItemId.set(item.item_id, { processRows, inputRows })
      importedProcessItems += 1
    }
  }

  const mergedBase = mergeFinalItemRowsForDisplay(
    args.apiFinalItems,
    args.existingFinalItems.filter(isActiveFinalItemRow),
    args.items,
    args.lookups
  )
  const existingIds = new Set(mergedBase.map((row) => Number(row.item_id)))
  for (const row of importedFinalItems) {
    const id = Number(row.item_id)
    if (existingIds.has(id)) updatedOutputItems += 1
    else addedOutputItems += 1
    existingIds.add(id)
  }

  const merged = mergeFinalItemRowsForDisplay(
    importedFinalItems.map((row) => ({
      item_id: Number(row.item_id),
      item_cd: row.item_cd,
      item_nm: row.item_nm,
      itemtyp_cd: row.itemtyp_cd,
      customer_cd: row.customer_cd,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
    mergedBase,
    args.items,
    args.lookups
  )
  const finalItemRows = ensureTrailingBlankRow(
    merged,
    isBlankFinalItemRow,
    emptyEditFinalItemRow
  )

  return {
    finalItemRows,
    processDraftByItemId,
    addedOutputItems,
    updatedOutputItems,
    importedProcessItems,
  }
}

function buildDraftFromImportGroup(
  groupRows: ItemProcessExcelRow[],
  parentItemId: number,
  items: ItemListRow[],
  locations: LocationMaster[]
): { processRows: EditProcessRow[]; inputRows: EditInputRow[] } {
  const parentItem = items.find((item) => item.item_id === parentItemId)
  const processByLine = new Map<number, EditProcessRow>()
  const inputRows: EditInputRow[] = []
  let nextInputKey = 0

  for (const row of groupRows) {
    const lineText = row['Line No'].trim()
    if (!lineText) continue
    const lineNo = Number(lineText)
    if (!Number.isFinite(lineNo) || lineNo <= 0) {
      throw new Error(`Invalid Line No "${lineText}" for output item ${row['Output Item Code']}`)
    }

    if (!processByLine.has(lineNo)) {
      const wip = findLocationByCd(locations, row['WIP Location Code'])
      if (!wip) {
        throw new Error(
          `WIP location not found: ${row['WIP Location Code']} (output ${row['Output Item Code']}, line ${lineNo})`
        )
      }
      const processOutputCd = row['Process Output'].trim()
      const outputItem = processOutputCd
        ? resolveImportItem(items, processOutputCd, '')
        : undefined
      const processRow: EditProcessRow = {
        ...emptyEditProcessRow(lineNo),
        key: `import-proc-${parentItemId}-${lineNo}`,
        line_no: lineNo,
        wip_location_id: wip.location_id,
        wip_location_cd: wip.location_cd,
        output_item_id: outputItem?.item_id ?? parentItemId,
        output_item_cd: outputItem?.item_cd ?? parentItem?.item_cd ?? processOutputCd,
        output_item_nm: outputItem?.item_nm ?? parentItem?.item_nm ?? '',
      }
      processByLine.set(lineNo, processRow)
    }

    const inputCd = row['Input Item Code'].trim()
    const inputNm = row['Input Item Name'].trim()
    if (!inputCd && !inputNm) continue
    const inputItem =
      resolveImportItem(items, inputCd, inputNm) ??
      (inputCd ? findItemByCd(items, inputCd) : undefined)
    if (!inputItem) {
      throw new Error(
        `Input item could not be resolved after import: ${inputCd || inputNm} (output ${row['Output Item Code']}, line ${lineNo})`
      )
    }
    nextInputKey += 1
    inputRows.push({
      key: `import-input-${parentItemId}-${lineNo}-${nextInputKey}`,
      line_no: lineNo,
      item_id: inputItem.item_id,
      item_cd: inputItem.item_cd,
      item_nm: inputItem.item_nm,
      from_location_id: '',
      req_qty: row['Req Qty'].trim(),
      consume_qty: '',
      lot: '',
    })
  }

  const processRows = [...processByLine.values()].sort((a, b) => a.line_no - b.line_no)
  const lineNos = processRows.map((row) => row.line_no)
  const normalized = ensureItemProcessEditRows(processRows, inputRows, lineNos)
  const withTrailing = ensureTrailingBlankRow(
    normalized.processRows,
    isBlankItemProcessRow,
    (rows) => createBlankProcessRowForDetail(rows)
  )
  return { processRows: withTrailing, inputRows: normalized.inputRows }
}
