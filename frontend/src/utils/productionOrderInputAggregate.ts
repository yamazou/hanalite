import type { ItemProcessesOut } from '../types/itemprocs'
import type { LocationMaster } from '../types/masters'
import type { ProductionOrderDetail, ProductionOrderInput } from '../types/production'
import { applyColumnFilters, toFilterCellValue } from './gridColumnFilter'
import {
  editInputText,
  isActiveInputRow,
  isBlankInputRow,
  sortEditInputRowsForDisplay,
  type EditInputRow,
} from './productionEdit'

export type AggregatedProductionInputRow = {
  key: string
  production_order_id: number
  line_no: number
  prd_order_input_id: number
  item_id: number
  item_cd: string
  item_nm: string
  itemtyp_nm: string
  from_location_cd: string | null
  req_qty: string | number
  consume_qty: string | number
  lot: string | null
  level: number
}

function itemtypSortKey(name: string): number {
  const n = name.toLowerCase()
  if (n.includes('finished') || n === 'fg') return 0
  if (n.includes('wip')) return 1
  if (n.includes('purchase')) return 2
  if (n === 'rm' || n === 'material') return 3
  return 99
}

function fromDetailInput(
  orderId: number,
  inp: ProductionOrderInput
): AggregatedProductionInputRow {
  return {
    key: `order-${orderId}-input-${inp.prd_order_input_id}`,
    production_order_id: orderId,
    line_no: inp.line_no,
    prd_order_input_id: inp.prd_order_input_id,
    item_id: inp.item_id,
    item_cd: inp.item_cd,
    item_nm: inp.item_nm,
    itemtyp_nm: inp.itemtyp_nm,
    from_location_cd: inp.from_location_cd,
    req_qty: inp.req_qty,
    consume_qty: inp.consume_qty,
    lot: inp.lot,
    level: inp.level ?? 0,
  }
}

function fromEditInput(
  orderId: number,
  inp: EditInputRow,
  locations: LocationMaster[]
): AggregatedProductionInputRow {
  const fromLoc =
    inp.from_location_id !== ''
      ? locations.find((loc) => loc.location_id === inp.from_location_id)
      : undefined
  return {
    key: `order-${orderId}-edit-${inp.key}`,
    production_order_id: orderId,
    line_no: inp.line_no,
    prd_order_input_id: -1,
    item_id: inp.item_id === '' ? 0 : Number(inp.item_id),
    item_cd: inp.item_cd,
    item_nm: inp.item_nm,
    itemtyp_nm: '',
    from_location_cd: fromLoc?.location_cd ?? null,
    req_qty: inp.req_qty,
    consume_qty: inp.consume_qty,
    lot: inp.lot || null,
    level: 0,
  }
}

export function productionAggregatedInputFilterValue(
  row: AggregatedProductionInputRow,
  col: string
): string {
  switch (col) {
    case 'item_cd':
      return toFilterCellValue(row.item_cd)
    case 'item_nm':
      return toFilterCellValue(row.item_nm)
    case 'from_location':
      return toFilterCellValue(row.from_location_cd)
    case 'req_qty':
      return toFilterCellValue(row.req_qty)
    case 'consume_qty':
      return toFilterCellValue(row.consume_qty)
    case 'lot':
      return toFilterCellValue((row.lot ?? '').trim() || null)
    default:
      return toFilterCellValue('')
  }
}

/** Order IDs that have at least one input row matching all active Input Item column filters. */
export function orderIdsMatchingInputColumnFilters(
  rows: AggregatedProductionInputRow[],
  filters: Record<string, Set<string>>
): Set<number> | null {
  if (Object.keys(filters).length === 0) return null
  const matched = applyColumnFilters(rows, filters, productionAggregatedInputFilterValue)
  return new Set(matched.map((row) => row.production_order_id))
}

/** All input rows for visible production orders (Production List: Order Traceability on). */
export function aggregateProductionInputsFromOrders(args: {
  orders: ProductionOrderDetail[]
  selectedOrderId?: number | null
  liveInputRows?: EditInputRow[]
  locations?: LocationMaster[]
}): AggregatedProductionInputRow[] {
  const locations = args.locations ?? []
  const rows: AggregatedProductionInputRow[] = []
  const sortedOrders = [...args.orders].sort(
    (a, b) => a.production_order_id - b.production_order_id
  )

  for (const order of sortedOrders) {
    const orderId = order.production_order_id
    if (
      args.selectedOrderId != null &&
      orderId === args.selectedOrderId &&
      args.liveInputRows
    ) {
      const live = sortEditInputRowsForDisplay(
        args.liveInputRows.filter(isActiveInputRow),
        isBlankInputRow
      )
      for (const inp of live) {
        rows.push(fromEditInput(orderId, inp, locations))
      }
      continue
    }
    const inputs = [...order.inputs].sort(
      (a, b) =>
        a.line_no - b.line_no ||
        (a.level ?? 0) - (b.level ?? 0) ||
        itemtypSortKey(a.itemtyp_nm) - itemtypSortKey(b.itemtyp_nm) ||
        String(a.item_cd).localeCompare(String(b.item_cd))
    )
    for (const inp of inputs) {
      rows.push(fromDetailInput(orderId, inp))
    }
  }

  return rows
}

