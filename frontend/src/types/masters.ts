export interface LocationTyp {
  locationtyp_id: number
  locationtyp_cd: string
  locationtyp_nm: string
  created_at?: string | null
  updated_at?: string | null
}

export interface LocationTypPayload {
  locationtyp_cd: string
  locationtyp_nm: string
}

export interface ItemTyp {
  itemtyp_id: number
  itemtyp_cd: string
  itemtyp_nm: string
  itemtyp_color?: string | null
  locationtyp_id?: number | null
  created_at?: string | null
  updated_at?: string | null
}

export interface ItemTypPayload {
  itemtyp_cd: string
  itemtyp_nm: string
  itemtyp_color?: string | null
  locationtyp_id?: number | null
}

export interface MoveTypMaster {
  movetyps_id: number
  movetyps_cd: string
  movetyps_nm?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface MoveTypPayload {
  movetyps_cd: string
  movetyps_nm?: string | null
}

export interface ItemListRow {
  item_id: number
  item_cd: string
  item_nm: string
  itemtyp_id: number | null
  itemtyp_nm: string | null
  supplier1_id: number | null
  supplier1_nm: string | null
  supplier2_id: number | null
  supplier3_id: number | null
  customer1_id: number | null
  customer1_nm: string | null
  customer2_id: number | null
  customer2_nm: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface ItemSearchRow {
  item_id: number
  item_cd: string
  item_nm: string
  itemtyp_id: number | null
  itemtyp_nm: string | null
}

export interface ItemDetail {
  item_id: number
  item_cd: string
  item_nm: string
  itemtyp_id: number | null
  supplier1_id: number | null
  supplier2_id: number | null
  supplier3_id: number | null
  customer1_id: number | null
  customer2_id: number | null
}

export interface ItemPayload {
  item_cd: string
  item_nm: string
  itemtyp_id?: number | null
  supplier1_id?: number | null
  supplier2_id?: number | null
  supplier3_id?: number | null
  customer1_id?: number | null
  customer2_id?: number | null
}

export interface CustomerMaster {
  customers_id: number
  customers_cd: string
  customers_nm: string
  created_at?: string | null
  updated_at?: string | null
}

export interface SupplierMaster {
  suppliers_id: number
  suppliers_cd: string
  suppliers_nm: string
  created_at?: string | null
  updated_at?: string | null
}

export interface LocationMaster {
  location_id: number
  location_cd: string
  location_nm: string
  locationtyp_id: number | null
  locationtyp_cd?: string | null
  locationtyp_nm?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface LocationPayload {
  location_cd: string
  location_nm: string
  locationtyp_id: number | null
}

