import type { ReactNode } from 'react'
import { ResizableGridTable, type GridColumnDef } from '../ResizableGridTable'
import { useGridColumnLayout, type GridColumnLayout } from '../../hooks/useGridColumnLayout'

type Props = {
  gridId: string
  title: string
  columns: GridColumnDef[]
  loading?: boolean
  isEmpty?: boolean
  loadingText?: string
  emptyText?: string
  onRefresh?: () => void
  toolbarRight?: ReactNode
  panelClassName?: string
  children: (layout: GridColumnLayout) => ReactNode
}

export function ErpGridPanel({
  gridId,
  title,
  columns,
  loading = false,
  isEmpty = false,
  loadingText = 'Loading…',
  emptyText = 'No data',
  onRefresh,
  toolbarRight,
  panelClassName,
  children,
}: Props) {
  const layout = useGridColumnLayout(gridId, columns)

  return (
    <div className={`erp-panel erp-panel-grow${panelClassName ? ` ${panelClassName}` : ''}`}>
      <div className="erp-panel-title">{title}</div>
      <div className="erp-panel-content">
        {(onRefresh || toolbarRight) && (
          <div className="erp-toolbar">
            <div className="erp-toolbar-left" />
            <div className="erp-toolbar-right">
              {toolbarRight}
              {onRefresh && (
                <button type="button" className="btn erp-btn erp-btn-clear" onClick={onRefresh}>
                  Refresh
                </button>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <p className="muted erp-grid-empty">{loadingText}</p>
        ) : isEmpty ? (
          <p className="muted erp-grid-empty">{emptyText}</p>
        ) : (
          <div className="erp-grid-wrap erp-grid-wrap-header">
            <ResizableGridTable layout={layout}>{children(layout)}</ResizableGridTable>
          </div>
        )}
      </div>
    </div>
  )
}

export function erpRowClass(index: number, selected?: boolean): string | undefined {
  if (selected) return 'selected'
  return index % 2 === 1 ? 'row-alt' : undefined
}
