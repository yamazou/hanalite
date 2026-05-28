export type ProductionStatus = 'registered' | 'approved' | 'cancelled'

export type ProductionLineStatus = 'planned' | 'completed'



export interface ProductionOrderLine {

  prd_order_line_id: number

  line_no: number

  itemproc_id: number

  process_no: number

  process_nm: string

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

  item_id: number

  item_cd: string

  item_nm: string

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

  parent_item_id: number

  planned_qty: number

  lot: string

  notes?: string | null

}



export interface ProductionOrderInputWritePayload {

  prd_order_input_id?: number

  item_id: number

  req_qty: number

  consume_qty: number

  lot?: string | null

  line_no?: number

}



export interface ProductionOrderUpdatePayload {

  planned_qty?: number

  actual_qty?: number

  lot?: string

  notes?: string | null

  status?: ProductionStatus

  inputs?: ProductionOrderInputWritePayload[]

}

