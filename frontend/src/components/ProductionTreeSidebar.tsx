import type { ReactNode } from 'react'

type ProductionTreeSidebarProps = {
  title: string
  onReset?: () => void
  children: ReactNode
}

export function ProductionTreeSidebar({ title, onReset, children }: ProductionTreeSidebarProps) {
  return (
    <div className="erp-panel erp-tree-panel-sidebar">
      <section className="erp-production-detail-section erp-production-detail-section-tree">
        <div className="erp-production-detail-section-title" title={title}>
          {title}
        </div>
        <div className="erp-detail-toolbar erp-production-detail-toolbar">
          {onReset ? (
            <button type="button" className="btn erp-btn erp-btn-clear btn-sm" onClick={onReset}>
              Reset
            </button>
          ) : null}
        </div>
        <div className="erp-tree-panel-body">{children}</div>
      </section>
    </div>
  )
}
