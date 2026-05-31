import { api } from '../api/client'
import type { BomRow } from '../types/boms'
import type { ItemSearchRow } from '../types/masters'
import { formatQty } from './format'

export type BomTreeLine = {
  indent: number
  item_cd: string
  item_nm: string
  item_id?: number
  itemtyp_id?: number
  suffix?: string
  to_location_cd?: string
  from_location_cd?: string
  kind?: 'parent' | 'process' | 'input'
  processLineNo?: number
}

export type BomTreeParent = {
  item_cd: string
  item_nm: string
  item_id?: number
  itemtyp_id?: number
}

async function resolveItemByCd(cd: string): Promise<ItemSearchRow | null> {
  const trimmed = cd.trim()
  if (!trimmed) return null
  const hits = await api.searchItems(trimmed, 15)
  const exact = hits.find((h) => h.item_cd.toLowerCase() === trimmed.toLowerCase())
  return exact ?? hits[0] ?? null
}

export async function loadBomTreeForParent(parent: BomTreeParent): Promise<{
  title: string
  lines: BomTreeLine[]
}> {
  const itemCd = parent.item_cd.trim()
  if (!itemCd) {
    return { title: '', lines: [] }
  }

  const allBoms = await api.listBoms()
  const byParent = new Map<number, BomRow[]>()
  for (const row of allBoms) {
    const bucket = byParent.get(row.p_item_id) ?? []
    bucket.push(row)
    byParent.set(row.p_item_id, bucket)
  }
  for (const [key, bucket] of byParent) {
    bucket.sort((a, b) => Number(a.level) - Number(b.level) || a.bom_id - b.bom_id)
    byParent.set(key, bucket)
  }

  const lines: BomTreeLine[] = [
    {
      indent: 0,
      item_cd: itemCd,
      item_nm: parent.item_nm,
      item_id: parent.item_id,
      itemtyp_id: parent.itemtyp_id,
    },
  ]

  let parentId = parent.item_id
  if (parentId == null) {
    const parentItem = await resolveItemByCd(itemCd)
    if (!parentItem) {
      return { title: `Tree: ${itemCd}`, lines: [] }
    }
    parentId = parentItem.item_id
    lines[0].item_id = parentItem.item_id
    lines[0].itemtyp_id = parentItem.itemtyp_id
  }

  const visitedParents = new Set<number>()
  const walk = (walkParentId: number, depth: number) => {
    if (visitedParents.has(walkParentId)) return
    visitedParents.add(walkParentId)
    for (const child of byParent.get(walkParentId) ?? []) {
      lines.push({
        indent: depth,
        item_cd: child.c_item_cd,
        item_nm: child.c_item_nm,
        item_id: child.c_item_id,
        to_location_cd: child.to_location_cd,
        from_location_cd: child.from_location_cd,
        suffix: `(Lv ${child.level}, ${child.to_location_cd} ← ${child.from_location_cd}, Qty ${formatQty(child.c_req_qty)})`,
      })
      walk(child.c_item_id, depth + 1)
    }
    visitedParents.delete(walkParentId)
  }
  walk(parentId, 1)

  return {
    title: `Tree: ${itemCd} ${parent.item_nm}`,
    lines,
  }
}

export type ProcessTreeHighlight =
  | { kind: 'parent'; itemId: number }
  | { kind: 'process'; processLineNo: number; wipLocationCd?: string }
  | { kind: 'input'; itemId: number; processLineNo: number; wipLocationCd?: string }

export function isSameProcessTreeHighlight(
  a: ProcessTreeHighlight | null | undefined,
  b: ProcessTreeHighlight | null | undefined
): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (a.kind !== b.kind) return false
  if (a.kind === 'parent' && b.kind === 'parent') return a.itemId === b.itemId
  if (a.kind === 'process' && b.kind === 'process') {
    return a.processLineNo === b.processLineNo && a.wipLocationCd === b.wipLocationCd
  }
  if (a.kind === 'input' && b.kind === 'input') {
    return (
      a.itemId === b.itemId &&
      a.processLineNo === b.processLineNo &&
      a.wipLocationCd === b.wipLocationCd
    )
  }
  return false
}

export function isBomTreeLineHighlighted(
  line: BomTreeLine,
  highlight: ProcessTreeHighlight | null | undefined
): boolean {
  if (!highlight) return false
  if (highlight.kind === 'parent') {
    return line.kind === 'parent' || (line.indent === 0 && line.item_id === highlight.itemId)
  }
  if (highlight.kind === 'process') {
    if (line.kind === 'process' || line.kind === 'input') {
      return line.processLineNo === highlight.processLineNo
    }
    if (highlight.wipLocationCd) {
      return line.to_location_cd === highlight.wipLocationCd
    }
    return false
  }
  if (line.kind === 'input') {
    return (
      line.item_id === highlight.itemId && line.processLineNo === highlight.processLineNo
    )
  }
  return (
    line.item_id === highlight.itemId &&
    (highlight.wipLocationCd == null || line.to_location_cd === highlight.wipLocationCd)
  )
}
