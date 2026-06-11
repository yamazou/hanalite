import type { Item } from '../types'
import type { ItemProcessesOut } from '../types/itemprocs'
import type { ItemTyp, LocationMaster } from '../types/masters'
import type { ProductionOrderDetail, ProductionOrderInput } from '../types/production'
import { isWipCatalogItem } from './itemProcessTree'
import { buildProductionOrderTree } from './productionOrderTree'
import { applyColumnFilters, FILTER_BLANKS, toFilterCellValue } from './gridColumnFilter'
import {
  editInputText,
  isActiveInputRow,
  isBlankInputRow,
  sortEditInputRowsForDisplay,
  type EditInputRow,
  type EditProcessRow,
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

/** All input rows for visible production orders (Production List: Material-to-Lot Trace on). */
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
  liveEditsByOrderId?: Map<number, TraceabilityFilterLiveEdits>
  locations?: LocationMaster[]
}): AggregatedProductionInputRow[] {
  const locations = args.locations ?? []
  const rows: AggregatedProductionInputRow[] = []
  const sortedOrders = [...args.orders].sort(
    (a, b) => a.production_order_id - b.production_order_id
  )

  for (const order of sortedOrders) {
    const orderId = order.production_order_id
    const liveBundle = args.liveEditsByOrderId?.get(orderId)
    if (liveBundle) {
      const live = sortEditInputRowsForDisplay(
        liveBundle.inputRows.filter(isTraceabilityVisibleEditRow),
        isBlankInputRow
      )
      for (const inp of live) {
        rows.push(fromEditInput(orderId, inp, locations))
      }
      continue
    }
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

export type TraceabilityFilterLiveEdits = {
  processRows: EditProcessRow[]
  inputRows: EditInputRow[]
}

/** Item codes shown in the production tree (saved order + item-process WIP expansion). */
export function aggregateTreeInputsForFilterOptions(args: {
  orders: ProductionOrderDetail[]
  items: Item[]
  itemtyps: ItemTyp[]
  locations: LocationMaster[]
  itemProcessCache?: Map<number, ItemProcessesOut>
  /** Selected order edit grids — matches tree when Material-to-Lot Trace is on. */
  liveEditsByOrderId?: Map<number, TraceabilityFilterLiveEdits>
}): AggregatedProductionInputRow[] {
  const rows: AggregatedProductionInputRow[] = []
  for (const order of args.orders) {
    const live = args.liveEditsByOrderId?.get(order.production_order_id)
    const tree = buildProductionOrderTree({
      detail: order,
      processRows: live?.processRows ?? [],
      inputRows: live?.inputRows ?? [],
      locations: args.locations,
      items: args.items,
      itemtyps: args.itemtyps,
      itemProcessCache: args.itemProcessCache,
      useEditRows: live != null,
    })
    const seen = new Set<string>()
    for (const line of tree.lines) {
      if (line.kind !== 'input') continue
      const itemCd = editInputText(line.item_cd).trim()
      if (!itemCd || seen.has(itemCd)) continue
      seen.add(itemCd)
      rows.push({
        key: `tree-${order.production_order_id}-${itemCd}`,
        production_order_id: order.production_order_id,
        line_no: line.processLineNo ?? 0,
        prd_order_input_id: -1,
        item_id: line.item_id ?? 0,
        item_cd: itemCd,
        item_nm: line.item_nm,
        itemtyp_nm: '',
        from_location_cd: line.from_location_cd ?? null,
        req_qty: '',
        consume_qty: '',
        lot: null,
        level: 0,
      })
    }
  }
  return rows
}

/**
 * Unique Item Code values for Material-to-Lot Trace Input Item column filters.
 * Uses the full item-process cache (FG ASSY inputs, nested WIP masters) plus grid/tree lines.
 */
export function collectTraceabilityFilterItemCds(args: {
  gridRows: AggregatedProductionInputRow[]
  orders: ProductionOrderDetail[]
  itemProcessCache?: Map<number, ItemProcessesOut>
  items: Item[]
  itemtyps: ItemTyp[]
  locations: LocationMaster[]
  liveEditsByOrderId?: Map<number, TraceabilityFilterLiveEdits>
}): string[] {
  const codes = new Set<string>()
  const addCode = (raw: string) => {
    const cell = toFilterCellValue(editInputText(raw).trim() || null)
    if (cell !== FILTER_BLANKS) codes.add(cell)
  }

  for (const row of args.gridRows) {
    addCode(row.item_cd)
  }

  const cache = args.itemProcessCache
  if (cache?.size) {
    for (const data of cache.values()) {
      for (const proc of data.processes) {
        for (const inp of proc.inputs) {
          addCode(inp.item_cd)
        }
      }
    }
  }

  for (const order of args.orders) {
    const live = args.liveEditsByOrderId?.get(order.production_order_id)
    const tree = buildProductionOrderTree({
      detail: order,
      processRows: live?.processRows ?? [],
      inputRows: live?.inputRows ?? [],
      locations: args.locations,
      items: args.items,
      itemtyps: args.itemtyps,
      itemProcessCache: cache,
      useEditRows: live != null,
    })
    for (const line of tree.lines) {
      if (line.kind === 'input') addCode(line.item_cd)
    }
  }

  return [...codes].sort((a, b) => {
    if (a === FILTER_BLANKS) return 1
    if (b === FILTER_BLANKS) return -1
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  })
}

/** Saved + BOM (+ tree) rows for traceability grids and header narrowing. */
export function buildTraceabilityAggregatedRows(args: {
  orders: ProductionOrderDetail[]
  locations: LocationMaster[]
  items: Item[]
  itemtyps: ItemTyp[]
  itemProcessCache?: Map<number, ItemProcessesOut>
  traceabilityFilterReady?: boolean
  selectedOrderId?: number | null
  liveInputRows?: EditInputRow[]
  liveEditsByOrderId?: Map<number, TraceabilityFilterLiveEdits>
  includeTree?: boolean
}): AggregatedProductionInputRow[] {
  const gridRows = aggregateTraceabilityInputRows({
    orders: args.orders,
    selectedOrderId: args.selectedOrderId ?? null,
    liveInputRows: args.liveInputRows,
    liveEditsByOrderId: args.liveEditsByOrderId,
    locations: args.locations,
  })
  if (!args.traceabilityFilterReady || !args.itemProcessCache?.size) {
    return gridRows
  }
  return preferSavedAggregatedInputRows(
    rowsForTraceabilityFilterPicklist({
      gridRows,
      orders: args.orders,
      itemProcessCache: args.itemProcessCache,
      items: args.items,
      itemtyps: args.itemtyps,
      locations: args.locations,
      includeTree: args.includeTree !== false,
      liveEditsByOrderId: args.liveEditsByOrderId,
    })
  )
}

/** Rows used to build traceability column filter pick-lists (grid + BOM + optional tree). */
export function rowsForTraceabilityFilterPicklist(args: {
  gridRows: AggregatedProductionInputRow[]
  orders?: ProductionOrderDetail[]
  itemProcessCache?: Map<number, ItemProcessesOut>
  items?: Item[]
  itemtyps?: ItemTyp[]
  locations?: LocationMaster[]
  /** When false, skips per-order tree build (header grid narrowing). */
  includeTree?: boolean
  liveEditsByOrderId?: Map<number, TraceabilityFilterLiveEdits>
}): AggregatedProductionInputRow[] {
  const masterRows =
    args.orders && args.itemProcessCache && args.itemProcessCache.size > 0
      ? aggregateItemProcessInputsForFilterOptions(args.orders, args.itemProcessCache, {
          items: args.items,
          itemtyps: args.itemtyps,
        })
      : []
  const treeRows =
    args.includeTree !== false &&
    args.orders &&
    args.items &&
    args.itemtyps &&
    args.locations
      ? aggregateTreeInputsForFilterOptions({
          orders: args.orders,
          items: args.items,
          itemtyps: args.itemtyps,
          locations: args.locations,
          itemProcessCache: args.itemProcessCache,
          liveEditsByOrderId: args.liveEditsByOrderId,
        })
      : []
  return mergeAggregatedInputRowsForFilterOptions(args.gridRows, masterRows, treeRows)
}

/**
 * Item Process master inputs for visible orders — used only to widen column filter pick-lists
 * when saved order inputs are fewer than the master (tree can show more lines via WIP expansion).
 */
export function aggregateItemProcessInputsForFilterOptions(
  orders: ProductionOrderDetail[],
  itemProcessCache: Map<number, ItemProcessesOut> | undefined,
  options?: {
    items?: { item_id: number; itemtyp_id?: number }[]
    itemtyps?: ItemTyp[]
  }
): AggregatedProductionInputRow[] {
  if (!itemProcessCache?.size) return []
  const items = options?.items ?? []
  const itemtyps = options?.itemtyps ?? []
  const rows: AggregatedProductionInputRow[] = []
  const canExpandWip = items.length > 0 && itemtyps.length > 0

  const appendFromDefinition = (
    itemId: number,
    orderId: number,
    pathVisited: Set<number>
  ) => {
    if (pathVisited.has(itemId)) return
    const data = itemProcessCache.get(itemId)
    if (!data) return
    const nextPath = new Set(pathVisited)
    nextPath.add(itemId)
    for (const proc of data.processes) {
      for (const inp of proc.inputs) {
        if (!inp.item_id) continue
        rows.push({
          key: `ip-${orderId}-${proc.line_no}-${inp.item_id}-${inp.input_no}`,
          production_order_id: orderId,
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
        if (itemProcessCache.has(inp.item_id)) {
          appendFromDefinition(inp.item_id, orderId, nextPath)
        } else if (canExpandWip && isWipCatalogItem(items, itemtyps, inp.item_id)) {
          appendFromDefinition(inp.item_id, orderId, nextPath)
        }
      }
    }
  }

  for (const order of orders) {
    const path = new Set<number>()
    appendFromDefinition(order.parent_item_id, order.production_order_id, path)
    for (const inp of order.inputs) {
      if (!inp.item_id) continue
      appendFromDefinition(inp.item_id, order.production_order_id, new Set(path))
    }
  }
  return rows
}

/** When BOM and saved lines share the same order + item code, keep the saved input row. */
export function preferSavedAggregatedInputRows(
  rows: AggregatedProductionInputRow[]
): AggregatedProductionInputRow[] {
  const passthrough: AggregatedProductionInputRow[] = []
  const byOrderItem = new Map<string, AggregatedProductionInputRow>()
  for (const row of rows) {
    const cd = editInputText(row.item_cd).trim()
    if (!cd) {
      passthrough.push(row)
      continue
    }
    const slot = `${row.production_order_id}\0${cd}`
    const prev = byOrderItem.get(slot)
    if (!prev) {
      byOrderItem.set(slot, row)
      continue
    }
    if (prev.prd_order_input_id < 0 && row.prd_order_input_id >= 0) {
      byOrderItem.set(slot, row)
    }
  }
  return [...passthrough, ...byOrderItem.values()].sort(
    (a, b) =>
      a.production_order_id - b.production_order_id ||
      a.line_no - b.line_no ||
      String(a.item_cd).localeCompare(String(b.item_cd))
  )
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
