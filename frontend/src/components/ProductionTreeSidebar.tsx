import type { ReactNode } from 'react'

type ProductionTreeSidebarProps = {
  title: string
  children: ReactNode
}

export function ProductionTreeSidebar({ title, children }: ProductionTreeSidebarProps) {
  return (
    <div className="erp-panel erp-tree-panel-sidebar">
      <section className="erp-production-detail-section erp-production-detail-section-tree">
        <div className="erp-production-detail-section-title" title={title}>
          <span className="erp-production-detail-section-title-label">{title}</span>
        </div>
        <div className="erp-tree-panel-body">{children}</div>
      </section>
    </div>
  )
}
