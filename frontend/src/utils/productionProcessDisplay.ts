import type { ProductionOrderDetail } from '../types/production'

export type ProcessLineView = {
  key: string
  no: number
  processCd: string
  processNm: string
  status: 'planned' | 'completed'
  outputItemId: number
  outputItemCd: string
  outputItemNm: string
  plannedQty: string | number
  actualQty: string | number | null
  lineNos: number[]
}

/** One Process grid row per item process step (no merge by location code). */
export function processLinesFromDetail(detail: ProductionOrderDetail): ProcessLineView[] {
  return detail.lines.map((ln) => ({
    key: String(ln.prd_order_line_id),
    no: ln.line_no,
    processCd: ln.wip_location_cd,
    processNm: ln.process_nm,
    status: ln.status,
    outputItemId: ln.output_item_id ?? detail.parent_item_id,
    outputItemCd: ln.output_item_cd ?? detail.parent_item_cd,
    outputItemNm: ln.output_item_nm ?? detail.parent_item_nm,
    plannedQty: ln.planned_qty ?? detail.planned_qty,
    actualQty: ln.actual_qty,
    lineNos: [ln.line_no],
  }))
}
