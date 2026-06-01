import type { Item } from '../types'
import type { ItemTyp } from '../types/masters'
import type {
  ProductionOrderCreatePayload,
  ProductionOrderListItem,
  ProductionOrderUpdatePayload,
} from '../types/production'
import { findItemByCd, findItemByNm } from './draftEdit'
import { parseDateInputValue, toDateInputValue } from './format'
import { snapshotsEqual } from './gridRowChange'
import {
  allowedItemtypIds,
  filterItemListRowsByItemtypIds,
  PRODUCTION_ORDER_PARENT_ITEMTYP_CDS,
} from './itemTypDisplay'

export type EditProductionOrderHeaderRow = {
  key: string
  production_order_id?: number
  production_date: string
  reference_no: string
  parent_item_id: number | ''
  parent_item_cd: string
  parent_item_nm: string
  planned_qty: string
  lot: string
}

let nextKey = 0

export function newProductionOrderHeaderEditKey(): string {
  nextKey += 1
  return `new-order-${nextKey}`
}

export function emptyEditProductionOrderHeaderRow(): EditProductionOrderHeaderRow {
  return {
    key: newProductionOrderHeaderEditKey(),
    production_date: toDateInputValue(),
    reference_no: '',
    parent_item_id: '',
    parent_item_cd: '',
    parent_item_nm: '',
    planned_qty: '',
    lot: '',
  }
}

export function isBlankProductionOrderHeaderRow(row: EditProductionOrderHeaderRow): boolean {
  return (
    row.reference_no.trim() === '' &&
    row.parent_item_id === '' &&
    !row.parent_item_cd.trim() &&
    !row.parent_item_nm.trim() &&
    !row.planned_qty.trim() &&
    !row.lot.trim()
  )
}

export function isActiveProductionOrderHeaderRow(row: EditProductionOrderHeaderRow): boolean {
  const qty = Number(row.planned_qty)
  return (
    row.production_date.trim() !== '' &&
    row.parent_item_id !== '' &&
    Boolean(row.planned_qty.trim()) &&
    !Number.isNaN(qty) &&
    qty > 0
  )
}

export function listOrderToEditHeaderRow(row: ProductionOrderListItem): EditProductionOrderHeaderRow {
  return {
    key: `order-${row.production_order_id}`,
    production_order_id: row.production_order_id,
    production_date: parseDateInputValue(row.production_date),
    reference_no: row.reference_no ?? '',
    parent_item_id: row.parent_item_id,
    parent_item_cd: row.parent_item_cd,
    parent_item_nm: row.parent_item_nm,
    planned_qty: String(row.planned_qty ?? ''),
    lot: row.lot ?? '',
  }
}

export type ProductionOrderHeaderRowSnapshot = {
  production_date: string
  reference_no: string
  parent_item_id: number
  planned_qty: number
  lot: string
}

export function headerRowSnapshot(
  row: EditProductionOrderHeaderRow
): ProductionOrderHeaderRowSnapshot | null {
  if (!isActiveProductionOrderHeaderRow(row)) return null
  return {
    production_date: row.production_date,
    reference_no: row.reference_no.trim() || '*',
    parent_item_id: Number(row.parent_item_id),
    planned_qty: Number(row.planned_qty),
    lot: row.lot.trim() || '*',
  }
}

export function headerRowSnapshotsFromOrders(
  orders: ProductionOrderListItem[]
): Map<number, ProductionOrderHeaderRowSnapshot> {
  const map = new Map<number, ProductionOrderHeaderRowSnapshot>()
  for (const order of orders) {
    if (order.status !== 'registered') continue
    const snapshot = headerRowSnapshot(listOrderToEditHeaderRow(order))
    if (snapshot) map.set(order.production_order_id, snapshot)
  }
  return map
}

export function changedRegisteredHeaderOrderIds(
  edits: Map<number, EditProductionOrderHeaderRow>,
  savedSnapshots: Map<number, ProductionOrderHeaderRowSnapshot>
): number[] {
  const ids: number[] = []
  for (const [id, row] of edits) {
    const current = headerRowSnapshot(row)
    const saved = savedSnapshots.get(id)
    if (!current || !saved) continue
    if (!snapshotsEqual(current, saved)) ids.push(id)
  }
  return ids
}