/** Edit rows that should appear in traceability grid / filter pick-lists (not only saved-active rows). */
function isTraceabilityVisibleEditRow(row: EditInputRow): boolean {
  if (isBlankInputRow(row)) return false
  return editInputText(row.item_cd).trim() !== '' || row.item_id !== ''
}

/**
 * Production List traceability: all saved inputs per order; selected order uses edit grid rows
 * (includes lines visible in the grid before save).
 */
export function aggregateTraceabilityInputRows(args: {
  orders: ProductionOrderDetail[]
  selectedOrderId?: number | null
  liveInputRows?: EditInputRow[]
  locations?: LocationMaster[]
}): AggregatedProductionInputRow[] {
  const locations = args.locations ?? []
  const rows: AggregatedProductionInputRow[] = []
  const sortedOrders = [...args.orders].sort(
    (a, b) => a.production_order_id - b.production_order_id
  )

  for (const order of sortedOrders) {
    const orderId = order.production_order_id
    if (
      args.selectedOrderId != null &&
      orderId === args.selectedOrderId &&
      args.liveInputRows != null
    ) {
      const live = sortEditInputRowsForDisplay(
        args.liveInputRows.filter(isTraceabilityVisibleEditRow),
        isBlankInputRow
      )
      for (const inp of live) {
        rows.push(fromEditInput(orderId, inp, locations))
      }
      continue
    }
    const inputs = [...order.inputs].sort(
      (a, b) =>
        a.line_no - b.line_no ||
        (a.level ?? 0) - (b.level ?? 0) ||
        itemtypSortKey(a.itemtyp_nm) - itemtypSortKey(b.itemtyp_nm) ||
        String(a.item_cd).localeCompare(String(b.item_cd))
    )
    for (const inp of inputs) {
      rows.push(fromDetailInput(orderId, inp))
    }
  }

  return rows
}

/** Rows used to build traceability column filter pick-lists (same data as the grid). */
export function rowsForTraceabilityFilterPicklist(args: {
  gridRows: AggregatedProductionInputRow[]
}): AggregatedProductionInputRow[] {
  return args.gridRows
}

/**
 * Item Process master inputs for visible orders — used only to widen column filter pick-lists
 * when saved order inputs are fewer than the master (tree can show more lines via WIP expansion).
 */
export function aggregateItemProcessInputsForFilterOptions(
  orders: ProductionOrderDetail[],
  itemProcessCache: Map<number, ItemProcessesOut> | undefined
): AggregatedProductionInputRow[] {
  if (!itemProcessCache?.size) return []
  const rows: AggregatedProductionInputRow[] = []
  for (const order of orders) {
    const data = itemProcessCache.get(order.parent_item_id)
    if (!data) continue
    for (const proc of data.processes) {
      for (const inp of proc.inputs) {
        if (inp.req_qty == null || Number(inp.req_qty) <= 0) continue
        rows.push({
          key: `ip-${order.production_order_id}-${proc.line_no}-${inp.item_id}-${inp.input_no}`,
          production_order_id: order.production_order_id,
          line_no: proc.line_no,
          prd_order_input_id: -1,
          item_id: inp.item_id,
          item_cd: inp.item_cd,
          item_nm: inp.item_nm,
          itemtyp_nm: '',
          from_location_cd: inp.from_location_cd ?? null,
          req_qty: inp.req_qty,
          consume_qty: '',
          lot: null,
          level: 0,
        })
      }
    }
  }
  return rows
}

/** Saved + item-process rows for filter pick-lists (deduped by row key). */
export function mergeAggregatedInputRowsForFilterOptions(
  ...sources: AggregatedProductionInputRow[][]
): AggregatedProductionInputRow[] {
  const byKey = new Map<string, AggregatedProductionInputRow>()
  for (const source of sources) {
    for (const row of source) {
      byKey.set(row.key, row)
    }
  }
  return [...byKey.values()].sort(
    (a, b) =>
      a.production_order_id - b.production_order_id ||
      a.line_no - b.line_no ||
      String(a.item_cd).localeCompare(String(b.item_cd))
  )
}
