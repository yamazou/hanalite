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
  return (
    row.item_cd.trim() !== '' &&
    row.item_nm.trim() !== '' &&
    row.itemtyp_id !== ''
  )
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

export function listRowsToEditItemRows(rows: ItemListRow[]): EditItemRow[] {
  return rows.map(listRowToEditItemRow)
}
