export type DraftStatus = 'registered' | 'approved' | 'cancelled'
export type SourceType = 'manual' | 'excel' | 'pdf'

export interface DraftLine {
  inv_receipt_draft_line_id: number
  line_no: number
  item_id: number | null
  item_cd?: string | null
  item_nm: string | null
  itemtyp_id?: number | null
  location_id?: number
  location_cd?: string | null
  location_nm?: string | null
  lot: string
  qty: string | number
}

export interface DraftListItem {
  inv_receipt_draft_id: number
  status: DraftStatus
  source_type: SourceType
  receipt_at: string
  reference_no: string | null
  suppliers_id?: number | null
  supplier_nm: string | null
  notes: string | null
  line_count: number
  approved_at: string | null
  cancelled_at: string | null
  created_at: string
  has_attachment?: boolean
  parse_message?: string | null
}

export interface DraftDetail {
  inv_receipt_draft_id: number
  status: DraftStatus
  receipt_at: string
  suppliers_id: number | null
  supplier_nm: string | null
  reference_no: string | null
  notes: string | null
  approved_at: string | null
  cancelled_at: string | null
  created_at: string
  source_type: SourceType
  attachment_original_name: string | null
  has_attachment: boolean
  parse_message: string | null
  lines: DraftLine[]
}

export interface DraftLineInput {
  item_id?: number | null
  item_cd?: string | null
  item_nm?: string | null
  location_id?: number
  lot: string
  qty: number
  line_no: number
  inv_receipt_draft_line_id?: number
}

export interface DraftCreatePayload {
  receipt_at: string
  suppliers_id?: number | null
  reference_no?: string | null
  notes?: string | null
  lines: DraftLineInput[]
}

export interface Item {
  item_id: number
  item_cd: string
  item_nm: string
  itemtyp_id: number | null
}

export interface Supplier {
  suppliers_id: number
  suppliers_cd: string
  suppliers_nm: string
}