export function buildCreateProductionOrderPayload(
  row: EditProductionOrderHeaderRow
): ProductionOrderCreatePayload {
  return {
    production_date: row.production_date,
    reference_no: row.reference_no.trim() || '*',
    parent_item_id: Number(row.parent_item_id),
    planned_qty: Number(row.planned_qty),
    lot: row.lot.trim() || '*',
  }
}

export function buildUpdateProductionOrderHeaderPayload(
  row: EditProductionOrderHeaderRow
): ProductionOrderUpdatePayload {
  return {
    production_date: row.production_date,
    reference_no: row.reference_no.trim() || '*',
    parent_item_id: Number(row.parent_item_id),
    planned_qty: Number(row.planned_qty),
    lot: row.lot.trim() || '*',
  }
}

export function filterProductionOrderParentItems<T extends { itemtyp_id: number }>(
  items: T[],
  itemtyps: ItemTyp[]
): T[] {
  const allowedIds = allowedItemtypIds(itemtyps, PRODUCTION_ORDER_PARENT_ITEMTYP_CDS)
  return filterItemListRowsByItemtypIds(items, allowedIds)
}

export function processParentItemCdFieldPatch(
  items: Pick<Item, 'item_id' | 'item_cd' | 'item_nm'>[],
  value: string
): Pick<EditProductionOrderHeaderRow, 'parent_item_id' | 'parent_item_cd' | 'parent_item_nm'> {
  const match = findItemByCd(items as Item[], value)
  if (match) {
    return {
      parent_item_id: match.item_id,
      parent_item_cd: match.item_cd,
      parent_item_nm: match.item_nm,
    }
  }
  return { parent_item_id: '', parent_item_cd: value, parent_item_nm: '' }
}

export function processParentItemNmFieldPatch(
  items: Pick<Item, 'item_id' | 'item_cd' | 'item_nm'>[],
  value: string
): Pick<EditProductionOrderHeaderRow, 'parent_item_id' | 'parent_item_cd' | 'parent_item_nm'> {
  const match = findItemByNm(items as Item[], value)
  if (match) {
    return {
      parent_item_id: match.item_id,
      parent_item_cd: match.item_cd,
      parent_item_nm: match.item_nm,
    }
  }
  return { parent_item_id: '', parent_item_cd: '', parent_item_nm: value }
}

export function productionOrderHeaderRowSaveError(
  rows: EditProductionOrderHeaderRow[]
): string | null {
  return productionOrderHeaderMissingFieldsMessage(rows, 'row')
}

const HEADER_FIELD_LABELS = {
  production_date: 'Production Date',
  item: 'Item',
  planned_qty: 'Plan Qty',
} as const

type HeaderMissingField = keyof typeof HEADER_FIELD_LABELS

const HEADER_FIELD_ORDER: HeaderMissingField[] = ['production_date', 'item', 'planned_qty']

export type ProductionOrderHeaderSaveScope = 'row' | 'changed_order'

export function missingProductionOrderHeaderFields(
  row: EditProductionOrderHeaderRow
): HeaderMissingField[] {
  const missing: HeaderMissingField[] = []
  if (row.production_date.trim() === '') missing.push('production_date')
  if (row.parent_item_id === '') missing.push('item')
  const qty = Number(row.planned_qty)
  if (!row.planned_qty.trim() || Number.isNaN(qty) || qty <= 0) missing.push('planned_qty')
  return missing
}

function formatHeaderFieldList(labels: string[]): string {
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]!
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

export function productionOrderHeaderMissingFieldsMessage(
  rows: EditProductionOrderHeaderRow[],
  scope: ProductionOrderHeaderSaveScope
): string | null {
  const incomplete = rows.filter(
    (row) => !isBlankProductionOrderHeaderRow(row) && !isActiveProductionOrderHeaderRow(row)
  )
  if (incomplete.length === 0) return null

  const fieldSet = new Set<HeaderMissingField>()
  for (const row of incomplete) {
    for (const field of missingProductionOrderHeaderFields(row)) {
      fieldSet.add(field)
    }
  }

  const labels = HEADER_FIELD_ORDER.filter((key) => fieldSet.has(key)).map(
    (key) => HEADER_FIELD_LABELS[key]
  )
  const scopePhrase = scope === 'row' ? 'each row' : 'each changed order'
  return `Enter ${formatHeaderFieldList(labels)} for ${scopePhrase}.`
}
