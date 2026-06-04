import type { CustomerMaster, ItemListRow, ItemTyp, LocationMaster } from '../types/masters'
import { resolveInputFromLocationCdForStep, resolveInputFromLocationIdForStep } from './inputFromLocation'
import { EMPTY_MASTER_ROW_DATES, type MasterRowDates } from './masterGridDates'
import type { ItemProcessesOut, ItemProcessesSave } from '../types/itemprocs'
import { buildRecordSnapshotMap, isChangedActiveRow } from './gridRowChange'
import { ensureTrailingBlankRow } from './gridTrailingBlankRow'
import { itemTypDropdownLabel } from './itemTypDisplay'
import {
  createBlankInputRowForDetail,
  createBlankProcessRowForDetail,
  editInputText,
  emptyEditInputRow,
  inputRowsWithSingleTrailingBlank,
  isBlankInputRow,
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
} & MasterRowDates

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
  item: Pick<
    ItemListRow,
    | 'item_id'
    | 'item_cd'
    | 'item_nm'
    | 'itemtyp_id'
    | 'customer1_id'
    | 'created_at'
    | 'updated_at'
  >,
  lookups: FinalItemCatalogLookups
): Pick<
  EditFinalItemRow,
  'item_id' | 'item_cd' | 'item_nm' | 'itemtyp_cd' | 'customer_cd' | 'created_at' | 'updated_at'
> {
  return {
    item_id: item.item_id,
    item_cd: item.item_cd,
    item_nm: item.item_nm,
    itemtyp_cd:
      item.itemtyp_id != null
        ? lookups.itemtypCodeById.get(item.itemtyp_id) ?? ''
        : '',
    customer_cd:
      item.customer1_id != null
        ? lookups.customerCodeById.get(item.customer1_id) ?? ''
        : '',
    created_at: item.created_at ?? null,
    updated_at: item.updated_at ?? null,
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
    ...EMPTY_MASTER_ROW_DATES,
  }
}

/** Trailing row until item_id is resolved (partial Item Code/Name typing stays on sentinel row). */
export function isBlankFinalItemRow(row: EditFinalItemRow): boolean {
  return row.item_id === ''
}

export function isActiveFinalItemRow(row: EditFinalItemRow): boolean {
  return row.item_id !== '' && row.item_cd.trim() !== ''
}

function findItemListRowByCd(
  items: ItemListRow[],
  cd: string
): ItemListRow | undefined {
  const trimmed = cd.trim()
  if (!trimmed) return undefined
  const lower = trimmed.toLowerCase()
  return items.find((row) => row.item_cd.toLowerCase() === lower)
}

function findItemListRowByNm(
  items: ItemListRow[],
  nm: string
): ItemListRow | undefined {
  const trimmed = nm.trim()
  if (!trimmed) return undefined
  return items.find((row) => row.item_nm === trimmed)
}

export type FinalItemRowSnapshot = {
  item_id: number
}

export function finalItemRowSnapshot(row: EditFinalItemRow): FinalItemRowSnapshot | null {
  if (!isActiveFinalItemRow(row)) return null
  return { item_id: Number(row.item_id) }
}

export function finalItemRowSnapshotsFromEditRows(
  rows: EditFinalItemRow[]
): Map<number, FinalItemRowSnapshot> {
  return buildRecordSnapshotMap(
    rows,
    (row) => (row.item_id !== '' ? Number(row.item_id) : undefined),
    finalItemRowSnapshot
  )
}

export function isOutputItemListDirty(
  rows: EditFinalItemRow[],
  savedSnapshots: Map<number, FinalItemRowSnapshot>
): boolean {
  const active = rows.filter(isActiveFinalItemRow)
  if (active.length !== savedSnapshots.size) return true
  return active.some((row) =>
    isChangedActiveRow(
      row,
      isActiveFinalItemRow,
      (r) => (r.item_id !== '' ? Number(r.item_id) : undefined),
      finalItemRowSnapshot,
      savedSnapshots
    )
  )
}

export function finalItemListToEditRows(
  items: Pick<
    EditFinalItemRow,
    | 'item_id'
    | 'item_cd'
    | 'item_nm'
    | 'itemtyp_cd'
    | 'customer_cd'
    | 'created_at'
    | 'updated_at'
  >[]
): EditFinalItemRow[] {
  return items.map((item) => ({
    key: stableFinalItemKey(Number(item.item_id)),
    item_id: item.item_id,
    item_cd: item.item_cd,
    item_nm: item.item_nm,
    itemtyp_cd: item.itemtyp_cd,
    customer_cd: item.customer_cd,
    created_at: item.created_at ?? null,
    updated_at: item.updated_at ?? null,
  }))
}

