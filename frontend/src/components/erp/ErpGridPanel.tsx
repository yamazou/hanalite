import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { ResizableGridTable, type GridColumnDef } from '../ResizableGridTable'
import { useGridColumnLayout, type GridColumnLayout } from '../../hooks/useGridColumnLayout'
import type { GridColumnLayoutOptions } from '../../hooks/useGridColumnLayoutOptions'
import { ErpPanelTitleBar } from './ErpPanelTitleBar'
import { ErpTitleBarActions } from './ErpTitleBarActions'

import type { GridFilterAnchorRect } from '../../utils/gridFilterAnchor'
import { GRID_ROW_NAV_WRAP_ATTR } from '../../utils/headerListKeyboardNav'

type Props = {
  gridId: string
  title?: string
  columns: GridColumnDef[]
  loading?: boolean
  isEmpty?: boolean
  loadingText?: string
  emptyText?: string
  onRefresh?: () => void | Promise<void>
  toolbarLeft?: ReactNode
  toolbarRight?: ReactNode
  showSaveGridButton?: boolean
  saveGridLabel?: string
  saveGridSuccessMessage?: string
  saveGridNoChangesMessage?: string
  /** Custom save (e.g. multiple grids). When omitted, saves this panel's column layout. */
  onSaveGrid?: () => void
  /** When true, title / Save Grid / Reload are rendered by a parent ErpScreen instead. */
  hidePanelTitleBar?: boolean
  /** `section` matches Process / Input Item detail section headers. */
  titleBarStyle?: 'panel' | 'section'
  /** Actions on the title row (tabs, Update, …). */
  titleActions?: ReactNode
  panelClassName?: string
  onLayoutReady?: (layout: GridColumnLayout) => void
  onGridContextMenu?: (event: MouseEvent) => void
  sortMark?: (columnKey: string) => string
  onHeaderDoubleClick?: (columnKey: string) => void
  isColumnSortable?: (columnKey: string) => boolean
  isColumnFilterable?: (columnKey: string) => boolean
  isColumnFilterActive?: (columnKey: string) => boolean
  onFilterClick?: (columnKey: string, anchor: HTMLElement, anchorRect: GridFilterAnchorRect) => void
  layoutOptions?: GridColumnLayoutOptions
  /** Auto-fit rownum column to visible row count (Excel-like). */
  rowCount?: number
  /** Enables ↑↓ row keyboard navigation within this grid wrap. */
  gridRowNavWrapId?: string
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
  saveGridLabel,
  saveGridSuccessMessage,
  saveGridNoChangesMessage,
  onSaveGrid,
  hidePanelTitleBar = false,
  titleBarStyle = 'panel',
  titleActions,
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
  gridRowNavWrapId,
  selectColumnHeader,
  children,
}: Props) {
  const layout = useGridColumnLayout(gridId, columns, {
    isColumnHeaderFilterable: isColumnFilterable,
    ...layoutOptions,
    rowCount: rowCount ?? layoutOptions?.rowCount,
  })
  const onLayoutReadyRef = useRef(onLayoutReady)
  onLayoutReadyRef.current = onLayoutReady
  useEffect(() => {
    onLayoutReadyRef.current?.(layout)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layout is recreated each render; isDirty drives Save Grid state
  }, [layout.isDirty])

  const showSaveGrid = showSaveGridButton || onSaveGrid != null
  const showTitleBar =
    !hidePanelTitleBar &&
    Boolean(title || titleActions || showSaveGrid || onRefresh)
  const showToolbar = Boolean(toolbarLeft || toolbarRight)

  const sectionTitle = title?.trim() ?? ''
  const titleBar =
    titleBarStyle === 'section' ? (
      <div
        className={[
          'erp-production-detail-section-title',
          !sectionTitle ? 'erp-production-detail-section-title--no-label' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {sectionTitle ? (
          <span className="erp-production-detail-section-title-label">{sectionTitle}</span>
        ) : null}
        {titleActions ? (
          <div className="erp-production-detail-section-title-actions">{titleActions}</div>
        ) : null}
      </div>
    ) : (
      <ErpPanelTitleBar title={title ?? ''}>
        {titleActions ?? (
          <ErpTitleBarActions
            showSaveGridButton={showSaveGrid}
            onSaveGrid={onSaveGrid ?? (() => layout.saveLayout())}
            saveGridIsDirty={onSaveGrid ? undefined : layout.isDirty}
            saveGridLabel={saveGridLabel}
            saveGridSuccessMessage={saveGridSuccessMessage}
            saveGridNoChangesMessage={saveGridNoChangesMessage}
            onRefresh={onRefresh}
          />
        )}
      </ErpPanelTitleBar>
    )

  return (
    <div className={`erp-panel erp-panel-grow${panelClassName ? ` ${panelClassName}` : ''}`}>
      {showTitleBar ? titleBar : null}
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
            {...(gridRowNavWrapId
              ? { [GRID_ROW_NAV_WRAP_ATTR]: gridRowNavWrapId }
              : undefined)}
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
