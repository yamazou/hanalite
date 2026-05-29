import type { MouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { GridColumnLayout } from '../hooks/useGridColumnLayout'

export type GridColumnDef = {
  key: string
  label: string
  defaultWidth: number
  minWidth?: number
  className?: string
}

type Props = {
  layout: GridColumnLayout
  className?: string
  children: ReactNode
  sortMark?: (columnKey: string) => string
  onHeaderDoubleClick?: (columnKey: string) => void
  isColumnSortable?: (columnKey: string) => boolean
  isColumnFilterable?: (columnKey: string) => boolean
  isColumnFilterActive?: (columnKey: string) => boolean
  onFilterClick?: (columnKey: string, anchor: HTMLElement) => void
}

export function ResizableGridTable({
  layout,
  className,
  children,
  sortMark,
  onHeaderDoubleClick,
  isColumnSortable = () => true,
  isColumnFilterable = () => true,
  isColumnFilterActive,
  onFilterClick,
}: Props) {
  const {
    orderedColumns,
    widths,
    dragIndex,
    dropIndex,
    resizeIndex,
    handleResizeStart,
    handleColumnDragStart,
  } = layout

  const tableWidth = widths.reduce((sum, width) => sum + width, 0)

  const handleHeaderDoubleClick = (colKey: string, event: MouseEvent) => {
    const target = event.target as HTMLElement
    if (target.closest('.erp-col-resizer, .erp-th-filter-btn')) return
    if (!isColumnSortable(colKey)) return
    onHeaderDoubleClick?.(colKey)
  }

  const handleHeaderPointerDown = (
    columnIndex: number,
    event: ReactPointerEvent<HTMLTableCellElement>
  ) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('.erp-col-resizer, .erp-th-filter-btn')) return
    event.preventDefault()
    handleColumnDragStart(columnIndex, event)
  }

  return (
    <table
      className={`erp-grid erp-grid-resizable erp-grid-width-from-cols ${className ?? ''}`.trim()}
      style={{ width: tableWidth, minWidth: tableWidth }}
    >
      <colgroup>
        {widths.map((width, index) => (
          <col key={orderedColumns[index].key} style={{ width: `${width}px` }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {orderedColumns.map((col, index) => {
            const filterable = isColumnFilterable(col.key)
            const filterActive = isColumnFilterActive?.(col.key) ?? false
            return (
              <th
                key={col.key}
                data-col-index={index}
                className={[
                  col.className,
                  isColumnSortable(col.key) ? 'erp-th-sortable' : '',
                  filterActive ? 'erp-th-filtered' : '',
                  !filterable ? 'erp-th-compact' : '',
                  dragIndex === index ? 'erp-th-dragging' : '',
                  dropIndex === index ? 'erp-th-drop-target' : '',
                  resizeIndex === index ? 'erp-th-resizing' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                title={
                  isColumnSortable(col.key) ? `${col.label} — double-click to sort` : col.label
                }
                onDoubleClick={(event) => handleHeaderDoubleClick(col.key, event)}
                onPointerDown={(event) => handleHeaderPointerDown(index, event)}
              >
                {filterable && (
                  <button
                    type="button"
                    className={`erp-th-filter-btn${filterActive ? ' active' : ''}`}
                    title="Filter"
                    aria-label={`Filter ${col.label}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onFilterClick?.(col.key, event.currentTarget)
                    }}
                  >
                    ▼
                  </button>
                )}
                <span className="erp-th-drag-handle" aria-hidden>
                  ⋮⋮
                </span>
                <span className="erp-th-text">
                  {col.label}
                  {sortMark?.(col.key) ?? ''}
                </span>
                {col.key !== 'rownum' && (
                  <button
                    type="button"
                    className="erp-col-resizer"
                    aria-label={`Resize ${col.label}`}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      handleResizeStart(index, event.clientX)
                    }}
                  />
                )}
              </th>
            )
          })}
        </tr>
      </thead>
      {children}
    </table>
  )
}
