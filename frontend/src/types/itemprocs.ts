export interface ItemProcInput {
  itemproc_input_id: number
  input_no: number
  item_id: number
  item_cd: string
  item_nm: string
  from_location_id: number
  from_location_cd: string
  from_location_nm: string
  req_qty: string | number
}

export interface ItemProc {
  itemproc_id: number
  line_no: number
  wip_location_id: number
  wip_location_cd: string
  wip_location_nm: string
  rm_location_id: number
  rm_location_cd: string
  rm_location_nm: string
  output_item_id: number
  output_item_cd: string
  output_item_nm: string
  inputs: ItemProcInput[]
  created_at?: string | null
  updated_at?: string | null
}

export interface ItemProcessesOut {
  item_id: number
  item_cd: string
  item_nm: string
  processes: ItemProc[]
}

export interface ItemProcInputWrite {
  input_no: number
  item_id: number
  from_location_id: number
  req_qty: number
}

export interface ItemProcWrite {
  line_no: number
  wip_location_id: number
  rm_location_id: number
  output_item_id: number
  inputs: ItemProcInputWrite[]
}

export interface ItemProcessesSave {
  processes: ItemProcWrite[]
}

export interface ItemProcessFinalItem {
  item_id: number
  item_cd: string
  item_nm: string
  itemtyp_cd: string
  customer_cd: string
}
