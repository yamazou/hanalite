import type {

  ProductionOrderDetail,

  ProductionOrderInput,

  ProductionOrderInputWritePayload,

  ProductionOrderLine,

  ProductionOrderLineWritePayload,

  ProductionStatus,

} from '../types/production'

import type { Item } from '../types'
import type { ItemProcInput, ItemProcessesOut } from '../types/itemprocs'
import { ensureTrailingBlankRow } from './gridTrailingBlankRow'

import { findItemByCd, findItemByNm } from './draftEdit'



export type EditProcessRow = {

  key: string

  prd_order_line_id?: number

  line_no: number

  wip_location_id: number | ''

  wip_location_cd: string

  /** Kept for API payload; not shown in Process grid */

  rm_location_id: number | ''

  output_item_id: number | ''

  output_item_cd: string

  output_item_nm: string

  planned_qty: string

  actual_qty: string

  status: ProductionOrderLine['status'] | ''

}



export type EditInputRow = {

  key: string

  prd_order_input_id?: number

  line_no: number

  item_id: number | ''

  item_cd: string

  item_nm: string

  from_location_id: number | ''

  req_qty: string

  consume_qty: string

  lot: string

}



let nextKey = 0

export function newEditKey(): string {

  nextKey += 1

  return `new-${nextKey}`

}



export function actualQtyForEdit(
  actual: string | number | null | undefined,
  status: ProductionStatus
): string {
  if (status === 'registered') return ''
  if (actual == null || actual === '') return ''
  return String(actual)
}

export function lineToEditProcessRow(
  ln: ProductionOrderLine,
  status: ProductionStatus
): EditProcessRow {

  return {

    key: `line-${ln.prd_order_line_id}`,

    prd_order_line_id: ln.prd_order_line_id,

    line_no: ln.line_no,

    wip_location_id: ln.wip_location_id,

    wip_location_cd: ln.wip_location_cd ?? '',

    rm_location_id: ln.rm_location_id,

    output_item_id: ln.output_item_id ?? '',

    output_item_cd: ln.output_item_cd ?? '',

    output_item_nm: ln.output_item_nm ?? '',

    planned_qty: ln.planned_qty != null ? String(ln.planned_qty) : '',

    actual_qty: actualQtyForEdit(ln.actual_qty, status),

    status: ln.status,

  }

}



export function consumeQtyForEdit(
  consume: string | number | null | undefined,
  req: string | number,
  status: ProductionStatus,
  orderPlannedQty?: string | number | null
): string {
  if (status === 'registered') return ''
  if (consume == null || consume === '') return ''
  const consumeNum = Number(consume)
  if (Number.isNaN(consumeNum)) return ''
  const reqNum = Number(req)
  if (Number(consumeNum) === reqNum) return ''
  if (orderPlannedQty != null) {
    const plannedNum = Number(orderPlannedQty)
    if (Number.isFinite(plannedNum) && consumeNum === reqNum * plannedNum) return ''
  }
  return String(consume)
}

export type InputConsumeQtyContext = {
  status: ProductionStatus
  orderPlannedQty: string | number
  processRows?: EditProcessRow[]
}

export type ProcessPayloadContext = {
  parentItemId: number
  orderPlannedQty: string | number
}

export function resolveInputConsumeQty(
  row: EditInputRow,
  context?: InputConsumeQtyContext
): number {
  const raw = row.consume_qty.trim()
  if (raw) return Number(raw)
  const req = Number(row.req_qty)
  if (context && Number.isFinite(req)) {
    const planned = Number(context.orderPlannedQty)
    if (Number.isFinite(planned)) {
      return req * planned
    }
  }
  return req
}

export function inputToEditInputRow(
  ln: ProductionOrderInput,
  status: ProductionStatus,
  orderPlannedQty: string | number
): EditInputRow {

  return {

    key: `input-${ln.prd_order_input_id}`,

    prd_order_input_id: ln.prd_order_input_id,

    line_no: ln.line_no,

    item_id: ln.item_id,

    item_cd: ln.item_cd,

    item_nm: ln.item_nm,

    from_location_id: ln.from_location_id ?? '',

    req_qty: String(ln.req_qty),

    consume_qty: consumeQtyForEdit(ln.consume_qty, ln.req_qty, status, orderPlannedQty),

    lot: ln.lot ?? '',

  }

}



