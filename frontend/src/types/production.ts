export type ProductionStatus = 'registered' | 'approved' | 'started' | 'completed' | 'cancelled'

export type ProductionLineStatus = 'planned' | 'completed'

export type ProductionSourceType = 'manual' | 'excel'



export interface ProductionOrderLine {

  prd_order_line_id: number

  line_no: number

  process_no: number

  process_nm: string

  output_item_id: number | null

  output_item_cd: string | null

  output_item_nm: string | null

  planned_qty: string | number | null

  rm_location_id: number

  rm_location_cd: string

  wip_location_id: number

  wip_location_cd: string

  status: ProductionLineStatus

  actual_qty: string | number | null

  completed_at: string | null

}



export interface ProductionOrderInput {

  prd_order_input_id: number

  line_no: number

  level: number

  itemtyp_nm: string

  item_id: number

  item_cd: string

  item_nm: string

  from_location_id: number | null

  from_location_cd: string | null

  from_location_nm: string | null

  req_qty: string | number

  consume_qty: string | number

  lot: string | null

}



export interface ProductionOrderOutput {

  prd_order_output_id: number

  prd_order_line_id: number | null

  line_no: number

  item_id: number

  item_cd: string

  item_nm: string

  output_qty: string | number

  location_id: number

  location_cd: string

  location_nm: string

  lot: string

}



export interface ProductionOrderListItem {

  production_order_id: number

  status: ProductionStatus

  production_date: string

  reference_no: string | null

  source_type: ProductionSourceType

  parent_item_id: number

  parent_item_cd: string

  parent_item_nm: string

  planned_qty: string | number

  actual_qty: string | number | null

  lot: string

  line_count: number

  completed_line_count: number

  created_at: string | null

  approved_at: string | null

  cancelled_at: string | null

}



export interface ProductionOrderDetail extends ProductionOrderListItem {

  notes: string | null

  updated_at: string | null

  lines: ProductionOrderLine[]

  inputs: ProductionOrderInput[]

  outputs: ProductionOrderOutput[]

}



export interface ProductionOrderCreatePayload {

  production_date: string

  reference_no?: string | null

  parent_item_id: number

  planned_qty: number

  lot: string

  notes?: string | null

}



export interface ProductionOrderLineWritePayload {
  prd_order_line_id?: number
  line_no?: number
  rm_location_id: number
  wip_location_id: number
  output_item_id: number
  planned_qty: number
  actual_qty?: number | null
}

export interface ProductionOrderInputWritePayload {
  prd_order_input_id?: number
  item_id: number
  from_location_id: number
  req_qty: number
  consume_qty: number
  lot?: string | null
  line_no?: number
}



export interface ProductionOrderUpdatePayload {

  production_date?: string

  reference_no?: string | null

  planned_qty?: number

  actual_qty?: number

  lot?: string

  notes?: string | null

  status?: ProductionStatus

  lines?: ProductionOrderLineWritePayload[]

  inputs?: ProductionOrderInputWritePayload[]

}

