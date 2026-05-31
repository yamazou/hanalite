import { useEffect, useRef } from 'react'
import { ColoredItemCode, ColoredItemName } from './ColoredItemText'
import { ProductionTreeSidebar } from './ProductionTreeSidebar'
import { isBomTreeLineHighlighted, type BomTreeLine, type ProcessTreeHighlight } from '../utils/bomTree'

type BomTreePanelProps = {
  title: string | null
  lines: BomTreeLine[]
  onClose?: () => void
  className?: string
  /** Fill parent column height (Production List sidebar). */
  sidebar?: boolean
  highlight?: ProcessTreeHighlight | null
}

export function BomTreePanel({
  title,
  lines,
  onClose,
  className,
  sidebar = false,
  highlight = null,
}: BomTreePanelProps) {
  const treeViewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = treeViewRef.current
    if (!root || !highlight) return
    const active = root.querySelector('.erp-tree-line-highlight')
    if (active instanceof HTMLElement) {
      active.scrollIntoView({ block: 'nearest' })
    }
  }, [highlight, lines])

  if (!title || lines.length === 0) return null

  const treeView = (
    <div
      ref={treeViewRef}
      className={`erp-tree-view${sidebar ? ' erp-tree-view-fill' : ''}`}
    >
      {lines.map((line, index) => {
        const active = isBomTreeLineHighlighted(line, highlight)
        const isProcess = line.kind === 'process'
        return (
          <div
            key={`${line.item_cd}-${index}`}
            className={`erp-tree-line${active ? ' erp-tree-line-highlight' : ''}`}
            style={{ paddingLeft: `${line.indent * 14}px` }}
          >
            {line.indent > 0 && !isProcess ? (
              <span className="erp-tree-marker" aria-hidden>
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
      <ProductionTreeSidebar title={title}>
        {treeView}
      </ProductionTreeSidebar>
    )
  }

  const panelClass = ['erp-panel', className].filter(Boolean).join(' ')
  const titleClass = 'erp-panel-title'

  return (
    <div className={panelClass}>
      <div className={titleClass}>{title}</div>
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