export function emptyEditProcessRow(lineNo: number): EditProcessRow {
  return {
    key: newEditKey(),
    line_no: lineNo,
    wip_location_id: '',
    wip_location_cd: '',
    rm_location_id: '',
    output_item_id: '',
    output_item_cd: '',
    output_item_nm: '',
    planned_qty: '',
    actual_qty: '',
    status: '',
  }
}



export function emptyEditInputRow(lineNo: number): EditInputRow {
  return {
    key: newEditKey(),
    line_no: lineNo,
    item_id: '',
    item_cd: '',
    item_nm: '',
    from_location_id: '',
    req_qty: '',
    consume_qty: '',
    lot: '',
  }
}



export function processItemCdFieldPatch(

  items: Item[],

  value: string

): Pick<EditProcessRow, 'output_item_id' | 'output_item_cd' | 'output_item_nm'> {

  const match = findItemByCd(items, value)

  if (match) {

    return {

      output_item_id: match.item_id,

      output_item_cd: match.item_cd,

      output_item_nm: match.item_nm,

    }

  }

  return { output_item_id: '', output_item_cd: value, output_item_nm: '' }

}

export function processItemNmFieldPatch(
  items: Item[],
  value: string
): Pick<EditProcessRow, 'output_item_id' | 'output_item_cd' | 'output_item_nm'> {
  const match = findItemByNm(items, value)
  if (match) {
    return {
      output_item_id: match.item_id,
      output_item_cd: match.item_cd,
      output_item_nm: match.item_nm,
    }
  }
  return { output_item_id: '', output_item_cd: '', output_item_nm: value }
}

export function isBlankProcessRow(row: EditProcessRow): boolean {
  return (
    row.wip_location_id === '' &&
    row.rm_location_id === '' &&
    !row.output_item_cd.trim() &&
    !row.output_item_nm.trim() &&
    !row.planned_qty.trim() &&
    !row.actual_qty.trim() &&
    row.status === ''
  )
}

/** RM (from) location for a process step: previous step's WIP, or existing rm on the row. */
export function resolveRmLocationForProcessWip(
  wipLocationId: number | '',
  rowKey: string,
  rows: EditProcessRow[]
): number | '' {
  if (wipLocationId === '') return ''
  const current = rows.find((r) => r.key === rowKey)
  if (current && current.rm_location_id !== '') return current.rm_location_id
  const predecessors = rows
    .filter(
      (r) =>
        r.key !== rowKey &&
        !isBlankProcessRow(r) &&
        r.wip_location_id !== '' &&
        (current == null || r.line_no < current.line_no)
    )
    .sort((a, b) => a.line_no - b.line_no)
  const prev = predecessors[predecessors.length - 1]
  return prev?.wip_location_id ?? ''
}

export function processWipLocationPatch(
  wipLocationId: number | '',
  rowKey: string,
  rows: EditProcessRow[]
): Pick<EditProcessRow, 'wip_location_id' | 'rm_location_id'> {
  return {
    wip_location_id: wipLocationId,
    rm_location_id: resolveRmLocationForProcessWip(wipLocationId, rowKey, rows),
  }
}

export function findLocationByCd(
  locations: Array<{ location_id: number; location_cd: string }>,
  cd: string
): { location_id: number; location_cd: string } | undefined {
  const trimmed = cd.trim()
  if (!trimmed) return undefined
  const lower = trimmed.toLowerCase()
  return locations.find((loc) => loc.location_cd.toLowerCase() === lower)
}

export function processLocationCdDisplay(
  row: EditProcessRow,
  locations: Array<{ location_id: number; location_cd: string }>
): string {
  if (row.wip_location_cd.trim()) return row.wip_location_cd
  if (row.wip_location_id !== '') {
    return locations.find((loc) => loc.location_id === row.wip_location_id)?.location_cd ?? ''
  }
  return ''
}

