import type { ItemProcessesOut } from '../types/itemprocs'
import type { ItemListRow, ItemTyp, LocationMaster } from '../types/masters'
import type { ProductionOrderDetail } from '../types/production'
import type { BomTreeLine } from './bomTree'
import {
  isActiveItemProcessInputRow,
  isBlankItemProcessInputRow,
  isBlankItemProcessRow,
  resolveItemProcessInputFromLocationCd,
} from './itemProcessEdit'
import { formatItemCodeName } from './format'
import type { ProductionTreeData } from './productionOrderTree'
import {
  processRowsFromSavedItemProcesses,
  resolveInputFromLocationCdForStep,
  isBlankProcessRowLike,
} from './inputFromLocation'
import {
  buildInputTreeLine,
  buildProcessTreeLine,
} from './productionOrderTree'
import { sortEditInputRowsForDisplay, type EditInputRow, type EditProcessRow } from './productionEdit'

export function isWipItemtyp(itemtyp: Pick<ItemTyp, 'itemtyp_cd' | 'itemtyp_nm'>): boolean {
  const cd = itemtyp.itemtyp_cd.trim().toUpperCase()
  const nm = itemtyp.itemtyp_nm.trim().toLowerCase()
  return cd === 'WIP' || nm === 'wip' || nm.includes('work in process')
}

export function isWipCatalogItem(
  items: { item_id: number; itemtyp_id?: number }[],
  itemtyps: ItemTyp[],
  itemId: number
): boolean {
  const item = items.find((row) => row.item_id === itemId)
  if (!item?.itemtyp_id) return false
  const typ = itemtyps.find((row) => row.itemtyp_id === item.itemtyp_id)
  return typ ? isWipItemtyp(typ) : false
}

export function isWipItem(items: ItemListRow[], itemId: number): boolean {
  const item = items.find((row) => row.item_id === itemId)
  if (!item) return false
  const nm = item.itemtyp_nm.trim().toLowerCase()
  return nm === 'wip' || nm === 'work in process'
}

export function isFgItem(items: ItemListRow[], itemId: number): boolean {
  const item = items.find((row) => row.item_id === itemId)
  if (!item) return false
  const nm = item.itemtyp_nm.trim().toLowerCase()
  return nm === 'fg' || nm.includes('finished')
}

function pickParentRootCode(
  parents: { item_id: number; item_cd: string }[],
  items: ItemListRow[]
): string {
  const fgParent = parents.find((p) => isFgItem(items, p.item_id))
  if (fgParent) return fgParent.item_cd
  return parents[0]?.item_cd ?? ''
}

/** Process grid: first step at top (line_no ascending). Tree: final step first (line_no descending). */
export function processStepsTreeDisplayOrder<T extends { line_no: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.line_no - a.line_no)
}

export function appendSavedItemProcessSubtree(
  lines: BomTreeLine[],
  startIndent: number,
  itemId: number,
  items: { item_id: number; itemtyp_id?: number }[],
  locations: LocationMaster[],
  cache: Map<number, ItemProcessesOut>,
  visited: Set<number>,
  itemtyps?: ItemTyp[]
): void {
  if (visited.has(itemId)) return
  const saved = cache.get(itemId)
  if (!saved?.processes.length) return

  visited.add(itemId)
  const parent = { item_id: saved.item_id, item_cd: saved.item_cd }

  const processes = processStepsTreeDisplayOrder(saved.processes)
  const subprocessProcessRows = processRowsFromSavedItemProcesses(saved.processes)
  for (const proc of processes) {
    const processLine = buildProcessTreeLine(
      {
        line_no: proc.line_no,
        wip_location_cd: proc.wip_location_cd,
        output_item_id: proc.output_item_id,
        output_item_cd: proc.output_item_cd,
        output_item_nm: proc.output_item_nm,
        planned_qty: '',
      },
      parent,
      startIndent,
      false
    )
    if (processLine) lines.push(processLine)

    const procInputs = [...proc.inputs].sort((a, b) => a.input_no - b.input_no)
    for (const inp of procInputs) {
      const fromCd = resolveInputFromLocationCdForStep(
        proc.line_no,
        inp.item_id,
        subprocessProcessRows,
        locations,
        items,
        itemtyps ?? [],
        isBlankProcessRowLike
      )
      lines.push(
        buildInputTreeLine(
          {
            line_no: proc.line_no,
            item_id: inp.item_id,
            item_cd: inp.item_cd,
            item_nm: inp.item_nm,
            req_qty: inp.req_qty,
            from_location_cd: fromCd,
          },
          proc.wip_location_cd,
          items,
          startIndent + 1
        )
      )
      const nested = cache.get(inp.item_id)
      if (nested?.processes.length) {
        appendSavedItemProcessSubtree(
          lines,
          startIndent + 2,
          inp.item_id,
          items,
          locations,
          cache,
          visited,
          itemtyps
        )
      }
    }
  }
  visited.delete(itemId)
}

