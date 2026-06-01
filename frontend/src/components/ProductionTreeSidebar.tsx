import type { ReactNode } from 'react'
import { TreeExpandAllToggle } from './TreeExpandAllToggle'

type ProductionTreeSidebarProps = {
  expandAll: boolean
  expandAllDisabled?: boolean
  onExpandAllChange: (checked: boolean) => void
  children: ReactNode
}

export function ProductionTreeSidebar({
  expandAll,
  expandAllDisabled = false,
  onExpandAllChange,
  children,
}: ProductionTreeSidebarProps) {
  return (
    <div className="erp-panel erp-tree-panel-sidebar">
      <section className="erp-production-detail-section erp-production-detail-section-tree">
        <div className="erp-production-detail-section-title">
          <span className="erp-production-detail-section-title-label">Tree</span>
          <TreeExpandAllToggle
            checked={expandAll}
            disabled={expandAllDisabled}
            onChange={onExpandAllChange}
          />
        </div>
        <div className="erp-tree-panel-body">{children}</div>
      </section>
    </div>
  )
}
