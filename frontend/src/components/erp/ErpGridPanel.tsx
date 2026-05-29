import { useEffect, type MouseEvent, type ReactNode } from 'react'
import { ResizableGridTable, type GridColumnDef } from '../ResizableGridTable'
import { useGridColumnLayout, type GridColumnLayout } from '../../hooks/useGridColumnLayout'
import type { GridColumnLayoutOptions } from '../../hooks/useGridColumnLayoutOptions'
import { SaveGridButton } from './SaveGridButton'

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
  /** Custom save (e.g. multiple grids). When omitted, saves this panel's column layout. */
  onSaveGrid?: () => void
  panelClassName?: string
  onLayoutReady?: (layout: GridColumnLayout) => void
  onGridContextMenu?: (event: MouseEvent) => void
  sortMark?: (columnKey: string) => string
  onHeaderDoubleClick?: (columnKey: string) => void
  isColumnSortable?: (columnKey: string) => boolean
  isColumnFilterable?: (columnKey: string) => boolean
  isColumnFilterActive?: (columnKey: string) => boolean
  onFilterClick?: (columnKey: string, anchor: HTMLElement) => void
  layoutOptions?: GridColumnLayoutOptions
  /** Auto-fit rownum column to visible row count (Excel-like). */
  rowCount?: number
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
  onSaveGrid,
  panelClassName,
  onLayoutReady,
  onGridContextMenu,
  sortMark,
  onHeaderDoubleClick,
  isColumnSortable,
  isColumnFilterable,
  isColumnFilterActive,
  onFilterClick,
  layoutOptions,
  rowCount,
  children,
}: Props) {
  const layout = useGridColumnLayout(gridId, columns, {
    isColumnHeaderFilterable: isColumnFilterable,
    ...layoutOptions,
    rowCount: rowCount ?? layoutOptions?.rowCount,
  })
  useEffect(() => {
    onLayoutReady?.(layout)
  }, [layout, onLayoutReady])

  const showSaveGrid = showSaveGridButton || onSaveGrid != null

  return (
    <div className={`erp-panel erp-panel-grow${panelClassName ? ` ${panelClassName}` : ''}`}>
      {title ? <div className="erp-panel-title">{title}</div> : null}
      <div className="erp-panel-content">
        {(onRefresh || toolbarLeft || toolbarRight || showSaveGrid) && (
          <div className="erp-toolbar">
            <div className="erp-toolbar-left">{toolbarLeft}</div>
            <div className="erp-toolbar-right">
              {toolbarRight}
              {showSaveGrid && (
                <SaveGridButton
                  isDirty={onSaveGrid ? undefined : layout.isDirty}
                  onSave={onSaveGrid ?? (() => layout.saveLayout())}
                />
              )}
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
          <div
            className="erp-grid-wrap erp-grid-wrap-header"
            onContextMenu={
              onGridContextMenu
                ? (event) => {
                    event.preventDefault()
                    onGridContextMenu(event)
                  }
                : undefined
            }
          >
            <ResizableGridTable
              layout={layout}
              sortMark={sortMark}
              onHeaderDoubleClick={onHeaderDoubleClick}
              isColumnSortable={isColumnSortable}
              isColumnFilterable={isColumnFilterable}
              isColumnFilterActive={isColumnFilterActive}
              onFilterClick={onFilterClick}
            >
              {children(layout)}
            </ResizableGridTable>
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
