import { useEffect, useState, type ReactNode } from 'react'
import { ResizableGridTable, type GridColumnDef } from '../ResizableGridTable'
import { useGridColumnLayout, type GridColumnLayout } from '../../hooks/useGridColumnLayout'

type Props = {
  gridId: string
  title?: string
  columns: GridColumnDef[]
  loading?: boolean
  isEmpty?: boolean
  loadingText?: string
  emptyText?: string
  onRefresh?: () => void
  toolbarLeft?: ReactNode
  toolbarRight?: ReactNode
  showSaveGridButton?: boolean
  panelClassName?: string
  onLayoutReady?: (layout: GridColumnLayout) => void
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
  toolbarLeft,
  toolbarRight,
  showSaveGridButton = false,
  panelClassName,
  onLayoutReady,
  children,
}: Props) {
  const layout = useGridColumnLayout(gridId, columns)
  const [saveHint, setSaveHint] = useState<string | null>(null)

  useEffect(() => {
    onLayoutReady?.(layout)
  }, [layout, onLayoutReady])

  useEffect(() => {
    if (!saveHint) return
    const t = window.setTimeout(() => setSaveHint(null), 1800)
    return () => window.clearTimeout(t)
  }, [saveHint])

  return (
    <div className={`erp-panel erp-panel-grow${panelClassName ? ` ${panelClassName}` : ''}`}>
      {title ? <div className="erp-panel-title">{title}</div> : null}
      <div className="erp-panel-content">
        {(onRefresh || toolbarLeft || toolbarRight || showSaveGridButton) && (
          <div className="erp-toolbar">
            <div className="erp-toolbar-left">{toolbarLeft}</div>
            <div className="erp-toolbar-right">
              {toolbarRight}
              {showSaveGridButton && (
                <button
                  type="button"
                  className="btn erp-btn erp-btn-search"
                  onClick={() => {
                    if (layout.isDirty) {
                      layout.saveLayout()
                      setSaveHint('Grid layout saved.')
                    } else {
                      setSaveHint('No layout changes.')
                    }
                  }}
                >
                  Save Grid
                </button>
              )}
              {saveHint && <span className="muted">{saveHint}</span>}
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
