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
  /** Production FG tree: WIP input with saved subprocess (▶ expands). */
  wipSubtree?: boolean
}

export type BomTreeExpandMode = 'default' | 'production-fg'

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

/** Direct parent line index, or null when none (e.g. root). */
export function findBomTreeParentIndex(lines: BomTreeLine[], index: number): number | null {
  const indent = lines[index]?.indent
  if (indent == null || indent <= 0) return null
  for (let i = index - 1; i >= 0; i--) {
    if (lines[i].indent === indent - 1) return i
  }
  return null
}

export function bomTreeLineHasChildren(lines: BomTreeLine[], index: number): boolean {
  const parentIndent = lines[index]?.indent
  if (parentIndent == null) return false
  for (let i = index + 1; i < lines.length; i++) {
    if (lines[i].indent <= parentIndent) return false
    if (lines[i].indent > parentIndent) return true
  }
  return false
}

export function bomTreeLineShowsToggle(
  lines: BomTreeLine[],
  index: number,
  expandMode: BomTreeExpandMode = 'default'
): boolean {
  if (!bomTreeLineHasChildren(lines, index)) return false
  const line = lines[index]
  if (expandMode === 'production-fg') {
    return line.kind === 'input' && line.wipSubtree === true
  }
  if (line.kind === 'parent' || line.kind === 'process') return false
  return line.indent > 0
}

export function isBomTreeLineVisible(
  lines: BomTreeLine[],
  index: number,
  expanded: ReadonlySet<number>,
  expandMode: BomTreeExpandMode = 'default'
): boolean {
  if (expandMode === 'production-fg') {
    const line = lines[index]
    if (line.indent <= 2) return true
    let cursor = index
    while (true) {
      const parentIdx = findBomTreeParentIndex(lines, cursor)
      if (parentIdx == null) return true
      const parent = lines[parentIdx]
      if (parent.indent === 2 && parent.wipSubtree && !expanded.has(parentIdx)) return false
      if (parent.indent <= 2) return true
      cursor = parentIdx
    }
  }
  if (index <= 0) return true
  let parentIdx = findBomTreeParentIndex(lines, index)
  while (parentIdx != null) {
    if (bomTreeLineShowsToggle(lines, parentIdx, expandMode) && !expanded.has(parentIdx)) {
      return false
    }
    parentIdx = parentIdx > 0 ? findBomTreeParentIndex(lines, parentIdx) : null
  }
  return true
}

export function expandableBomTreeLineIndices(
  lines: BomTreeLine[],
  expandMode: BomTreeExpandMode = 'default'
): number[] {
  const indices: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (bomTreeLineShowsToggle(lines, i, expandMode)) indices.push(i)
  }
  return indices
}

export function visibleBomTreeLineIndices(
  lines: BomTreeLine[],
  expanded: ReadonlySet<number>,
  expandMode: BomTreeExpandMode = 'default'
): number[] {
  const indices: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (isBomTreeLineVisible(lines, i, expanded, expandMode)) indices.push(i)
  }
  return indices
}

/** Expand ancestors so a highlighted line is shown. */
export function expandedSetIncludingLine(
  lines: BomTreeLine[],
  expanded: ReadonlySet<number>,
  lineIndex: number,
  expandMode: BomTreeExpandMode = 'default'
): Set<number> {
  const next = new Set(expanded)
  if (expandMode === 'production-fg') {
    let cursor = lineIndex
    while (true) {
      const parentIdx = findBomTreeParentIndex(lines, cursor)
      if (parentIdx == null) break
      const parent = lines[parentIdx]
      if (parent.wipSubtree) next.add(parentIdx)
      cursor = parentIdx
    }
    return next
  }
  let parentIdx = findBomTreeParentIndex(lines, lineIndex)
  while (parentIdx != null) {
    if (bomTreeLineShowsToggle(lines, parentIdx, expandMode)) next.add(parentIdx)
    parentIdx = parentIdx > 0 ? findBomTreeParentIndex(lines, parentIdx) : null
  }
  return next
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
