import type { ItemListRow, ItemPayload } from '../types/masters'

export type EditItemRow = {
  key: string
  item_id?: number
  item_cd: string
  item_nm: string
  itemtyp_id: number | ''
  supplier_ids: (number | '')[]
  customer_ids: (number | '')[]
}

let nextKey = 0

export function newItemEditKey(): string {
  nextKey += 1
  return `new-${nextKey}`
}

export function listRowToEditItemRow(row: ItemListRow): EditItemRow {
  return {
    key: `item-${row.item_id}`,
    item_id: row.item_id,
    item_cd: row.item_cd,
    item_nm: row.item_nm,
    itemtyp_id: row.itemtyp_id,
    supplier_ids: [
      row.supplier1_id ?? '',
      row.supplier2_id ?? '',
      row.supplier3_id ?? '',
    ],
    customer_ids: [row.customer1_id ?? '', row.customer2_id ?? ''],
  }
}

export function emptyEditItemRow(defaultItemtypId?: number | ''): EditItemRow {
  return {
    key: newItemEditKey(),
    item_cd: '',
    item_nm: '',
    itemtyp_id: defaultItemtypId ?? '',
    supplier_ids: ['', '', ''],
    customer_ids: ['', ''],
  }
}

/** Trailing input row: Code/Name/Suppliers only; tab may preset Type (e.g. RM). */
export function isBlankItemRow(row: EditItemRow): boolean {
  return (
    row.item_cd.trim() === '' &&
    row.item_nm.trim() === '' &&
    row.supplier_ids.every((id) => id === '') &&
    row.customer_ids.every((id) => id === '')
  )
}

export function isActiveItemRow(row: EditItemRow): boolean {
  return row.item_cd.trim() !== '' && row.itemtyp_id !== ''
}

export function buildItemPayload(row: EditItemRow): ItemPayload {
  const supplierIds = row.supplier_ids
  const customerIds = row.customer_ids
  return {
    item_cd: row.item_cd.trim(),
    item_nm: row.item_nm.trim(),
    itemtyp_id: Number(row.itemtyp_id),
    supplier1_id: supplierIds[0] !== '' ? Number(supplierIds[0]) : null,
    supplier2_id: supplierIds[1] !== '' ? Number(supplierIds[1]) : null,
    supplier3_id: supplierIds[2] !== '' ? Number(supplierIds[2]) : null,
    customer1_id: customerIds[0] !== '' ? Number(customerIds[0]) : null,
    customer2_id: customerIds[1] !== '' ? Number(customerIds[1]) : null,
  }
}

/** Normalized row state for change detection (matches buildItemPayload). */
export type ItemRowSnapshot = {
  item_cd: string
  item_nm: string
  itemtyp_id: number
  supplier1_id: number | null
  supplier2_id: number | null
  supplier3_id: number | null
  customer1_id: number | null
  customer2_id: number | null
}

export function itemRowSnapshot(row: EditItemRow): ItemRowSnapshot | null {
  if (!isActiveItemRow(row)) return null
  const payload = buildItemPayload(row)
  return {
    item_cd: payload.item_cd,
    item_nm: payload.item_nm,
    itemtyp_id: payload.itemtyp_id,
    supplier1_id: payload.supplier1_id,
    supplier2_id: payload.supplier2_id,
    supplier3_id: payload.supplier3_id,
    customer1_id: payload.customer1_id,
    customer2_id: payload.customer2_id,
  }
}

export function itemRowSnapshotsFromEditRows(rows: EditItemRow[]): Map<number, ItemRowSnapshot> {
  const map = new Map<number, ItemRowSnapshot>()
  for (const row of rows) {
    if (row.item_id == null) continue
    const snapshot = itemRowSnapshot(row)
    if (snapshot) map.set(row.item_id, snapshot)
  }
  return map
}

function itemRowSnapshotsEqual(a: ItemRowSnapshot, b: ItemRowSnapshot): boolean {
  return (
    a.item_cd === b.item_cd &&
    a.item_nm === b.item_nm &&
    a.itemtyp_id === b.itemtyp_id &&
    a.supplier1_id === b.supplier1_id &&
    a.supplier2_id === b.supplier2_id &&
    a.supplier3_id === b.supplier3_id &&
    a.customer1_id === b.customer1_id &&
    a.customer2_id === b.customer2_id
  )
}

export function isItemRowChanged(
  row: EditItemRow,
  savedSnapshot: ItemRowSnapshot | undefined
): boolean {
  if (!isActiveItemRow(row)) return false
  if (row.item_id == null) return true
  const current = itemRowSnapshot(row)
  if (!current) return false
  if (savedSnapshot == null) return true
  return !itemRowSnapshotsEqual(current, savedSnapshot)
}

/** Active rows that differ from the last loaded snapshot (includes new rows). */
export function changedActiveItemRows(
  rows: EditItemRow[],
  savedSnapshots: Map<number, ItemRowSnapshot>
): EditItemRow[] {
  return rows.filter((row) =>
    isItemRowChanged(
      row,
      row.item_id != null ? savedSnapshots.get(row.item_id) : undefined
    )
  )
}

export function listRowsToEditItemRows(rows: ItemListRow[]): EditItemRow[] {
  return rows.map(listRowToEditItemRow)
}