/** API rows + unsaved local rows, synced to the latest item master. */
export function mergeFinalItemRowsForDisplay(
  apiItems: Pick<
    EditFinalItemRow,
    | 'item_id'
    | 'item_cd'
    | 'item_nm'
    | 'itemtyp_cd'
    | 'customer_cd'
    | 'created_at'
    | 'updated_at'
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
      created_at: row.created_at,
      updated_at: row.updated_at,
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
): Pick<
  EditFinalItemRow,
  'item_id' | 'item_cd' | 'item_nm' | 'itemtyp_cd' | 'customer_cd' | 'created_at' | 'updated_at'
> {
  const match = findItemListRowByCd(items, value)
  if (match) {
    return finalItemFieldsFromCatalogItem(match, lookups)
  }
  return {
    item_id: '',
    item_cd: value,
    item_nm: '',
    itemtyp_cd: '',
    customer_cd: '',
    ...EMPTY_MASTER_ROW_DATES,
  }
}

export function finalItemNmFieldPatch(
  items: ItemListRow[],
  lookups: FinalItemCatalogLookups,
  value: string
): Pick<
  EditFinalItemRow,
  'item_id' | 'item_cd' | 'item_nm' | 'itemtyp_cd' | 'customer_cd' | 'created_at' | 'updated_at'
> {
  const match = findItemListRowByNm(items, value)
  if (match) {
    return finalItemFieldsFromCatalogItem(match, lookups)
  }
  return {
    item_id: '',
    item_cd: '',
    item_nm: value,
    itemtyp_cd: '',
    customer_cd: '',
    ...EMPTY_MASTER_ROW_DATES,
  }
}

export function itemProcessesToEditProcessRows(processes: ItemProcessesOut['processes']): EditProcessRow[] {
  return processes.map((proc) => ({
    key: `itemproc-${proc.itemproc_id}`,
    line_no: proc.line_no,
    wip_location_id: proc.wip_location_id,
    wip_location_cd: proc.wip_location_cd,
    rm_location_id: '',
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
        from_location_id: '',
        req_qty: inp.req_qty != null ? String(inp.req_qty) : '',
        consume_qty: '',
        lot: '',
      })
    }
    rows.push(emptyEditInputRow(proc.line_no))
  }
  return rows
}

/** Align grid from-location with current item-type warehouse rules (not stale API ids). */
export function syncItemProcessInputFromLocations(
  inputRows: EditInputRow[],
  processRows: EditProcessRow[],
  locations: LocationMaster[],
  items: { item_id: number; itemtyp_id?: number }[],
  itemtyps: ItemTyp[]
): EditInputRow[] {
  return inputRows.map((row) => {
    if (row.item_id === '') return row
    const from_location_id = resolveItemProcessInputFromLocationId(
      row.line_no,
      row.item_id,
      processRows,
      locations,
      items,
      itemtyps
    )
    return { ...row, from_location_id }
  })
}

export function isBlankItemProcessRow(row: EditProcessRow): boolean {
  return row.wip_location_id === ''
}

/** First process step: item type's location-type warehouse; later steps: previous WIP. */
export function resolveItemProcessInputFromLocationId(
  lineNo: number,
  inputItemId: number | '',
  processRows: EditProcessRow[],
  locations: LocationMaster[],
  items: { item_id: number; itemtyp_id?: number }[],
  itemtyps: ItemTyp[]
): number | '' {
  return resolveInputFromLocationIdForStep(
    lineNo,
    inputItemId,
    processRows,
    locations,
    items,
    itemtyps,
    isBlankItemProcessRow
  )
}

export function resolveItemProcessInputFromLocationCd(
  lineNo: number,
  inputItemId: number | '',
  processRows: EditProcessRow[],
  locations: LocationMaster[],
  items: { item_id: number; itemtyp_id?: number }[],
  itemtyps: ItemTyp[]
): string {
  return resolveInputFromLocationCdForStep(
    lineNo,
    inputItemId,
    processRows,
    locations,
    items,
    itemtyps,
    isBlankItemProcessRow
  )
}

/** Trailing row until item_id is resolved (partial Item Code/Name typing stays on sentinel row). */
export function isBlankItemProcessInputRow(row: EditInputRow): boolean {
  return row.item_id === '' && !String(row.req_qty ?? '').trim()
}

export function isActiveItemProcessInputRow(row: EditInputRow): boolean {
  return row.item_id !== ''
}

export function isCompleteItemProcessInputRow(row: EditInputRow): boolean {
  return row.item_id !== '' && editInputText(row.req_qty).trim() !== ''
}

