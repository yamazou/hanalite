import type { CustomerMaster, ItemListRow, ItemTyp } from '../types/masters'
import type { ItemProcessesOut, ItemProcessesSave } from '../types/itemprocs'
import { ensureTrailingBlankRow } from './gridTrailingBlankRow'
import { itemTypDropdownLabel } from './itemTypDisplay'
import {
  createBlankInputRowForDetail,
  createBlankProcessRowForDetail,
  emptyEditInputRow,
  inputRowsWithSingleTrailingBlank,
  isBlankInputRow,
  resolveRmLocationForProcessWip,
  type EditInputRow,
  type EditProcessRow,
} from './productionEdit'

let nextFinalItemKey = 0

const FINAL_ITEM_DRAFT_KEY_PREFIX = 'final-item-new-'

/** Draft row keys must not use `final-item-${item_id}` — that collides with saved rows. */
export function isDraftFinalItemKey(key: string): boolean {
  return key.startsWith(FINAL_ITEM_DRAFT_KEY_PREFIX)
}

export function newFinalItemEditKey(): string {
  nextFinalItemKey += 1
  return `${FINAL_ITEM_DRAFT_KEY_PREFIX}${nextFinalItemKey}`
}

export function stableFinalItemKey(itemId: number): string {
  return `final-item-${itemId}`
}

export type EditFinalItemRow = {
  key: string
  item_id: number | ''
  item_cd: string
  item_nm: string
  itemtyp_cd: string
  customer_cd: string
}

export type FinalItemCatalogLookups = {
  itemtypCodeById: Map<number, string>
  customerCodeById: Map<number, string>
}

export function buildFinalItemCatalogLookups(
  itemtyps: ItemTyp[],
  customers: CustomerMaster[]
): FinalItemCatalogLookups {
  const itemtypCodeById = new Map<number, string>()
  for (const t of itemtyps) {
    itemtypCodeById.set(t.itemtyp_id, itemTypDropdownLabel(t))
  }
  const customerCodeById = new Map<number, string>()
  for (const c of customers) {
    customerCodeById.set(c.customers_id, (c.customers_cd ?? '').trim())
  }
  return { itemtypCodeById, customerCodeById }
}

export function finalItemFieldsFromCatalogItem(
  item: Pick<ItemListRow, 'item_id' | 'item_cd' | 'item_nm' | 'itemtyp_id' | 'customer1_id'>,
  lookups: FinalItemCatalogLookups
): Pick<EditFinalItemRow, 'item_id' | 'item_cd' | 'item_nm' | 'itemtyp_cd' | 'customer_cd'> {
  return {
    item_id: item.item_id,
    item_cd: item.item_cd,
    item_nm: item.item_nm,
    itemtyp_cd: lookups.itemtypCodeById.get(item.itemtyp_id) ?? '',
    customer_cd:
      item.customer1_id != null
        ? lookups.customerCodeById.get(item.customer1_id) ?? ''
        : '',
  }
}

export function emptyEditFinalItemRow(): EditFinalItemRow {
  return {
    key: newFinalItemEditKey(),
    item_id: '',
    item_cd: '',
    item_nm: '',
    itemtyp_cd: '',
    customer_cd: '',
  }
}

export function isBlankFinalItemRow(row: EditFinalItemRow): boolean {
  return row.item_cd.trim() === '' && row.item_nm.trim() === ''
}

export function isActiveFinalItemRow(row: EditFinalItemRow): boolean {
  return row.item_id !== '' && row.item_cd.trim() !== '' && row.item_nm.trim() !== ''
}

export function finalItemListToEditRows(
  items: Pick<
    EditFinalItemRow,
    'item_id' | 'item_cd' | 'item_nm' | 'itemtyp_cd' | 'customer_cd'
  >[]
): EditFinalItemRow[] {
  return items.map((item) => ({
    key: stableFinalItemKey(Number(item.item_id)),
    item_id: item.item_id,
    item_cd: item.item_cd,
    item_nm: item.item_nm,
    itemtyp_cd: item.itemtyp_cd,
    customer_cd: item.customer_cd,
  }))
}