export function processWipLocationCdFieldPatch(
  locations: Array<{ location_id: number; location_cd: string; location_nm?: string }>,
  value: string,
  rowKey: string,
  rows: EditProcessRow[]
): Pick<EditProcessRow, 'wip_location_id' | 'wip_location_cd' | 'rm_location_id'> {
  const match = findLocationByCd(locations, value)
  if (match) {
    return {
      ...processWipLocationPatch(match.location_id, rowKey, rows),
      wip_location_cd: match.location_cd,
    }
  }
  return {
    wip_location_id: '',
    wip_location_cd: value,
    rm_location_id: '',
  }
}

export function resolveProcessOutputItemId(
  row: EditProcessRow,
  items?: Item[]
): number | '' {
  if (row.output_item_id !== '') return row.output_item_id
  if (!items?.length) return ''
  const cd = row.output_item_cd.trim()
  if (!cd) return ''
  const match = findItemByCd(items, cd)
  return match ? match.item_id : ''
}

/** Process step is valid when WIP location is set (output item / plan qty filled on save). */
export function isActiveProcessRow(
  row: EditProcessRow,
  _allRows?: EditProcessRow[],
  _items?: Item[]
): boolean {
  return row.wip_location_id !== '' && !isBlankProcessRow(row)
}

export function resolveProcessOutputItemIdForSave(
  row: EditProcessRow,
  activeRows: EditProcessRow[],
  items: Item[] | undefined,
  parentItemId: number
): number {
  const fromRow = resolveProcessOutputItemId(row, items)
  if (fromRow !== '') return Number(fromRow)
  const sorted = [...activeRows].sort((a, b) => a.line_no - b.line_no)
  const idx = sorted.findIndex((entry) => entry.key === row.key)
  if (idx < 0 || idx === sorted.length - 1) return parentItemId
  const prevOut = resolveProcessOutputItemId(sorted[idx - 1], items)
  return prevOut !== '' ? Number(prevOut) : parentItemId
}

function resolveProcessPlannedQty(
  row: EditProcessRow,
  orderPlannedQty: string | number
): number {
  const fromRow = Number(row.planned_qty)
  if (row.planned_qty.trim() && Number.isFinite(fromRow) && fromRow > 0) return fromRow
  const planned = Number(orderPlannedQty)
  return Number.isFinite(planned) && planned > 0 ? planned : fromRow
}

export function resolveInputFromLocationId(
  row: EditInputRow,
  processRows: EditProcessRow[]
): number | '' {
  if (row.from_location_id !== '') return row.from_location_id
  const proc = processRows.find(
    (entry) => entry.line_no === row.line_no && !isBlankProcessRow(entry)
  )
  if (!proc) return ''
  const rm =
    proc.rm_location_id !== ''
      ? proc.rm_location_id
      : resolveRmLocationForProcessWip(proc.wip_location_id, proc.key, processRows)
  return rm !== '' ? rm : proc.wip_location_id
}

export function editInputText(value: string | number | null | undefined): string {
  if (value == null) return ''
  return String(value)
}

export function isBlankInputRow(row: EditInputRow): boolean {
  return (
    row.item_id === '' &&
    !editInputText(row.req_qty).trim() &&
    !editInputText(row.consume_qty).trim() &&
    !editInputText(row.lot).trim()
  )
}

/** Drop extra trailing blanks, then keep exactly one empty input row at the end. */
export function inputRowsWithSingleTrailingBlank(
  rows: EditInputRow[],
  createBlank: (existing: EditInputRow[]) => EditInputRow,
  isBlank: (row: EditInputRow) => boolean = isBlankInputRow
): EditInputRow[] {
  const data = rows.filter((row) => !isBlank(row))
  const blanks = rows.filter((row) => isBlank(row))
  if (data.length === 0 && blanks.length === 1) return rows
  return ensureTrailingBlankRow(data, isBlank, createBlank)
}

export function isActiveInputRow(row: EditInputRow): boolean {
  const reqQty = editInputText(row.req_qty).trim()
  return row.item_id !== '' && Boolean(reqQty) && Number(reqQty) > 0
}



export function itemCdFieldPatch(

  items: Item[],

  value: string

): Pick<EditInputRow, 'item_id' | 'item_cd' | 'item_nm'> {

  const match = findItemByCd(items, value)

  if (match) {

    return { item_id: match.item_id, item_cd: match.item_cd, item_nm: match.item_nm }

  }

  return { item_id: '', item_cd: value, item_nm: '' }

}



