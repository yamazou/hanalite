import type { ItemSearchRow } from './masters'

export interface BomRow {
  bom_id: number
  p_item_id: number
  p_item_cd: string
  p_item_nm: string
  c_item_id: number
  c_item_cd: string
  c_item_nm: string
  location_id: number
  location_cd: string
  location_nm: string
  c_req_qty: string | number
  created_at?: string | null
  updated_at?: string | null
}

export interface BomItemRefPayload {
  item_id?: number
  item_cd?: string
  item_nm?: string
}

export interface BomCreatePayload {
  parent: BomItemRefPayload
  child: BomItemRefPayload
  location_id: number
  c_req_qty: number
}

export interface BomUpdatePayload {
  parent?: BomItemRefPayload
  child?: BomItemRefPayload
  location_id?: number
  c_req_qty?: number
}

export function itemRefFromSearch(row: ItemSearchRow): BomItemRefPayload {
  return { item_id: row.item_id }
}

export type { ItemSearchRow }
