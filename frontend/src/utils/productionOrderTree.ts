import type { Item } from '../types'
import type { LocationMaster } from '../types/masters'
import type { ProductionOrderDetail } from '../types/production'
import type { BomTreeLine, ProcessTreeHighlight } from './bomTree'
import { formatQty } from './format'
import {
  isBlankInputRow,
  isBlankProcessRow,
  sortEditInputRowsForDisplay,
  type EditInputRow,
  type EditProcessRow,
} from './productionEdit'
import { processLinesFromDetail } from './productionProcessDisplay'

export type ProductionTreeData = {
  title: string
  lines: BomTreeLine[]
}

function itemtypIdFor(items: Item[], itemId: number | '' | null | undefined): number | undefined {
  if (itemId === '' || itemId == null) return undefined
  return items.find((item) => item.item_id === Number(itemId))?.itemtyp_id
}

export function buildProcessTreeLine(
  proc: {
    line_no: number
    wip_location_cd: string
    output_item_id: number | ''
    output_item_cd: string
    output_item_nm: string
    planned_qty: string | number | null
  },
  parent: { item_id: number; item_cd: string },
  indent = 1,
  showPlanQty = true
): BomTreeLine | null {
  if (!proc.wip_location_cd) return null

  const outputCd = (proc.output_item_cd ?? '').trim()
  const outputId = proc.output_item_id !== '' ? Number(proc.output_item_id) : undefined
  const matchesParent =
    (outputId != null && outputId === parent.item_id) ||
    (outputCd !== '' && outputCd.toLowerCase() === parent.item_cd.toLowerCase())

  const suffixParts: string[] = []
  if (!matchesParent && outputCd) suffixParts.push(outputCd)
  if (showPlanQty) {
    const planText = formatQty(proc.planned_qty ?? '')
    if (planText) suffixParts.push(`Plan ${planText}`)
  }

  return {
    indent,
    kind: 'process',
    item_cd: proc.wip_location_cd,
    item_nm: '',
    to_location_cd: proc.wip_location_cd,
    processLineNo: proc.line_no,
    suffix: suffixParts.length > 0 ? `(${suffixParts.join(', ')})` : undefined,
  }
}

function inputTreeIndent(level: number | null | undefined): number {
  const lv = level ?? 1
  return lv <= 0 ? 2 : 1 + lv
}

export function buildInputTreeLine(
  inp: {
    line_no: number
    item_id: number | ''
    item_cd: string
    item_nm: string
    req_qty: string | number
    from_location_cd: string
    level?: number | null
  },
  wipLocationCd: string,
  items: Item[],
  indent?: number
): BomTreeLine {
  const itemId = inp.item_id !== '' ? Number(inp.item_id) : undefined
  const fromCd = inp.from_location_cd || '-'
  const suffix = wipLocationCd
    ? `(${wipLocationCd} ← ${fromCd}, In ${formatQty(inp.req_qty)})`
    : `In ${formatQty(inp.req_qty)}`
  return {
    indent: indent ?? inputTreeIndent(inp.level),
    kind: 'input',
    item_cd: inp.item_cd.trim() || '-',
    item_nm: inp.item_nm.trim() || '',
    item_id: itemId,
    itemtyp_id: itemtypIdFor(items, itemId ?? ''),
    to_location_cd: wipLocationCd || undefined,
    from_location_cd: fromCd !== '-' ? fromCd : undefined,
    processLineNo: inp.line_no,
    suffix,
  }
}

