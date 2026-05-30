import type {

  ProductionOrderDetail,

  ProductionOrderInput,

  ProductionOrderInputWritePayload,

  ProductionOrderLine,

  ProductionOrderLineWritePayload,

  ProductionStatus,

} from '../types/production'

import type { Item } from '../types'
import { ensureTrailingBlankRow } from './gridTrailingBlankRow'

import { findItemByCd, findItemByNm } from './draftEdit'



export type EditProcessRow = {

  key: string

  prd_order_line_id?: number

  line_no: number

  wip_location_id: number | ''

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

export function isActiveProcessRow(
  row: EditProcessRow,
  allRows?: EditProcessRow[],
  items?: Item[]
): boolean {
  const rm =
    row.rm_location_id !== ''
      ? row.rm_location_id
      : allRows
        ? resolveRmLocationForProcessWip(row.wip_location_id, row.key, allRows)
        : ''
  const outputItemId = resolveProcessOutputItemId(row, items)
  return (
    row.wip_location_id !== '' &&
    rm !== '' &&
    outputItemId !== '' &&
    Boolean(row.planned_qty.trim()) &&
    Number(row.planned_qty) > 0
  )
}

export function isBlankInputRow(row: EditInputRow): boolean {
  return (
    row.item_id === '' &&
    !row.item_cd.trim() &&
    !row.item_nm.trim() &&
    !row.req_qty.trim() &&
    !row.consume_qty.trim() &&
    !row.lot.trim()
  )
}

/** Drop extra trailing blanks, then keep exactly one empty input row at the end. */
export function inputRowsWithSingleTrailingBlank(
  rows: EditInputRow[],
  createBlank: (existing: EditInputRow[]) => EditInputRow,
  isBlank: (row: EditInputRow) => boolean = isBlankInputRow
): EditInputRow[] {
  const data = rows.filter((row) => !isBlank(row))
  return ensureTrailingBlankRow(data, isBlank, createBlank)
}

export function isActiveInputRow(row: EditInputRow): boolean {

  return (

    row.item_id !== '' &&

    row.from_location_id !== '' &&

    Boolean(row.req_qty.trim()) &&

    Number(row.req_qty) > 0

  )

}



export function itemCdFieldPatch(

  items: Item[],

  value: string

): Pick<EditInputRow, 'item_id' | 'item_cd' | 'item_nm'> {

  const match = findItemByCd(items, value)

  if (match) {

    return { item_id: match.item_id, item_cd: match.item_cd, item_nm: match.item_nm }

  }

  return { item_id: '', item_cd: value }

}



export function itemNmFieldPatch(

  items: Item[],

  value: string

): Pick<EditInputRow, 'item_id' | 'item_cd' | 'item_nm'> {

  const match = findItemByNm(items, value)

  if (match) {

    return { item_id: match.item_id, item_cd: match.item_cd, item_nm: match.item_nm }

  }

  return { item_id: '', item_nm: value }

}



export function buildProcessPayload(
  rows: EditProcessRow[],
  items?: Item[]
): ProductionOrderLineWritePayload[] {
  return rows.filter((row) => isActiveProcessRow(row, rows, items)).map((row, index) => {
    const actualRaw = row.actual_qty.trim()
    const rmId =
      row.rm_location_id !== ''
        ? row.rm_location_id
        : resolveRmLocationForProcessWip(row.wip_location_id, row.key, rows)

    return {
      ...(row.prd_order_line_id != null && row.prd_order_line_id > 0
        ? { prd_order_line_id: row.prd_order_line_id }
        : {}),
      line_no: index + 1,
      rm_location_id: Number(rmId),
      wip_location_id: Number(row.wip_location_id),

      output_item_id: Number(resolveProcessOutputItemId(row, items)),

      planned_qty: Number(row.planned_qty),

      actual_qty: actualRaw ? Number(actualRaw) : null,

    }

  })

}



export function buildInputPayload(
  rows: EditInputRow[],
  context?: InputConsumeQtyContext
): ProductionOrderInputWritePayload[] {

  return rows.filter(isActiveInputRow).map((row) => ({

    ...(row.prd_order_input_id != null && row.prd_order_input_id > 0
      ? { prd_order_input_id: row.prd_order_input_id }
      : {}),

    line_no: row.line_no,

    item_id: Number(row.item_id),

    from_location_id: Number(row.from_location_id),

    req_qty: Number(row.req_qty),

    consume_qty: resolveInputConsumeQty(row, context),

    lot: row.lot.trim() || null,

  }))

}



export function bomPreviewToEditProcessRows(
  lines: ProductionOrderLine[],
  status: ProductionStatus
): EditProcessRow[] {
  return lines.map((ln) => ({
    key: `preview-line-${ln.line_no}`,
    line_no: ln.line_no,
    wip_location_id: ln.wip_location_id,
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
export function sortEditInputRowsForDisplay(rows: EditInputRow[]): EditInputRow[] {
  const data = rows.filter((row) => !isBlankInputRow(row))
  const blanks = rows.filter(isBlankInputRow)
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



export function firstActiveProcessPlannedQty(rows: EditProcessRow[]): number | null {

  const row = rows.find((r) => isActiveProcessRow(r, rows))

  if (!row) return null

  const qty = Number(row.planned_qty)

  return Number.isFinite(qty) && qty > 0 ? qty : null

}


