import { useEffect, type MouseEvent, type ReactNode } from 'react'
import { ResizableGridTable, type GridColumnDef } from '../ResizableGridTable'
import { useGridColumnLayout, type GridColumnLayout } from '../../hooks/useGridColumnLayout'
import type { GridColumnLayoutOptions } from '../../hooks/useGridColumnLayoutOptions'
import { ErpPanelTitleBar } from './ErpPanelTitleBar'
import { ErpTitleBarActions } from './ErpTitleBarActions'

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
  /** When true, title / Save Grid / Reload are rendered by a parent ErpScreen instead. */
  hidePanelTitleBar?: boolean
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
  selectColumnHeader?: ReactNode
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
  hidePanelTitleBar = false,
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
  selectColumnHeader,
  children,
}: Props) {
  const layout = useGridColumnLayout(gridId, columns, {
    isColumnHeaderFilterable: isColumnFilterable,
    ...layoutOptions,
    rowCount: rowCount ?? layoutOptions?.rowCount,
  })
  useEffect(() => {
    onLayoutReady?.(layout)
  }, [layout.isDirty, layout.saveLayout, onLayoutReady])

  const showSaveGrid = showSaveGridButton || onSaveGrid != null
  const showTitleBar =
    !hidePanelTitleBar && Boolean(title || showSaveGrid || onRefresh)
  const showToolbar = Boolean(toolbarLeft || toolbarRight)

  return (
    <div className={`erp-panel erp-panel-grow${panelClassName ? ` ${panelClassName}` : ''}`}>
      {showTitleBar ? (
        <ErpPanelTitleBar title={title ?? ''}>
          <ErpTitleBarActions
            showSaveGridButton={showSaveGrid}
            onSaveGrid={onSaveGrid ?? (() => layout.saveLayout())}
            saveGridIsDirty={onSaveGrid ? undefined : layout.isDirty}
            onRefresh={onRefresh}
          />
        </ErpPanelTitleBar>
      ) : null}
      <div className="erp-panel-content">
        {showToolbar ? (
          <div className="erp-toolbar">
            <div className="erp-toolbar-left">{toolbarLeft}</div>
            <div className="erp-toolbar-right">{toolbarRight}</div>
          </div>
        ) : null}

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
              selectColumnHeader={selectColumnHeader}
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
