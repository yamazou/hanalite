import { useEffect, type MouseEvent, type ReactNode } from 'react'
import { useGridColumnLayout, type GridColumnLayout } from '../hooks/useGridColumnLayout'
import type { GridColumnLayoutOptions } from '../hooks/useGridColumnLayoutOptions'
import {
  useExcelLikeGrid,
  type GridExcelExport,
  type GridExcelImport,
  type GridRowDelete,
} from '../hooks/useExcelLikeGrid'
import { ResizableGridTable, type GridColumnDef } from './ResizableGridTable'

type Props<T> = {
  gridId: string
  columns: GridColumnDef[]
  rows: T[]
  getFilterValue: (row: T, columnKey: string) => string
  getSortValue?: (row: T, columnKey: string) => unknown
  excelExport?: GridExcelExport<T>
  excelImport?: GridExcelImport
  excelLabel?: string
  importLabel?: string
  layoutOptions?: GridColumnLayoutOptions
  rowDelete?: GridRowDelete
  className?: string
  wrapClassName?: string
  onGridContextMenu?: (event: MouseEvent) => void
  onLayoutApi?: (api: Pick<GridColumnLayout, 'saveLayout' | 'isDirty'>) => void
  children: (ctx: {
    layout: GridColumnLayout
    displayRows: T[]
  }) => ReactNode
}

/** Resizable grid with Excel-like sort, column filter, and optional right-click export. */
export function ExcelLikeGridTable<T>({
  gridId,
  columns,
  rows,
  getFilterValue,
  getSortValue,
  excelExport,
  excelImport,
  excelLabel,
  importLabel,
  layoutOptions,
  rowDelete,
  className,
  wrapClassName = 'erp-grid-wrap erp-grid-wrap-detail',
  onGridContextMenu,
  onLayoutApi,
  children,
}: Props<T>) {
  const grid = useExcelLikeGrid({
    columns,
    rows,
    getFilterValue,
    getSortValue,
    excelExport,
    excelImport,
    excelLabel,
    importLabel,
    rowDelete,
  })
  const layout = useGridColumnLayout(gridId, columns, {
    ...layoutOptions,
    rowCount: layoutOptions?.rowCount ?? grid.displayRows.length,
  })

  useEffect(() => {
    grid.onLayoutReady(layout)
  }, [layout, grid.onLayoutReady])

  useEffect(() => {
    onLayoutApi?.({
      saveLayout: layout.saveLayout,
      isDirty: layout.isDirty,
    })
  }, [layout.saveLayout, layout.isDirty, onLayoutApi])

  const handleContextMenu = (event: MouseEvent) => {
    if (onGridContextMenu) {
      onGridContextMenu(event)
      return
    }
    grid.openContextMenu(event)
  }

  return (
    <>
      {grid.filterMenuElement}
      {grid.contextMenuElement}
      <div className={wrapClassName} onContextMenu={handleContextMenu}>
        <ResizableGridTable
          layout={layout}
          className={className}
          {...grid.tableProps}
        >
          {children({ layout, displayRows: grid.displayRows })}
        </ResizableGridTable>
      </div>
    </>
  )
}
