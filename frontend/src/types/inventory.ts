export interface CurrentStock {
  inv_current_id: number
  item_id: number
  location_id: number
  location_cd: string
  location_nm: string
  item_cd: string
  item_nm: string
  itemtyp_id: number
  itemtyp_nm: string
  lot: string
  gr_date: string | null
  qty: string | number
  updated_at: string
}

export interface GrgiHistory {
  inv_grgi_id: number
  item_id: number
  location_id: number
  location_cd: string
  location_nm: string
  item_nm: string
  lot: string
  move_qty: string | number
  qty: string | number
  movetyps_cd: string
  movetyps_nm?: string | null
  actual_at: string
  created_at?: string | null
}

export interface MoveTyp {
  movetyps_id: number
  movetyps_cd: string
  movetyps_nm?: string | null
}

export interface GrgiCreatePayload {
  item_id: number
  location_id: number
  lot: string
  move_qty: number
  movetyps_id: number
  actual_at: string
}

export interface LotTraceResult {
  lot: string
  current: {
    item_id: number
    location_id: number
    location_cd: string
    location_nm: string
    item_nm: string
    itemtyp_id: number
    itemtyp_nm: string
    lot: string
    qty: string | number
    updated_at: string
  }[]
  history: {
    inv_grgi_id: number
    item_id: number
    location_id: number
    location_cd: string
    location_nm: string
    item_nm: string
    movetyps_cd: string
    movetyps_nm?: string | null
    move_qty: string | number
    qty: string | number
    actual_at: string
    created_at: string | null
  }[]
  balances: {
    period_year_month: string
    item_id: number
    location_id: number
    location_cd: string
    location_nm: string
    item_nm: string
    lot: string
    beg_at: string
    beg_qty: string | number
    qty: string | number
  }[]
}

export interface BalanceItem {
  inv_balance_id: number
  period_year_month: string
  item_id: number
  location_id: number
  location_cd: string
  location_nm: string
  item_nm: string
  lot: string
  beg_at: string
  beg_qty: string | number
  qty: string | number
}

export interface LocationMovePayload {
  item_id: number
  from_location_id: number
  to_location_id: number
  lot: string
  qty: number
  actual_at: string
}