export function itemNmFieldPatch(

  items: Item[],

  value: string

): Pick<EditInputRow, 'item_id' | 'item_cd' | 'item_nm'> {

  const match = findItemByNm(items, value)

  if (match) {

    return { item_id: match.item_id, item_cd: match.item_cd, item_nm: match.item_nm }

  }

  return { item_id: '', item_cd: '', item_nm: value }

}



export function buildProcessPayload(
  rows: EditProcessRow[],
  items?: Item[],
  context?: ProcessPayloadContext
): ProductionOrderLineWritePayload[] {
  const activeRows = rows
    .filter((row) => isActiveProcessRow(row, rows, items))
    .sort((a, b) => a.line_no - b.line_no)

  return activeRows.map((row) => {
    const actualRaw = row.actual_qty.trim()
    let rmId =
      row.rm_location_id !== ''
        ? row.rm_location_id
        : resolveRmLocationForProcessWip(row.wip_location_id, row.key, rows)
    if (rmId === '') rmId = row.wip_location_id

    const outputItemId =
      context != null
        ? resolveProcessOutputItemIdForSave(row, activeRows, items, context.parentItemId)
        : Number(resolveProcessOutputItemId(row, items))

    const plannedQty =
      context != null
        ? resolveProcessPlannedQty(row, context.orderPlannedQty)
        : Number(row.planned_qty)

    return {
      ...(row.prd_order_line_id != null && row.prd_order_line_id > 0
        ? { prd_order_line_id: row.prd_order_line_id }
        : {}),
      line_no: row.line_no,
      rm_location_id: Number(rmId),
      wip_location_id: Number(row.wip_location_id),
      output_item_id: outputItemId,
      planned_qty: plannedQty,
      actual_qty: actualRaw ? Number(actualRaw) : null,
    }
  })
}



export function buildInputPayload(
  rows: EditInputRow[],
  context?: InputConsumeQtyContext
): ProductionOrderInputWritePayload[] {
  const processRows = context?.processRows ?? []

  return rows
    .filter(isActiveInputRow)
    .map((row) => {
      const fromLocationId = resolveInputFromLocationId(row, processRows)
      if (fromLocationId === '') return null
      const consumeQty = resolveInputConsumeQty(row, context)
      if (!Number.isFinite(consumeQty) || consumeQty <= 0) return null
      return {
        ...(row.prd_order_input_id != null && row.prd_order_input_id > 0
          ? { prd_order_input_id: row.prd_order_input_id }
          : {}),
        line_no: row.line_no,
        item_id: Number(row.item_id),
        from_location_id: Number(fromLocationId),
        req_qty: Number(row.req_qty),
        consume_qty: consumeQty,
        lot: row.lot.trim() || null,
      }
    })
    .filter((row): row is ProductionOrderInputWritePayload => row != null)
}



export function bomPreviewToEditProcessRows(
  lines: ProductionOrderLine[],
  status: ProductionStatus
): EditProcessRow[] {
  return lines.map((ln) => ({
    key: `preview-line-${ln.line_no}`,
    line_no: ln.line_no,
    wip_location_id: ln.wip_location_id,
    wip_location_cd: ln.wip_location_cd ?? '',
    rm_location_id: ln.rm_location_id,
    output_item_id: ln.output_item_id ?? '',
    output_item_cd: ln.output_item_cd ?? '',
    output_item_nm: ln.output_item_nm ?? '',
    planned_qty: ln.planned_qty != null ? String(ln.planned_qty) : '',
    actual_qty: actualQtyForEdit(ln.actual_qty, status),
    status: ln.status,
  }))
}

export function bomPreviewToEditInputRows(
  inputs: ProductionOrderInput[],
  status: ProductionStatus,
  orderPlannedQty: string | number
): EditInputRow[] {
  return inputs.map((ln, index) => ({
    key: `preview-input-${ln.line_no}-${ln.item_id}-${index}`,
    line_no: ln.line_no,
    item_id: ln.item_id,
    item_cd: ln.item_cd,
    item_nm: ln.item_nm,
    from_location_id: ln.from_location_id ?? '',
    req_qty: String(ln.req_qty),
    consume_qty: consumeQtyForEdit(ln.consume_qty, ln.req_qty, status, orderPlannedQty),
    lot: ln.lot ?? '',
  }))
}

