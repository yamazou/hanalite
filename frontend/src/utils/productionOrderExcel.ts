import type { LocationMaster } from '../types/masters'
import type {
  ProductionOrderDetail,
  ProductionOrderInput,
  ProductionOrderLine,
  ProductionOrderListItem,
  ProductionSourceType,
} from '../types/production'
import { downloadExcelSheet, exportFilename } from './exportExcel'
import {
  formatDate,
  formatDateTime,
  formatQty,
  productionStatusLabel,
} from './format'
import type { EditProductionOrderHeaderRow } from './productionOrderListEdit'
import {
  isActiveInputRow,
  isBlankInputRow,
  isBlankProcessRow,
  processLocationCdDisplay,
  sortEditInputRowsForDisplay,
  type EditInputRow,
  type EditProcessRow,
} from './productionEdit'

export const PRODUCTION_ORDER_EXCEL_SHEET = 'Production Order List'

export const PRODUCTION_ORDER_EXCEL_HEADERS = [
  'Order',
  'Production Date',
  'Reference No.',
  'Source',
  'Status',
  'Item Code',
  'Item Name',
  'Lot',
  'Plan Qty',
  'Actual Qty',
  'Steps',
  'Created',
  'Ordered at',
  'Line No',
  'Location Code',
  'Location Name',
  'Output Item Code',
  'Output Item Name',
  'Process Plan Qty',
  'Process Actual Qty',
  'Process Status',
  'Input Item Code',
  'Input Item Name',
  'From Location',
  'Plan Input Qty',
  'Actual Input Qty',
  'Input Lot',
] as const

const SOURCE_LABEL: Record<ProductionSourceType, string> = {
  manual: 'Manual',
  excel: 'Excel',
}

const EMPTY_PROCESS: (string | number)[] = ['', '', '', '', '', '', '', '']
const EMPTY_INPUT: (string | number)[] = ['', '', '', '', '', '']

export type ProductionOrderExportLiveEdits = {
  processRows: EditProcessRow[]
  inputRows: EditInputRow[]
}

function cellQty(value: string | number | null | undefined): string | number {
  if (value === '' || value == null) return ''
  return formatQty(value)
}

function headerCells(
  order: ProductionOrderListItem,
  headerEdit?: EditProductionOrderHeaderRow
): (string | number)[] {
  const productionDate = headerEdit?.production_date ?? order.production_date
  const referenceNo = headerEdit
    ? headerEdit.reference_no.trim() || '*'
    : order.reference_no?.trim() || '*'
  const itemCd = headerEdit?.parent_item_cd ?? order.parent_item_cd
  const itemNm = headerEdit?.parent_item_nm ?? order.parent_item_nm
  const lot = headerEdit ? headerEdit.lot.trim() || '*' : order.lot
  const plannedQty = headerEdit?.planned_qty ?? order.planned_qty

  return [
    order.production_order_id,
    formatDate(productionDate),
    referenceNo,
    SOURCE_LABEL[order.source_type] ?? order.source_type,
    productionStatusLabel[order.status] ?? order.status,
    itemCd,
    itemNm,
    lot,
    cellQty(plannedQty),
    cellQty(order.actual_qty),
    `${order.completed_line_count}/${order.line_count}`,
    formatDateTime(order.created_at),
    formatDateTime(order.approved_at),
  ]
}

function processCellsFromLine(
  line: ProductionOrderLine,
  detail: ProductionOrderDetail
): (string | number)[] {
  return [
    line.line_no,
    line.wip_location_cd,
    line.process_nm,
    line.output_item_cd ?? detail.parent_item_cd,
    line.output_item_nm ?? detail.parent_item_nm,
    cellQty(line.planned_qty ?? detail.planned_qty),
    cellQty(line.actual_qty),
    line.status,
  ]
}

function inputCellsFromDetail(inp: ProductionOrderInput): (string | number)[] {
  return [
    inp.item_cd,
    inp.item_nm,
    inp.from_location_cd ?? '',
    cellQty(inp.req_qty),
    cellQty(inp.consume_qty),
    (inp.lot ?? '').trim() || '',
  ]
}