/** API rows + unsaved local rows, synced to the latest item master. */
export function mergeFinalItemRowsForDisplay(
  apiItems: Pick<
    EditFinalItemRow,
    'item_id' | 'item_cd' | 'item_nm' | 'itemtyp_cd' | 'customer_cd'
  >[],
  localRows: EditFinalItemRow[],
  catalog: ItemListRow[],
  lookups: FinalItemCatalogLookups
): EditFinalItemRow[] {
  const fromApi = finalItemListToEditRows(apiItems)
  const apiIds = new Set(fromApi.map((row) => row.item_id))
  const localOnly = localRows.filter(
    (row) => isActiveFinalItemRow(row) && !apiIds.has(Number(row.item_id))
  )
  const merged = [...fromApi, ...localOnly].map((row) => {
    if (row.item_id === '') return row
    const item = catalog.find((entry) => entry.item_id === row.item_id)
    if (item) {
      const stableKey = stableFinalItemKey(item.item_id)
      const fields = finalItemFieldsFromCatalogItem(item, lookups)
      return {
        key: isDraftFinalItemKey(row.key) ? row.key : stableKey,
        ...fields,
      }
    }
    const stableKey = stableFinalItemKey(Number(row.item_id))
    return {
      key: isDraftFinalItemKey(row.key) ? row.key : stableKey,
      item_id: row.item_id,
      item_cd: row.item_cd,
      item_nm: row.item_nm,
      itemtyp_cd: row.itemtyp_cd,
      customer_cd: row.customer_cd,
    }
  })
  const seenIds = new Set<number>()
  const deduped: EditFinalItemRow[] = []
  for (const row of merged) {
    if (row.item_id === '') {
      deduped.push(row)
      continue
    }
    const id = Number(row.item_id)
    if (seenIds.has(id)) continue
    seenIds.add(id)
    deduped.push(row)
  }
  return deduped
}

export function finalItemCdFieldPatch(
  items: ItemListRow[],
  lookups: FinalItemCatalogLookups,
  value: string
): Pick<EditFinalItemRow, 'item_id' | 'item_cd' | 'item_nm' | 'itemtyp_cd' | 'customer_cd'> {
  const trimmed = value.trim()
  const match = items.find((row) => row.item_cd === trimmed)
  if (match) {
    return finalItemFieldsFromCatalogItem(match, lookups)
  }
  return { item_id: '', item_cd: value, item_nm: '', itemtyp_cd: '', customer_cd: '' }
}

export function finalItemNmFieldPatch(
  items: ItemListRow[],
  lookups: FinalItemCatalogLookups,
  value: string
): Pick<EditFinalItemRow, 'item_id' | 'item_cd' | 'item_nm' | 'itemtyp_cd' | 'customer_cd'> {
  const trimmed = value.trim()
  const match = items.find((row) => row.item_nm === trimmed)
  if (match) {
    return finalItemFieldsFromCatalogItem(match, lookups)
  }
  return { item_id: '', item_cd: '', item_nm: value, itemtyp_cd: '', customer_cd: '' }
}

export function itemProcessesToEditProcessRows(processes: ItemProcessesOut['processes']): EditProcessRow[] {
  return processes.map((proc) => ({
    key: `itemproc-${proc.itemproc_id}`,
    line_no: proc.line_no,
    wip_location_id: proc.wip_location_id,
    rm_location_id: proc.rm_location_id,
    output_item_id: proc.output_item_id,
    output_item_cd: proc.output_item_cd,
    output_item_nm: proc.output_item_nm,
    planned_qty: '',
    actual_qty: '',
    status: 'planned',
  }))
}

export function itemProcessesToEditInputRows(processes: ItemProcessesOut['processes']): EditInputRow[] {
  const rows: EditInputRow[] = []
  for (const proc of processes) {
    for (const inp of proc.inputs) {
      rows.push({
        key: `itemproc-input-${inp.itemproc_input_id}`,
        line_no: proc.line_no,
        item_id: inp.item_id,
        item_cd: inp.item_cd,
        item_nm: inp.item_nm,
        from_location_id: inp.from_location_id,
        req_qty: String(inp.req_qty),
        consume_qty: '',
        lot: '',
      })
    }
    rows.push(emptyEditInputRow(proc.line_no))
  }
  return rows
}

export function isBlankItemProcessRow(row: EditProcessRow): boolean {
  return row.wip_location_id === ''
}