/** Data rows first, trailing blank row(s) always last (stable for grid display/sort). */
export function sortEditInputRowsForDisplay(
  rows: EditInputRow[],
  isBlank: (row: EditInputRow) => boolean = isBlankInputRow
): EditInputRow[] {
  const data = rows.filter((row) => !isBlank(row))
  const blanks = rows.filter(isBlank)
  return [...data, ...blanks]
}

export function bomPreviewToEditInputRowsWithTrailingBlanks(
  inputs: ProductionOrderInput[],
  processLineNos: number[],
  status: ProductionStatus,
  orderPlannedQty: string | number
): EditInputRow[] {
  const rows = bomPreviewToEditInputRows(inputs, status, orderPlannedQty)
  const lineNos =
    processLineNos.length > 0
      ? processLineNos
      : [...new Set(rows.map((row) => row.line_no))].sort((a, b) => a - b)
  const result: EditInputRow[] = []
  for (const lineNo of lineNos) {
    result.push(
      ...inputRowsWithSingleTrailingBlank(
        rows.filter((row) => row.line_no === lineNo),
        () => emptyEditInputRow(lineNo)
      )
    )
  }
  return result
}



export function createBlankProcessRowForDetail(existing: EditProcessRow[]): EditProcessRow {
  const maxLineNo = existing.reduce((max, row) => Math.max(max, row.line_no), 0)
  return emptyEditProcessRow(maxLineNo + 1)
}

/** Drop extra trailing blanks, then keep exactly one empty process row at the end. */
export function processRowsWithSingleTrailingBlank(
  rows: EditProcessRow[],
  createBlank: (existing: EditProcessRow[]) => EditProcessRow
): EditProcessRow[] {
  const data = rows.filter((row) => !isBlankProcessRow(row))
  return ensureTrailingBlankRow(data, isBlankProcessRow, createBlank)
}

export function createBlankInputRowForDetail(
  _existing: EditInputRow[],
  processLineNo: number
): EditInputRow {
  return emptyEditInputRow(processLineNo)
}

export function detailToEditProcessRows(detail: ProductionOrderDetail): EditProcessRow[] {

  return detail.lines.map((ln) => lineToEditProcessRow(ln, detail.status))

}



export function detailToEditInputRows(detail: ProductionOrderDetail): EditInputRow[] {

  return detail.inputs.map((ln) => inputToEditInputRow(ln, detail.status, detail.planned_qty))

}

function payloadSignature(value: unknown): string {
  return JSON.stringify(value)
}

/** True when process grid differs from the loaded order (for header Update). */
export function isProductionProcessDirty(
  detail: ProductionOrderDetail,
  processRows: EditProcessRow[],
  items: Item[],
  orderPlannedQty: string | number = detail.planned_qty
): boolean {
  const ctx = { parentItemId: detail.parent_item_id, orderPlannedQty }
  const savedRows = detailToEditProcessRows(detail)
  const current = buildProcessPayload(processRows, items, ctx)
  const saved = buildProcessPayload(savedRows, items, ctx)
  return payloadSignature(current) !== payloadSignature(saved)
}

/** True when input grid differs from the loaded order (for header Update). */
export function isProductionInputDirty(
  detail: ProductionOrderDetail,
  inputRows: EditInputRow[],
  processRows: EditProcessRow[],
  orderPlannedQty: string | number = detail.planned_qty
): boolean {
  const ctx = {
    status: detail.status,
    orderPlannedQty,
    processRows,
  }
  const savedProcessRows = detailToEditProcessRows(detail)
  const savedInputRows = detailToEditInputRows(detail)
  const current = buildInputPayload(inputRows, ctx)
  const saved = buildInputPayload(savedInputRows, {
    ...ctx,
    processRows: savedProcessRows,
  })
  return payloadSignature(current) !== payloadSignature(saved)
}

