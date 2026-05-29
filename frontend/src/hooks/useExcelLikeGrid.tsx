import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { GridColumnFilterMenu } from '../components/GridColumnFilterMenu'
import { GridContextMenu, type GridContextMenuState } from '../components/GridContextMenu'
import type { GridColumnDef } from '../components/ResizableGridTable'
import type { GridColumnLayout } from './useGridColumnLayout'
import { useGridColumnFilters } from './useGridColumnFilters'
import { compareValues, useGridSort } from './useGridSort'
import { applyColumnFilters, collectUniqueFilterValues } from '../utils/gridColumnFilter'
import { exportGridToExcel } from '../utils/exportGridExcel'
import { isGridDataColumn } from '../utils/excelLikeGrid'
import { parseGridExcelFile } from '../utils/importGridExcel'

export type GridExcelExport<T> = {
  sheetName: string
  filenamePrefix: string
  getExportValue: (row: T, columnKey: string) => string | number
}

export type GridExcelImport = {
  applyParsedRows: (rows: Record<string, string>[]) => void | Promise<void>
}

type ContextMenuItem = {
  label: string
  onClick: () => void
}

export type GridRowDelete = {
  label?: string
  getSelectedCount: () => number
  onDelete: () => void
}

type Options<T> = {
  columns: GridColumnDef[]
  rows: T[]
  getFilterValue: (row: T, columnKey: string) => string
  getSortValue?: (row: T, columnKey: string) => unknown
  excelExport?: GridExcelExport<T>
  excelImport?: GridExcelImport
  excelLabel?: string
  importLabel?: string
  contextMenuItems?: ContextMenuItem[]
  /** When rows are checked, right-click shows delete instead of export/import. */
  rowDelete?: GridRowDelete
}

export function useExcelLikeGrid<T>({
  columns,
  rows,
  getFilterValue,
  getSortValue,
  excelExport,
  excelImport,
  excelLabel = 'Export',
  importLabel = 'Import',
  contextMenuItems = [],
  rowDelete,
}: Options<T>) {
  const sort = useGridSort()
  const filters = useGridColumnFilters()
  const [filterMenu, setFilterMenu] = useState<{
    key: string
    label: string
    rect: DOMRect
  } | null>(null)
  const [contextMenu, setContextMenu] = useState<GridContextMenuState>(null)
  const [contextMenuDeleteMode, setContextMenuDeleteMode] = useState(false)
  const layoutRef = useRef<GridColumnLayout | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const rowDeleteRef = useRef(rowDelete)
  rowDeleteRef.current = rowDelete
  const [importBusy, setImportBusy] = useState(false)

  const resolveSortValue = getSortValue ?? getFilterValue

  const displayRows = useMemo(() => {
    let list = applyColumnFilters(rows, filters.filters, getFilterValue)
    if (sort.sort) {
      const { key, dir } = sort.sort
      list = [...list].sort((a, b) =>
        compareValues(resolveSortValue(a, key), resolveSortValue(b, key), dir)
      )
    }
    return list
  }, [rows, filters.filters, sort.sort, getFilterValue, resolveSortValue])

  const filterOptions = useMemo(() => {
    if (!filterMenu) return []
    return collectUniqueFilterValues(rows, filterMenu.key, getFilterValue)
  }, [filterMenu, rows, getFilterValue])

  const filterColumnLabel =
    columns.find((c) => c.key === filterMenu?.key)?.label ?? filterMenu?.label ?? ''

  const runExport = useCallback(() => {
    const layout = layoutRef.current
    if (!layout || !excelExport) return
    exportGridToExcel(
      excelExport.sheetName,
      layout.orderedColumns,
      displayRows,
      excelExport.getExportValue,
      excelExport.filenamePrefix
    )
  }, [displayRows, excelExport])

  const onLayoutReady = useCallback((layout: GridColumnLayout) => {
    layoutRef.current = layout
  }, [])

  const triggerImport = useCallback(() => {
    importInputRef.current?.click()
  }, [])

  const handleImportFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file || !excelImport) return
      const layout = layoutRef.current
      const ordered = layout?.orderedColumns ?? columns
      const dataColumns = ordered.filter((col) => isGridDataColumn(col.key))
      setImportBusy(true)
      try {
        const parsed = await parseGridExcelFile(file, dataColumns)
        await excelImport.applyParsedRows(parsed)
        setContextMenu(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Import failed'
        window.alert(message)
      } finally {
        setImportBusy(false)
      }
    },
    [columns, excelImport]
  )

  const openContextMenu = useCallback(
    (event: MouseEvent) => {
      const deleteMode =
        rowDeleteRef.current != null && rowDeleteRef.current.getSelectedCount() > 0
      if (
        !deleteMode &&
        !excelExport &&
        !excelImport &&
        contextMenuItems.length === 0
      ) {
        return
      }
      event.preventDefault()
      setContextMenuDeleteMode(deleteMode)
      setContextMenu({ x: event.clientX, y: event.clientY })
    },
    [excelExport, excelImport, contextMenuItems.length]
  )

  const deleteMenuItems: ContextMenuItem[] =
    contextMenuDeleteMode && rowDelete
      ? [
          {
            label: rowDelete.label ?? 'Delete row',
            onClick: rowDelete.onDelete,
          },
        ]
      : []

  const tableProps = {
    sortMark: sort.sortMark,
    onHeaderDoubleClick: (key: string) => sort.toggleSort(key, isGridDataColumn(key)),
    isColumnSortable: isGridDataColumn,
    isColumnFilterable: isGridDataColumn,
    isColumnFilterActive: filters.isActive,
    onFilterClick: (key: string, anchor: HTMLElement) => {
      const col = columns.find((c) => c.key === key)
      setFilterMenu({
        key,
        label: col?.label ?? key,
        rect: anchor.getBoundingClientRect(),
      })
    },
  }

  const filterMenuElement: ReactNode =
    filterMenu != null ? (
      <GridColumnFilterMenu
        columnLabel={filterColumnLabel}
        options={filterOptions}
        selected={filters.getSelected(filterMenu.key, filterOptions)}
        anchorRect={filterMenu.rect}
        onApply={(selected) =>
          filters.applySelection(filterMenu.key, selected, filterOptions)
        }
        onClear={() => filters.clearColumn(filterMenu.key)}
        onClose={() => setFilterMenu(null)}
      />
    ) : null

  const contextMenuElement: ReactNode =
    excelExport != null ||
    excelImport != null ||
    contextMenuItems.length > 0 ||
    rowDelete != null ? (
      <>
        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="erp-grid-import-input"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => void handleImportFile(e)}
        />
        <GridContextMenu
          menu={contextMenu}
          excelLabel={excelLabel}
          onExcel={!contextMenuDeleteMode && excelExport ? runExport : undefined}
          importLabel={importBusy ? 'Importing…' : importLabel}
          onImport={!contextMenuDeleteMode && excelImport && !importBusy ? triggerImport : undefined}
          onClose={() => setContextMenu(null)}
          items={contextMenuDeleteMode ? deleteMenuItems : contextMenuItems}
        />
      </>
    ) : null

  return {
    displayRows,
    onLayoutReady,
    openContextMenu,
    triggerImport,
    tableProps,
    filterMenuElement,
    contextMenuElement,
  }
}