/** Fill item_id / item_nm from Items master when Item Code matches. */
export function resolveItemProcessInputRowsFromCatalog(
  items: ItemListRow[],
  inputRows: EditInputRow[]
): EditInputRow[] {
  return inputRows.map((row) => {
    if (row.item_id !== '') return row
    const cd = editInputText(row.item_cd).trim()
    if (!cd) return row
    const lower = cd.toLowerCase()
    const match = items.find((item) => item.item_cd.trim().toLowerCase() === lower)
    if (!match) return row
    return {
      ...row,
      item_id: match.item_id,
      item_cd: match.item_cd,
      item_nm: match.item_nm,
    }
  })
}

/** Returns a user-facing reason when inputs are missing or incomplete. */
export function itemProcessInputSaveValidationMessage(
  processRows: EditProcessRow[],
  inputRows: EditInputRow[],
  items: ItemListRow[],
  options?: { requireInputsWhenProcessesExist?: boolean }
): string | null {
  const activeProcesses = processRows
    .filter((row) => !isBlankItemProcessRow(row))
    .sort((a, b) => a.line_no - b.line_no)
  if (activeProcesses.length === 0) return null

  const processLabel = (lineNo: number) => {
    const proc = activeProcesses.find((p) => p.line_no === lineNo)
    const wip = proc?.wip_location_cd?.trim()
    return wip ? `Process line ${lineNo} (${wip})` : `Process line ${lineNo}`
  }

  const resolvedInputs = resolveItemProcessInputRowsFromCatalog(items, inputRows)
  const attempted = resolvedInputs.filter((row) => !isBlankItemProcessInputRow(row))
  const completeInputs = resolvedInputs.filter((row) => isCompleteItemProcessInputRow(row))

  for (const row of attempted) {
    if (isCompleteItemProcessInputRow(row)) continue
    const cd = editInputText(row.item_cd).trim()
    if (row.item_id === '' && cd) {
      return `${processLabel(row.line_no)}: item code "${cd}" was not found in Items master.`
    }
    if (row.item_id !== '' && !editInputText(row.req_qty).trim()) {
      return `${processLabel(row.line_no)}: enter Req Qty for ${cd || 'input item'} before saving.`
    }
    return `${processLabel(row.line_no)}: complete Item Code and Req Qty before saving.`
  }

  if (options?.requireInputsWhenProcessesExist && completeInputs.length === 0) {
    return 'Enter at least one input item before saving.'
  }

  return null
}

function isActiveItemProcessRow(row: EditProcessRow): boolean {
  return row.wip_location_id !== ''
}

function resolveItemProcessOutputItemId(
  proc: EditProcessRow,
  activeRows: EditProcessRow[],
  inputRows: EditInputRow[],
  parentItemId: number
): number {
  if (proc.output_item_id !== '') return Number(proc.output_item_id)
  const sorted = [...activeRows].sort((a, b) => a.line_no - b.line_no)
  const idx = sorted.findIndex((row) => row.key === proc.key)
  if (idx < 0) return parentItemId
  if (idx === sorted.length - 1) return parentItemId

  const nextProc = sorted[idx + 1]
  const nextInputs = inputRows
    .filter(
      (row) => row.line_no === nextProc.line_no && isActiveItemProcessInputRow(row)
    )
    .sort((a, b) => a.key.localeCompare(b.key))
  if (nextInputs.length > 0) return Number(nextInputs[0].item_id)

  if (idx > 0) {
    const prev = sorted[idx - 1]
    if (prev.output_item_id !== '') return Number(prev.output_item_id)
  }

  const lineInputs = inputRows
    .filter((row) => row.line_no === proc.line_no && isActiveItemProcessInputRow(row))
    .sort((a, b) => a.key.localeCompare(b.key))
  if (lineInputs.length > 0) return Number(lineInputs[0].item_id)

  return parentItemId
}

/** Normalize all process lines, resolve item ids, and infer output items before save. */
export function prepareItemProcessDraftForSave(
  processRows: EditProcessRow[],
  inputRows: EditInputRow[],
  parentItemId: number,
  items: ItemListRow[]
): { processRows: EditProcessRow[]; inputRows: EditInputRow[] } {
  const lineNos = processRows
    .filter((row) => !isBlankItemProcessRow(row))
    .map((row) => row.line_no)
  const normalized = ensureItemProcessEditRows(processRows, inputRows, lineNos)
  const resolvedInputs = resolveItemProcessInputRowsFromCatalog(items, normalized.inputRows)
  const activeProcesses = normalized.processRows.filter((row) => !isBlankItemProcessRow(row))

  const processWithOutput = normalized.processRows.map((proc) => {
    if (isBlankItemProcessRow(proc)) return proc
    const outputItemId = resolveItemProcessOutputItemId(
      proc,
      activeProcesses,
      resolvedInputs,
      parentItemId
    )
    if (proc.output_item_id !== '') return proc
    const item = items.find((entry) => entry.item_id === outputItemId)
    return {
      ...proc,
      output_item_id: outputItemId,
      output_item_cd: item?.item_cd ?? proc.output_item_cd,
      output_item_nm: item?.item_nm ?? proc.output_item_nm,
    }
  })

  return { processRows: processWithOutput, inputRows: resolvedInputs }
}

