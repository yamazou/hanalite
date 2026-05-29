export interface ItemTyp {
  itemtyp_id: number
  itemtyp_cd: string
  itemtyp_nm: string
  itemtyp_color?: string | null
  created_at?: string | null
}

export interface ItemTypPayload {
  itemtyp_cd: string
  itemtyp_nm: string
  itemtyp_color?: string | null
}

export interface MoveTypMaster {
  movetyps_id: number
  movetyps_cd: string
  movetyps_nm?: string | null
  created_at?: string | null
}

export interface MoveTypPayload {
  movetyps_cd: string
  movetyps_nm?: string | null
}

export interface ItemListRow {
  item_id: number
  item_cd: string
  item_nm: string
  itemtyp_id: number
  itemtyp_nm: string
  supplier1_id: number | null
  supplier1_nm: string | null
  supplier2_id: number | null
  supplier3_id: number | null
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
}

export interface ItemPayload {
  item_cd: string
  item_nm: string
  itemtyp_id: number
  supplier1_id?: number | null
  supplier2_id?: number | null
  supplier3_id?: number | null
}

export interface SupplierMaster {
  suppliers_id: number
  suppliers_nm: string
  created_at?: string | null
}

export interface LocationMaster {
  location_id: number
  location_cd: string
  location_nm: string
  location_type: 'RM' | 'Process' | 'NG' | 'FG'
  created_at?: string | null
}

