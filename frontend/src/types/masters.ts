export interface ItemTyp {
  itemtyp_id: number
  itemtyp_nm: string
  created_at?: string | null
}

export interface MoveTypMaster {
  movetyps_id: number
  movetyps_nm: string
  created_at?: string | null
}

export interface ItemListRow {
  item_id: number
  item_cd: string
  item_nm: string
  itemtyp_id: number
  itemtyp_nm: string
  supplier1_id: number | null
  supplier1_nm: string | null
}

export interface ItemSearchRow {
  item_id: number
  item_cd: string
  item_nm: string
  itemtyp_id: number
  itemtyp_nm: string
}

export interface ItemDetail {
  item_id: number
  item_cd: string
  item_nm: string
  itemtyp_id: number
  supplier1_id: number | null
  supplier2_id: number | null
  supplier3_id: number | null
  supplier4_id: number | null
  supplier5_id: number | null
}

export interface ItemPayload {
  item_cd: string
  item_nm: string
  itemtyp_id: number
  supplier1_id?: number | null
  supplier2_id?: number | null
  supplier3_id?: number | null
  supplier4_id?: number | null
  supplier5_id?: number | null
}

export interface SupplierMaster {
  suppliers_id: number
  suppliers_nm: string
  created_at?: string | null
}