/** Item Process master inputs → production order input edit rows (per process line_no). */
export function itemProcInputsToEditInputRows(
  inputs: ItemProcInput[],
  lineNo: number,
  _status: ProductionStatus,
  _orderPlannedQty: string | number
): EditInputRow[] {
  return inputs
    .slice()
    .sort((a, b) => a.input_no - b.input_no)
    .filter((inp) => inp.item_id && inp.req_qty != null && Number(inp.req_qty) > 0)
    .map((inp) => ({
      key: newEditKey(),
      line_no: lineNo,
      item_id: inp.item_id,
      item_cd: inp.item_cd,
      item_nm: inp.item_nm,
      from_location_id: inp.from_location_id ?? '',
      req_qty: String(inp.req_qty),
      consume_qty: '',
      lot: '*',
    }))
}

/** Build production-order process rows from Item Process master (replaces order lines in the grid). */
export function itemProcessesToProductionEditRows(
  data: ItemProcessesOut,
  orderPlannedQty: string | number,
  status: ProductionStatus = 'registered'
): EditProcessRow[] {
  const sorted = [...data.processes].sort((a, b) => a.line_no - b.line_no)
  const byLineNo = new Map<number, (typeof sorted)[number]>()
  for (const proc of sorted) {
    byLineNo.set(proc.line_no, proc)
  }
  const uniqueSteps = [...byLineNo.values()].sort((a, b) => a.line_no - b.line_no)
  const rows: EditProcessRow[] = uniqueSteps.map((proc) => ({
    key: newEditKey(),
    line_no: proc.line_no,
    wip_location_id: proc.wip_location_id,
    wip_location_cd: proc.wip_location_cd ?? '',
    rm_location_id: '' as const,
    output_item_id: proc.output_item_id,
    output_item_cd: proc.output_item_cd ?? '',
    output_item_nm: proc.output_item_nm ?? '',
    planned_qty: String(orderPlannedQty),
    actual_qty: actualQtyForEdit(null, status),
    status: 'planned',
  }))
  return rows.map((row) => ({
    ...row,
    ...processWipLocationPatch(row.wip_location_id, row.key, rows),
  }))
}

/** Build production-order input rows from Item Process master (per process line_no). */
export function itemProcessesToProductionInputRows(
  data: ItemProcessesOut,
  status: ProductionStatus = 'registered',
  lot = '*'
): EditInputRow[] {
  const sorted = [...data.processes].sort((a, b) => a.line_no - b.line_no)
  const byLineNo = new Map<number, (typeof sorted)[number]>()
  for (const proc of sorted) {
    byLineNo.set(proc.line_no, proc)
  }
  const uniqueSteps = [...byLineNo.values()].sort((a, b) => a.line_no - b.line_no)
  const active: EditInputRow[] = []
  const seenByLineItem = new Set<string>()
  for (const proc of uniqueSteps) {
    const inputs = [...proc.inputs].sort((a, b) => a.input_no - b.input_no)
    for (const inp of inputs) {
      if (inp.req_qty == null || Number(inp.req_qty) <= 0) continue
      const dedupeKey = `${proc.line_no}:${inp.item_id}`
      if (seenByLineItem.has(dedupeKey)) continue
      seenByLineItem.add(dedupeKey)
      active.push({
        key: newEditKey(),
        line_no: proc.line_no,
        item_id: inp.item_id,
        item_cd: inp.item_cd,
        item_nm: inp.item_nm,
        from_location_id: inp.from_location_id ?? '',
        req_qty: String(inp.req_qty),
        consume_qty: consumeQtyForEdit(null, inp.req_qty, status),
        lot,
      })
    }
  }
  return groupInputRowsWithTrailingBlanks(active, uniqueSteps.map((p) => p.line_no))
}

function groupInputRowsWithTrailingBlanks(
  rows: EditInputRow[],
  processLineNos: number[]
): EditInputRow[] {
  const result: EditInputRow[] = []
  for (const lineNo of processLineNos) {
    result.push(
      ...inputRowsWithSingleTrailingBlank(
        rows.filter((row) => row.line_no === lineNo),
        () => emptyEditInputRow(lineNo),
        isBlankInputRow
      )
    )
  }
  if (processLineNos.length === 0) {
    result.push(emptyEditInputRow(1))
  }
  return result
}

