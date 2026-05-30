import type { ReactNode } from 'react'

type Props = {
  title: string
  children?: ReactNode
}

/** Panel header: title on the left, actions (Save Grid, Refresh, …) on the right. */
export function ErpPanelTitleBar({ title, children }: Props) {
  return (
    <div className="erp-panel-title-bar">
      <span className="erp-panel-title-label">{title}</span>
      {children ? <div className="erp-panel-title-actions">{children}</div> : null}
    </div>
  )
}