export function buildProductionOrderTree(params: {
  detail: ProductionOrderDetail
  processRows: EditProcessRow[]
  inputRows: EditInputRow[]
  locations: LocationMaster[]
  items: Item[]
  useEditRows: boolean
}): ProductionTreeData {
  const { detail, processRows, inputRows, locations, items, useEditRows } = params
  const title = `Tree: ${detail.parent_item_cd} ${detail.parent_item_nm}`
  const lines: BomTreeLine[] = [
    {
      indent: 0,
      kind: 'parent',
      item_cd: detail.parent_item_cd,
      item_nm: detail.parent_item_nm,
      item_id: detail.parent_item_id,
    },
  ]

  const parent = { item_id: detail.parent_item_id, item_cd: detail.parent_item_cd }

  if (useEditRows) {
    const processes = processRows
      .filter((row) => !isBlankProcessRow(row))
      .sort((a, b) => a.line_no - b.line_no)

    for (const proc of processes) {
      const wip = locations.find((loc) => loc.location_id === proc.wip_location_id)
      const wipCd = wip?.location_cd ?? ''
      const processLine = buildProcessTreeLine(
        {
          line_no: proc.line_no,
          wip_location_cd: wipCd,
          output_item_id: proc.output_item_id,
          output_item_cd: proc.output_item_cd,
          output_item_nm: proc.output_item_nm,
          planned_qty: proc.planned_qty,
        },
        parent
      )
      if (processLine) lines.push(processLine)

      const inputs = sortEditInputRowsForDisplay(
        inputRows.filter((row) => row.line_no === proc.line_no && !isBlankInputRow(row))
      )
      for (const inp of inputs) {
        const fromLoc = locations.find((loc) => loc.location_id === inp.from_location_id)
        lines.push(
          buildInputTreeLine(
            {
              line_no: inp.line_no,
              item_id: inp.item_id,
              item_cd: inp.item_cd,
              item_nm: inp.item_nm,
              req_qty: inp.req_qty,
              from_location_cd: fromLoc?.location_cd ?? '',
              level: 1,
            },
            wipCd,
            items
          )
        )
      }
    }
    return { title, lines }
  }

  const groups = processLinesFromDetail(detail)
  for (const group of groups) {
    const line = detail.lines.find((ln) => group.lineNos.includes(ln.line_no))
    if (!line) continue
    const processLine = buildProcessTreeLine(
      {
        line_no: line.line_no,
        wip_location_cd: line.wip_location_cd,
        output_item_id: line.output_item_id ?? '',
        output_item_cd: line.output_item_cd ?? '',
        output_item_nm: line.output_item_nm ?? '',
        planned_qty: line.planned_qty,
      },
      parent
    )
    if (processLine) lines.push(processLine)

    const inputs = detail.inputs
      .filter((inp) => group.lineNos.includes(inp.line_no))
      .sort(
        (a, b) =>
          (a.level ?? 0) - (b.level ?? 0) ||
          String(a.item_cd).localeCompare(String(b.item_cd))
      )
    for (const inp of inputs) {
      lines.push(
        buildInputTreeLine(
          {
            line_no: inp.line_no,
            item_id: inp.item_id,
            item_cd: inp.item_cd,
            item_nm: inp.item_nm,
            req_qty: inp.req_qty,
            from_location_cd: inp.from_location_cd ?? '',
            level: inp.level,
          },
          line.wip_location_cd,
          items
        )
      )
    }
  }

  return { title, lines }
}

export function resolveInputTreeHighlight(
  inputRows: EditInputRow[],
  selectedInputKey: string | null,
  detail: ProductionOrderDetail | null | undefined,
  processRows: EditProcessRow[],
  locations: LocationMaster[]
): ProcessTreeHighlight | null {
  if (!selectedInputKey) return null

  const wipCdForLine = (lineNo: number): string | undefined => {
    const proc = processRows.find((r) => r.line_no === lineNo && !isBlankProcessRow(r))
    if (proc?.wip_location_id !== '') {
      return locations.find((loc) => loc.location_id === proc.wip_location_id)?.location_cd
    }
    return detail?.lines.find((ln) => ln.line_no === lineNo)?.wip_location_cd ?? undefined
  }

  const row = inputRows.find((r) => r.key === selectedInputKey)
  if (row && !isBlankInputRow(row) && row.item_id !== '') {
    return {
      kind: 'input',
      itemId: Number(row.item_id),
      processLineNo: row.line_no,
      wipLocationCd: wipCdForLine(row.line_no),
    }
  }

  const saved = detail?.inputs.find(
    (inp) => String(inp.prd_order_input_id) === selectedInputKey
  )
  if (saved?.item_id != null) {
    return {
      kind: 'input',
      itemId: saved.item_id,
      processLineNo: saved.line_no,
      wipLocationCd: wipCdForLine(saved.line_no),
    }
  }
  return null
}