/** Fill missing input rows from Item Process master when the order has none for a process step. */
export function ensureEditInputRowsFromItemProcess(
  inputRows: EditInputRow[],
  processLineNos: number[],
  itemProcesses: ItemProcessesOut | undefined,
  status: ProductionStatus,
  orderPlannedQty: string | number
): EditInputRow[] {
  if (!itemProcesses) return inputRows

  let changed = false
  let result = inputRows

  for (const lineNo of processLineNos) {
    const forLine = result.filter((row) => row.line_no === lineNo)
    if (forLine.some((row) => !isBlankInputRow(row))) continue

    const proc = itemProcesses.processes.find((p) => p.line_no === lineNo)
    if (!proc?.inputs?.length) continue

    const templateRows = itemProcInputsToEditInputRows(
      proc.inputs,
      lineNo,
      status,
      orderPlannedQty
    )
    if (templateRows.length === 0) continue

    changed = true
    result = result.filter((row) => row.line_no !== lineNo)
    result = [
      ...result,
      ...inputRowsWithSingleTrailingBlank(templateRows, () => emptyEditInputRow(lineNo)),
    ]
  }

  return changed ? result : inputRows
}



export function firstActiveProcessPlannedQty(
  rows: EditProcessRow[],
  fallback?: string | number
): number | null {
  const row = rows.find((r) => isActiveProcessRow(r, rows))
  if (!row) return null
  const fromRow = Number(row.planned_qty)
  if (row.planned_qty.trim() && Number.isFinite(fromRow) && fromRow > 0) return fromRow
  const planned = Number(fallback)
  return Number.isFinite(planned) && planned > 0 ? planned : null
}

export type ReorderProcessRowsResult = {
  processRows: EditProcessRow[]
  lineNoRemap: Map<number, number>
}

/** Keep input rows attached to process steps when line_no is renumbered (swap, delete, etc.). */
export function remapInputRowsAfterProcessReorder(
  inputRows: EditInputRow[],
  processRowsBefore: EditProcessRow[],
  processRowsAfter: EditProcessRow[],
  isProcessRowBlank: (row: EditProcessRow) => boolean
): EditInputRow[] {
  const keyByOldLineNo = new Map(
    processRowsBefore
      .filter((row) => !isProcessRowBlank(row))
      .map((row) => [row.line_no, row.key] as const)
  )
  const lineNoByKey = new Map(
    processRowsAfter
      .filter((row) => !isProcessRowBlank(row))
      .map((row) => [row.key, row.line_no] as const)
  )
  return inputRows.map((inp) => {
    const procKey = keyByOldLineNo.get(inp.line_no)
    if (!procKey) return inp
    const newLineNo = lineNoByKey.get(procKey)
    return newLineNo != null && newLineNo !== inp.line_no ? { ...inp, line_no: newLineNo } : inp
  })
}

/** Swap a process row up/down among filled rows; renumber line_no and refresh RM chain. */
export function reorderProcessRows(
  rows: EditProcessRow[],
  key: string,
  direction: 'up' | 'down',
  isBlank: (row: EditProcessRow) => boolean,
  createBlank: (existing: EditProcessRow[]) => EditProcessRow
): ReorderProcessRowsResult | null {
  const dataRows = rows.filter((row) => !isBlank(row)).sort((a, b) => a.line_no - b.line_no)
  const index = dataRows.findIndex((row) => row.key === key)
  if (index < 0) return null
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= dataRows.length) return null

  const swapped = [...dataRows]
  const moved = swapped[index]
  swapped[index] = swapped[targetIndex]
  swapped[targetIndex] = moved

  const lineNoRemap = new Map<number, number>()
  const renumbered = swapped.map((row, idx) => {
    const newLineNo = idx + 1
    lineNoRemap.set(row.line_no, newLineNo)
    return { ...row, line_no: newLineNo, rm_location_id: '' as const }
  })
  const withRm = renumbered.map((row) => ({
    ...row,
    ...processWipLocationPatch(row.wip_location_id, row.key, renumbered),
  }))

  return {
    processRows: ensureTrailingBlankRow(withRm, isBlank, createBlank),
    lineNoRemap,
  }
}