export function editRowsToItemProcessesSave(
  processRows: EditProcessRow[],
  inputRows: EditInputRow[],
  parentItemId: number
): ItemProcessesSave {
  const activeProcesses = processRows
    .filter((row) => isActiveItemProcessRow(row))
    .sort((a, b) => a.line_no - b.line_no)
  const processes = activeProcesses.map((proc) => {
      const outputItemId = resolveItemProcessOutputItemId(
        proc,
        activeProcesses,
        inputRows,
        parentItemId
      )
      const inputs = inputRows
        .filter((row) => row.line_no === proc.line_no && isActiveItemProcessInputRow(row))
        .map((inp, index) => ({
          input_no: index + 1,
          item_id: Number(inp.item_id),
          req_qty: editInputText(inp.req_qty).trim() ? Number(inp.req_qty) : null,
        }))
      return {
        line_no: proc.line_no,
        wip_location_id: Number(proc.wip_location_id),
        output_item_id: outputItemId,
        inputs,
      }
    })
  return { processes }
}

export function itemProcessesSaveFromOut(data: ItemProcessesOut): ItemProcessesSave {
  return {
    processes: data.processes.map((proc) => ({
      line_no: proc.line_no,
      wip_location_id: proc.wip_location_id,
      output_item_id: proc.output_item_id,
      inputs: proc.inputs.map((inp) => ({
        input_no: inp.input_no,
        item_id: inp.item_id,
        req_qty: inp.req_qty != null ? Number(inp.req_qty) : null,
      })),
    })),
  }
}

export function serializeItemProcessesSave(payload: ItemProcessesSave): string {
  const normalized = {
    processes: [...payload.processes]
      .sort((a, b) => a.line_no - b.line_no)
      .map((proc) => ({
        line_no: proc.line_no,
        wip_location_id: proc.wip_location_id,
        output_item_id: proc.output_item_id,
        inputs: [...proc.inputs].sort((a, b) => a.input_no - b.input_no),
      })),
  }
  return JSON.stringify(normalized)
}

/** Draft edit state (includes partial process/input rows) for dirty detection. */
export function serializeItemProcessEditDraft(
  processRows: EditProcessRow[],
  inputRows: EditInputRow[],
  itemId: number
): string {
  const processes = processRows
    .filter((row) => !isBlankItemProcessRow(row))
    .sort((a, b) => a.line_no - b.line_no)
    .map((row) => ({
      line_no: row.line_no,
      wip_location_id: row.wip_location_id,
      output_item_id: row.output_item_id,
    }))
  const inputs = inputRows
    .filter((row) => !isBlankItemProcessInputRow(row))
    .sort((a, b) => a.line_no - b.line_no || a.key.localeCompare(b.key))
    .map((row) => ({
      line_no: row.line_no,
      item_id: row.item_id,
      item_cd: editInputText(row.item_cd).trim(),
      item_nm: editInputText(row.item_nm).trim(),
      req_qty: editInputText(row.req_qty).trim(),
    }))
  return JSON.stringify({ item_id: itemId, processes, inputs })
}

export function isItemProcessEditDirty(
  itemId: number,
  processRows: EditProcessRow[],
  inputRows: EditInputRow[],
  savedDraftJsonByItemId: Map<number, string>
): boolean {
  const current = serializeItemProcessEditDraft(processRows, inputRows, itemId)
  const saved = savedDraftJsonByItemId.get(itemId)
  const empty = serializeItemProcessEditDraft([], [], itemId)
  if (saved == null) return current !== empty
  return current !== saved
}

export function isItemProcessPayloadDirty(
  itemId: number,
  processRows: EditProcessRow[],
  inputRows: EditInputRow[],
  savedPayloadJsonByItemId: Map<number, string>
): boolean {
  const current = serializeItemProcessesSave(
    editRowsToItemProcessesSave(processRows, inputRows, itemId)
  )
  const saved = savedPayloadJsonByItemId.get(itemId)
  const empty = serializeItemProcessesSave({ processes: [] })
  if (saved == null) return current !== empty
  return current !== saved
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