function appendEditProcessBranch(
  lines: BomTreeLine[],
  processIndent: number,
  proc: EditProcessRow,
  processRows: EditProcessRow[],
  inputRows: EditInputRow[],
  items: ItemListRow[],
  locations: LocationMaster[],
  cache: Map<number, ItemProcessesOut>,
  visited: Set<number>,
  fgParent: { item_id: number; item_cd: string },
  itemtyps: ItemTyp[]
): void {
  const wip = locations.find((loc) => loc.location_id === proc.wip_location_id)
  const wipCd = wip?.location_cd ?? ''
  const parent = fgParent

  const processLine = buildProcessTreeLine(
    {
      line_no: proc.line_no,
      wip_location_cd: wipCd,
      output_item_id: proc.output_item_id,
      output_item_cd: proc.output_item_cd,
      output_item_nm: proc.output_item_nm,
      planned_qty: '',
    },
    parent,
    processIndent,
    false
  )
  if (processLine) lines.push(processLine)

  const inputs = sortEditInputRowsForDisplay(
    inputRows.filter(
      (row) => row.line_no === proc.line_no && isActiveItemProcessInputRow(row)
    ),
    isBlankItemProcessInputRow
  )

  for (const inp of inputs) {
    const fromCd = resolveItemProcessInputFromLocationCd(
      proc.line_no,
      inp.item_id,
      processRows,
      locations,
      items,
      itemtyps
    )
    lines.push(
      buildInputTreeLine(
        {
          line_no: inp.line_no,
          item_id: inp.item_id,
          item_cd: inp.item_cd,
          item_nm: inp.item_nm,
          req_qty: inp.req_qty,
          from_location_cd: fromCd,
        },
        wipCd,
        items,
        processIndent + 1
      )
    )

    if (inp.item_id !== '' && isWipItem(items, Number(inp.item_id)) && cache.has(Number(inp.item_id))) {
      appendSavedItemProcessSubtree(
        lines,
        processIndent + 2,
        Number(inp.item_id),
        items,
        locations,
        cache,
        visited,
        itemtyps
      )
    }
  }
}

/** Tree for Item Processes master: expands WIP inputs using saved subprocess definitions. */
export function buildItemProcessMasterTree(params: {
  detail: ProductionOrderDetail
  processRows: EditProcessRow[]
  inputRows: EditInputRow[]
  locations: LocationMaster[]
  items: ItemListRow[]
  itemtyps: ItemTyp[]
  itemProcessCache: Map<number, ItemProcessesOut>
}): ProductionTreeData {
  const { detail, processRows, inputRows, locations, items, itemtyps, itemProcessCache } = params
  const title = `Tree: ${formatItemCodeName(detail.parent_item_cd, detail.parent_item_nm)}`
  const lines: BomTreeLine[] = [
    {
      indent: 0,
      kind: 'parent',
      item_cd: detail.parent_item_cd,
      item_nm: detail.parent_item_nm,
      item_id: detail.parent_item_id,
      itemtyp_id: items.find((row) => row.item_id === detail.parent_item_id)?.itemtyp_id,
    },
  ]

  const processRowsActive = processRows
    .filter((row) => !isBlankItemProcessRow(row))
    .sort((a, b) => a.line_no - b.line_no)
  const processesForTree = processStepsTreeDisplayOrder(processRowsActive)

  const visited = new Set<number>()
  const fgParent = { item_id: detail.parent_item_id, item_cd: detail.parent_item_cd }
  for (const proc of processesForTree) {
    appendEditProcessBranch(
      lines,
      1,
      proc,
      processRowsActive,
      inputRows,
      items,
      locations,
      itemProcessCache,
      visited,
      fgParent,
      itemtyps
    )
  }

  return { title, lines }
}