function processCellsFromEdit(
  proc: EditProcessRow,
  locations: LocationMaster[],
  processLocations: LocationMaster[]
): (string | number)[] {
  const loc = locations.find((l) => l.location_id === proc.wip_location_id)
  return [
    proc.line_no,
    processLocationCdDisplay(proc, processLocations),
    loc?.location_nm ?? '',
    proc.output_item_cd,
    proc.output_item_nm,
    cellQty(proc.planned_qty),
    cellQty(proc.actual_qty),
    proc.status,
  ]
}

function inputCellsFromEdit(inp: EditInputRow, locations: LocationMaster[]): (string | number)[] {
  const loc = locations.find((l) => l.location_id === inp.from_location_id)
  return [
    inp.item_cd,
    inp.item_nm,
    loc?.location_cd ?? '',
    cellQty(inp.req_qty),
    cellQty(inp.consume_qty),
    inp.lot.trim(),
  ]
}

function appendDetailRows(
  rows: (string | number)[][],
  header: (string | number)[],
  detail: ProductionOrderDetail
): void {
  const lines = [...detail.lines].sort((a, b) => a.line_no - b.line_no)
  if (lines.length === 0) {
    rows.push([...header, ...EMPTY_PROCESS, ...EMPTY_INPUT])
    return
  }
  for (const line of lines) {
    const proc = processCellsFromLine(line, detail)
    const inputs = detail.inputs
      .filter((inp) => inp.line_no === line.line_no)
      .sort(
        (a, b) =>
          (a.level ?? 0) - (b.level ?? 0) ||
          String(a.item_cd).localeCompare(String(b.item_cd))
      )
    if (inputs.length === 0) {
      rows.push([...header, ...proc, ...EMPTY_INPUT])
      continue
    }
    for (const inp of inputs) {
      rows.push([...header, ...proc, ...inputCellsFromDetail(inp)])
    }
  }
}

function appendEditRows(
  rows: (string | number)[][],
  header: (string | number)[],
  live: ProductionOrderExportLiveEdits,
  locations: LocationMaster[],
  processLocations: LocationMaster[]
): void {
  const processes = live.processRows
    .filter((row) => !isBlankProcessRow(row))
    .sort((a, b) => a.line_no - b.line_no)
  if (processes.length === 0) {
    rows.push([...header, ...EMPTY_PROCESS, ...EMPTY_INPUT])
    return
  }
  for (const proc of processes) {
    const procCells = processCellsFromEdit(proc, locations, processLocations)
    const inputs = sortEditInputRowsForDisplay(
      live.inputRows.filter((row) => row.line_no === proc.line_no && isActiveInputRow(row)),
      isBlankInputRow
    )
    if (inputs.length === 0) {
      rows.push([...header, ...procCells, ...EMPTY_INPUT])
      continue
    }
    for (const inp of inputs) {
      rows.push([...header, ...procCells, ...inputCellsFromEdit(inp, locations)])
    }
  }
}

export function buildProductionOrderExportBodyRows(args: {
  orders: ProductionOrderListItem[]
  headerEdits: Map<number, EditProductionOrderHeaderRow>
  detailByOrderId: Map<number, ProductionOrderDetail>
  liveEditsByOrderId: Map<number, ProductionOrderExportLiveEdits>
  locations: LocationMaster[]
}): (string | number)[][] {
  const processLocations = args.locations.filter((loc) => loc.location_type === 'Process')
  const rows: (string | number)[][] = []

  for (const order of args.orders) {
    const orderId = order.production_order_id
    const header = headerCells(
      order,
      order.status === 'registered' ? args.headerEdits.get(orderId) : undefined
    )
    const live = args.liveEditsByOrderId.get(orderId)
    const detail = args.detailByOrderId.get(orderId)

    if (live) {
      appendEditRows(rows, header, live, args.locations, processLocations)
      continue
    }
    if (detail) {
      appendDetailRows(rows, header, detail)
      continue
    }
    rows.push([...header, ...EMPTY_PROCESS, ...EMPTY_INPUT])
  }

  return rows
}

export function downloadProductionOrderExcel(body: (string | number)[][]): void {
  downloadExcelSheet(
    PRODUCTION_ORDER_EXCEL_SHEET,
    [...PRODUCTION_ORDER_EXCEL_HEADERS],
    body,
    exportFilename('production_orders')
  )
}
