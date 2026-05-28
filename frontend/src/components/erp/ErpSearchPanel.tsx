import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

export function ErpSearchPanel({ children, className }: Props) {
  return (
    <div className={`erp-panel erp-panel-search${className ? ` ${className}` : ''}`}>
      <div className="erp-panel-body erp-search-body">
        {children}
      </div>
    </div>
  )
}