function collectSavedProcessDescendantIds(
  itemId: number,
  items: ItemListRow[],
  cache: Map<number, ItemProcessesOut>,
  visiting: Set<number>
): Set<number> {
  const found = new Set<number>()
  if (visiting.has(itemId)) return found
  const saved = cache.get(itemId)
  if (!saved) return found
  visiting.add(itemId)
  for (const proc of saved.processes) {
    for (const inp of proc.inputs) {
      const id = inp.item_id
      found.add(id)
      if (isWipItem(items, id)) {
        for (const subId of collectSavedProcessDescendantIds(id, items, cache, visiting)) {
          found.add(subId)
        }
      }
    }
  }
  visiting.delete(itemId)
  return found
}

function collectEditProcessDescendantIds(
  processRows: EditProcessRow[],
  inputRows: EditInputRow[],
  items: ItemListRow[],
  cache: Map<number, ItemProcessesOut>,
  visiting: Set<number>
): Set<number> {
  const found = new Set<number>()
  const processes = processRows
    .filter((row) => !isBlankItemProcessRow(row))
    .sort((a, b) => a.line_no - b.line_no)
  for (const proc of processes) {
    const inputs = sortEditInputRowsForDisplay(
      inputRows.filter(
        (row) => row.line_no === proc.line_no && isActiveItemProcessInputRow(row)
      ),
      isBlankItemProcessInputRow
    )
    for (const inp of inputs) {
      const id = Number(inp.item_id)
      found.add(id)
      if (isWipItem(items, id)) {
        for (const subId of collectSavedProcessDescendantIds(id, items, cache, visiting)) {
          found.add(subId)
        }
      }
    }
  }
  return found
}

/**
 * For each output-item row, the tree top-level (final) item code.
 * WIP rows that are used under an FG root (e.g. T51…) show that FG even when listed as their own output item.
 */
export function buildOutputItemFinalItemCodeMap(params: {
  roots: { item_id: number; item_cd: string }[]
  items: ItemListRow[]
  cache: Map<number, ItemProcessesOut>
  /** Currently selected output item — use live process/input rows for its tree. */
  activeRootId?: number
  activeProcessRows?: EditProcessRow[]
  activeInputRows?: EditInputRow[]
}): Map<number, string> {
  const { roots, items, cache, activeRootId, activeProcessRows, activeInputRows } = params
  const parentsByItemId = new Map<number, { item_id: number; item_cd: string }[]>()

  for (const root of roots) {
    const visiting = new Set<number>()
    const descendants =
      root.item_id === activeRootId && activeProcessRows && activeInputRows
        ? collectEditProcessDescendantIds(
            activeProcessRows,
            activeInputRows,
            items,
            cache,
            visiting
          )
        : collectSavedProcessDescendantIds(root.item_id, items, cache, visiting)

    for (const id of descendants) {
      const list = parentsByItemId.get(id) ?? []
      if (!list.some((p) => p.item_id === root.item_id)) {
        list.push({ item_id: root.item_id, item_cd: root.item_cd })
        parentsByItemId.set(id, list)
      }
    }
  }

  const result = new Map<number, string>()
  for (const root of roots) {
    const parents = parentsByItemId.get(root.item_id)
    if (parents && parents.length > 0) {
      result.set(root.item_id, pickParentRootCode(parents, items))
    } else {
      result.set(root.item_id, root.item_cd)
    }
  }
  return result
}

/** Collect WIP item ids referenced from root inputs and cached subprocess trees. */
export function collectWipItemProcessIds(
  inputRows: EditInputRow[],
  items: ItemListRow[],
  cache: Map<number, ItemProcessesOut>
): number[] {
  const ids = new Set<number>()
  const addFromInputs = (rows: EditInputRow[]) => {
    for (const row of rows) {
      if (!isActiveItemProcessInputRow(row)) continue
      const itemId = Number(row.item_id)
      if (!isWipItem(items, itemId)) continue
      ids.add(itemId)
    }
  }
  addFromInputs(inputRows)
  for (const saved of cache.values()) {
    for (const proc of saved.processes) {
      for (const inp of proc.inputs) {
        if (isWipItem(items, inp.item_id)) ids.add(inp.item_id)
      }
    }
  }
  return [...ids]
}
