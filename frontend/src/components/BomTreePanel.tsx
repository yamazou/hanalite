import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ColoredItemCode, ColoredItemName } from './ColoredItemText'
import { ProductionTreeSidebar } from './ProductionTreeSidebar'
import { TreeExpandAllToggle } from './TreeExpandAllToggle'
import {
  bomTreeLineShowsToggle,
  expandableBomTreeLineIndices,
  expandedSetIncludingLine,
  isBomTreeLineHighlighted,
  visibleBomTreeLineIndices,
  type BomTreeExpandMode,
  type BomTreeLine,
  type ProcessTreeHighlight,
} from '../utils/bomTree'

type BomTreePanelProps = {
  title: string | null
  lines: BomTreeLine[]
  onClose?: () => void
  className?: string
  /** Fill parent column height (Production List sidebar). */
  sidebar?: boolean
  highlight?: ProcessTreeHighlight | null
  /** Production FG: show FG+process+inputs by default; ▶ only on WIP inputs. */
  expandMode?: BomTreeExpandMode
}

export function BomTreePanel({
  title,
  lines,
  onClose,
  className,
  sidebar = false,
  highlight = null,
  expandMode = 'default',
}: BomTreePanelProps) {
  const treeViewRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const [expandAll, setExpandAll] = useState(false)
  const linesResetKey = useMemo(
    () =>
      lines
        .map(
          (line) =>
            `${line.indent}:${line.kind ?? ''}:${line.item_cd}:${line.processLineNo ?? ''}:${line.suffix ?? ''}:${line.wipSubtree ? 'w' : ''}`
        )
        .join('\n'),
    [lines]
  )

  const expandableIndices = useMemo(
    () => expandableBomTreeLineIndices(lines, expandMode),
    [lines, expandMode]
  )
  const expandAllDisabled = expandableIndices.length === 0

  useEffect(() => {
    setExpanded(new Set())
    setExpandAll(false)
    if (treeViewRef.current) treeViewRef.current.scrollTop = 0
  }, [title, linesResetKey])

  useEffect(() => {
    if (!highlight || lines.length === 0 || expandAll) return
    const index = lines.findIndex((line) => isBomTreeLineHighlighted(line, highlight))
    if (index < 0) return
    setExpanded((prev) => expandedSetIncludingLine(lines, prev, index, expandMode))
  }, [highlight, lines, expandMode, expandAll])

  const handleExpandAllChange = useCallback(
    (checked: boolean) => {
      setExpandAll(checked)
      setExpanded(checked ? new Set(expandableIndices) : new Set())
    },
    [expandableIndices]
  )

  const toggleExpanded = useCallback((index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  useEffect(() => {
    const root = treeViewRef.current
    if (!root || !highlight) return
    const active = root.querySelector('.erp-tree-line-highlight')
    if (!(active instanceof HTMLElement)) return
    const lineTop = active.offsetTop
    const lineBottom = lineTop + active.offsetHeight
    const viewTop = root.scrollTop
    const viewBottom = viewTop + root.clientHeight
    if (lineTop < viewTop) {
      root.scrollTop = lineTop
    } else if (lineBottom > viewBottom) {
      root.scrollTop = lineBottom - root.clientHeight
    }
  }, [highlight, lines, expanded])

  if (!title || lines.length === 0) return null

  const visibleIndices = visibleBomTreeLineIndices(lines, expanded, expandMode)

  const treeView = (
    <div
      ref={treeViewRef}
      className={`erp-tree-view${sidebar ? ' erp-tree-view-fill' : ''}`}
    >
      {visibleIndices.map((lineIndex) => {
        const line = lines[lineIndex]
        const active = isBomTreeLineHighlighted(line, highlight)
        const isProcess = line.kind === 'process'
        const showToggle = bomTreeLineShowsToggle(lines, lineIndex, expandMode)
        const isExpanded = expanded.has(lineIndex)
        return (
          <div
            key={`${line.item_cd}-${lineIndex}`}
            className={`erp-tree-line${active ? ' erp-tree-line-highlight' : ''}`}
            style={{ paddingLeft: `${line.indent * 14}px` }}
          >
            {showToggle ? (
              <button
                type="button"
                className="erp-tree-toggle"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                onClick={() => toggleExpanded(lineIndex)}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            ) : line.indent > 0 && expandMode === 'default' ? (
              <span className="erp-tree-marker erp-tree-marker-spacer" aria-hidden>
                ▶
              </span>
            ) : null}
            {isProcess ? (
              <span className="erp-tree-process-btn">{line.item_cd}</span>
            ) : (
              <>
                <ColoredItemCode itemId={line.item_id} itemtypId={line.itemtyp_id}>
                  {line.item_cd}
                </ColoredItemCode>
                {line.item_nm ? (
                  <>
                    {' '}
                    <ColoredItemName itemId={line.item_id} itemtypId={line.itemtyp_id}>
                      {line.item_nm}
                    </ColoredItemName>
                  </>
                ) : null}
              </>
            )}
            {line.suffix ? <span className="erp-tree-suffix"> {line.suffix}</span> : null}
          </div>
        )
      })}
    </div>
  )

  if (sidebar) {
    return (
      <ProductionTreeSidebar
        expandAll={expandAll}
        expandAllDisabled={expandAllDisabled}
        onExpandAllChange={handleExpandAllChange}
      >
        {treeView}
      </ProductionTreeSidebar>
    )
  }

  const panelClass = ['erp-panel', className].filter(Boolean).join(' ')

  return (
    <div className={panelClass}>
      <div className="erp-panel-title erp-tree-panel-title-bar">
        <span>Tree</span>
        <TreeExpandAllToggle
          checked={expandAll}
          disabled={expandAllDisabled}
          onChange={handleExpandAllChange}
        />
      </div>
      <div className="erp-panel-content erp-tree-panel-body">
        {treeView}
        {onClose ? (
          <div className="erp-search-actions">
            <button type="button" className="btn erp-btn erp-btn-clear" onClick={onClose}>
              Close
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