export function isBlankItemProcessInputRow(row: EditInputRow): boolean {
  return (
    row.item_id === '' &&
    !row.item_cd.trim() &&
    !row.item_nm.trim() &&
    row.from_location_id === '' &&
    !row.req_qty.trim()
  )
}

export function isActiveItemProcessInputRow(row: EditInputRow): boolean {
  return (
    row.item_id !== '' &&
    row.from_location_id !== '' &&
    Boolean(row.req_qty.trim()) &&
    Number(row.req_qty) > 0
  )
}

/** RM location: previous step WIP, row value, or first input From Location (first step). */
export function resolveItemProcessRmLocation(
  row: EditProcessRow,
  processRows: EditProcessRow[],
  inputRows: EditInputRow[]
): number | '' {
  const chained = resolveRmLocationForProcessWip(row.wip_location_id, row.key, processRows)
  if (chained !== '') return chained
  if (row.rm_location_id !== '') return row.rm_location_id
  const lineInputs = inputRows
    .filter((inp) => inp.line_no === row.line_no && isActiveItemProcessInputRow(inp))
    .sort((a, b) => a.key.localeCompare(b.key))
  const fromId = lineInputs[0]?.from_location_id
  return fromId !== '' && fromId != null ? fromId : ''
}

function isActiveItemProcessRow(
  row: EditProcessRow,
  allRows: EditProcessRow[],
  inputRows: EditInputRow[]
): boolean {
  if (row.wip_location_id === '') return false
  return resolveItemProcessRmLocation(row, allRows, inputRows) !== ''
}

function resolveItemProcessOutputItemId(
  proc: EditProcessRow,
  activeRows: EditProcessRow[],
  parentItemId: number
): number {
  if (proc.output_item_id !== '') return Number(proc.output_item_id)
  const sorted = [...activeRows].sort((a, b) => a.line_no - b.line_no)
  const idx = sorted.findIndex((row) => row.key === proc.key)
  if (idx < 0) return parentItemId
  if (idx === sorted.length - 1) return parentItemId
  const prev = sorted[idx - 1]
  if (prev.output_item_id !== '') return Number(prev.output_item_id)
  return parentItemId
}

export function editRowsToItemProcessesSave(
  processRows: EditProcessRow[],
  inputRows: EditInputRow[],
  parentItemId: number
): ItemProcessesSave {
  const activeProcesses = processRows
    .filter((row) => isActiveItemProcessRow(row, processRows, inputRows))
    .sort((a, b) => a.line_no - b.line_no)
  const processes = activeProcesses.map((proc) => {
      const rmId = resolveItemProcessRmLocation(proc, processRows, inputRows)
      const outputItemId = resolveItemProcessOutputItemId(proc, activeProcesses, parentItemId)
      const inputs = inputRows
        .filter((row) => row.line_no === proc.line_no && isActiveItemProcessInputRow(row))
        .map((inp, index) => ({
          input_no: index + 1,
          item_id: Number(inp.item_id),
          from_location_id: Number(inp.from_location_id),
          req_qty: Number(inp.req_qty),
        }))
      return {
        line_no: proc.line_no,
        wip_location_id: Number(proc.wip_location_id),
        rm_location_id: Number(rmId),
        output_item_id: outputItemId,
        inputs,
      }
    })
  return { processes }
}

export function ensureItemProcessEditRows(
  processRows: EditProcessRow[],
  inputRows: EditInputRow[],
  processLineNos: number[]
): { processRows: EditProcessRow[]; inputRows: EditInputRow[] } {
  const withTrailing = ensureTrailingBlankRow(
    processRows,
    isBlankItemProcessRow,
    (rows) => createBlankProcessRowForDetail(rows)
  )
  const lineNos =
    processLineNos.length > 0
      ? processLineNos
      : withTrailing.filter((row) => !isBlankItemProcessRow(row)).map((row) => row.line_no)
  const nextInput: EditInputRow[] = []
  for (const lineNo of lineNos) {
    nextInput.push(
      ...inputRowsWithSingleTrailingBlank(
        inputRows.filter((row) => row.line_no === lineNo),
        () => emptyEditInputRow(lineNo),
        isBlankItemProcessInputRow
      )
    )
  }
  if (lineNos.length === 0) {
    nextInput.push(emptyEditInputRow(1))
  }
  return { processRows: withTrailing, inputRows: nextInput }
}
