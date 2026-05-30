import type { LocationMaster } from '../types/masters'
import type { ProductionOrderDetail } from '../types/production'
import type { ProcessTreeHighlight } from './bomTree'
import type { EditProcessRow } from './productionEdit'
import { isBlankProcessRow } from './productionEdit'
import { processLinesFromDetail } from './productionProcessDisplay'

export function resolveProcessTreeHighlight(
  detail: ProductionOrderDetail,
  processKey: string,
  processRows: EditProcessRow[],
  locations: LocationMaster[],
  useEditRows: boolean
): ProcessTreeHighlight {
  if (useEditRows) {
    const row = processRows.find((r) => r.key === processKey)
    if (row && !isBlankProcessRow(row)) {
      const loc = locations.find((l) => l.location_id === row.wip_location_id)
      return {
        kind: 'process',
        processLineNo: row.line_no,
        wipLocationCd: loc?.location_cd,
      }
    }
  } else {
    const groups = processLinesFromDetail(detail)
    const group = groups.find((g) => g.key === processKey)
    const lineNo = group?.lineNos[0]
    const line = lineNo != null ? detail.lines.find((l) => l.line_no === lineNo) : undefined
    if (lineNo != null) {
      return {
        kind: 'process',
        processLineNo: lineNo,
        wipLocationCd: line?.wip_location_cd,
      }
    }
  }
  return { kind: 'parent', itemId: detail.parent_item_id }
}

export function parentTreeHighlight(itemId: number): ProcessTreeHighlight {
  return { kind: 'parent', itemId }
}
