import type { Item } from '../types'
import type { ItemProcessesOut } from '../types/itemprocs'
import type { ItemTyp, LocationMaster } from '../types/masters'
import type { ProductionOrderDetail } from '../types/production'
import type { BomTreeLine, ProcessTreeHighlight } from './bomTree'
import { formatQty } from './format'
import {
  appendSavedItemProcessSubtree,
  isWipCatalogItem,
  processStepsTreeDisplayOrder,
} from './itemProcessTree'
import {
  editInputText,
  isActiveInputRow,
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

export function isSameProductionTreeData(
  data: ProductionTreeData,
  title: string | null,
  lines: BomTreeLine[]
): boolean {
  if (data.title !== title || data.lines.length !== lines.length) return false
  return data.lines.every((line, index) => {
    const prev = lines[index]
    return (
      line.indent === prev.indent &&
      line.item_cd === prev.item_cd &&
      line.item_nm === prev.item_nm &&
      line.item_id === prev.item_id &&
      line.kind === prev.kind &&
      line.processLineNo === prev.processLineNo &&
      line.suffix === prev.suffix &&
      line.to_location_cd === prev.to_location_cd &&
      line.from_location_cd === prev.from_location_cd &&
      line.wipSubtree === prev.wipSubtree
    )
  })
}

export function collectProductionOrderWipIds(params: {
  detail: ProductionOrderDetail
  inputRows: EditInputRow[]
  items: Item[]
  itemtyps: ItemTyp[]
  useEditRows: boolean
}): number[] {
  const { detail, inputRows, items, itemtyps, useEditRows } = params
  const ids = new Set<number>()
  if (useEditRows) {
    for (const row of inputRows) {
      if (!isActiveInputRow(row) || row.item_id === '') continue
      const itemId = Number(row.item_id)
      if (isWipCatalogItem(items, itemtyps, itemId)) ids.add(itemId)
    }
    return [...ids]
  }
  for (const inp of detail.inputs) {
    if (isWipCatalogItem(items, itemtyps, inp.item_id)) ids.add(inp.item_id)
  }
  return [...ids]
}

/**
 * Tree display should show what users see in Input grid.
 * Keep this looser than save validation to avoid "missing" lines in tree.
 */
function isTreeVisibleInputRow(row: EditInputRow): boolean {
  if (isBlankInputRow(row)) return false
  return row.item_id !== '' || editInputText(row.item_cd).trim() !== ''
}

function appendWipSubtreesForInput(
  lines: BomTreeLine[],
  itemId: number | undefined,
  items: Item[],
  locations: LocationMaster[],
  itemtyps: ItemTyp[],
  cache: Map<number, ItemProcessesOut> | undefined,
  visited: Set<number>
): void {
  if (itemId == null || !cache?.has(itemId) || !isWipCatalogItem(items, itemtyps, itemId)) return
  const saved = cache.get(itemId)
  if (!saved?.processes.length) return
  appendSavedItemProcessSubtree(lines, 3, itemId, items, locations, cache, visited, itemtyps)
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

function resolveInputTreeItemFields(
  inp: {
    item_id: number | ''
    item_cd: string
    item_nm: string
  },
  items: Item[]
): { item_id?: number; item_cd: string; item_nm: string } {
  const itemId = inp.item_id !== '' ? Number(inp.item_id) : undefined
  const catalog = itemId != null ? items.find((item) => item.item_id === itemId) : undefined
  return {
    item_id: itemId,
    item_cd: editInputText(inp.item_cd).trim() || catalog?.item_cd || '',
    item_nm: editInputText(inp.item_nm).trim() || catalog?.item_nm || '',
  }
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
  const resolved = resolveInputTreeItemFields(inp, items)
  const fromCd = editInputText(inp.from_location_cd).trim()
  const suffix = wipLocationCd
    ? fromCd
      ? `(${wipLocationCd} ← ${fromCd}, In ${formatQty(inp.req_qty)})`
      : `(${wipLocationCd}, In ${formatQty(inp.req_qty)})`
    : `In ${formatQty(inp.req_qty)}`
  return {
    indent: indent ?? inputTreeIndent(inp.level),
    kind: 'input',
    item_cd: resolved.item_cd,
    item_nm: resolved.item_nm,
    item_id: resolved.item_id,
    itemtyp_id: itemtypIdFor(items, resolved.item_id ?? ''),
    to_location_cd: wipLocationCd || undefined,
    from_location_cd: fromCd || undefined,
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
  itemtyps?: ItemTyp[]
  itemProcessCache?: Map<number, ItemProcessesOut>
  useEditRows: boolean
}): ProductionTreeData {
  const { detail, processRows, inputRows, locations, items, itemtyps = [], itemProcessCache, useEditRows } =
    params
  const visited = new Set<number>()
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
    const processesForTree = processStepsTreeDisplayOrder(
      processRows.filter((row) => !isBlankProcessRow(row))
    )

    for (const proc of processesForTree) {
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
        inputRows.filter((row) => row.line_no === proc.line_no && isTreeVisibleInputRow(row))
      )
      for (const inp of inputs) {
        const fromLoc = locations.find((loc) => loc.location_id === inp.from_location_id)
        const itemId = inp.item_id !== '' ? Number(inp.item_id) : undefined
        const hasWipSubtree =
          itemId != null &&
          itemProcessCache?.has(itemId) &&
          (itemProcessCache.get(itemId)?.processes.length ?? 0) > 0 &&
          isWipCatalogItem(items, itemtyps, itemId)
        const inputLine = buildInputTreeLine(
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
        lines.push({ ...inputLine, wipSubtree: hasWipSubtree })
        appendWipSubtreesForInput(
          lines,
          itemId,
          items,
          locations,
          itemtyps,
          itemProcessCache,
          visited
        )
      }
    }
    return { title, lines }
  }

  const groups = [...processLinesFromDetail(detail)].sort((a, b) => b.no - a.no)
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
      const hasWipSubtree =
        itemProcessCache?.has(inp.item_id) &&
        (itemProcessCache.get(inp.item_id)?.processes.length ?? 0) > 0 &&
        isWipCatalogItem(items, itemtyps, inp.item_id)
      const inputLine = buildInputTreeLine(
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
      lines.push({ ...inputLine, wipSubtree: hasWipSubtree })
      appendWipSubtreesForInput(
        lines,
        inp.item_id,
        items,
        locations,
        itemtyps,
        itemProcessCache,
        visited
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
