import {
  useCallback,
  useEffect,
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
import { useGridColumnFilters, type GridColumnFiltersApi } from './useGridColumnFilters'
import { compareValues, useGridSort } from './useGridSort'
import { applyColumnFilters, collectUniqueFilterValues } from '../utils/gridColumnFilter'
import { exportGridToExcel } from '../utils/exportGridExcel'
import { isGridDataColumn } from '../utils/excelLikeGrid'
import { parseGridExcelFile } from '../utils/importGridExcel'
import {
  readAnchorRect,
  resolveFilterGridRoot,
  type FilterMenuPointerAtOpen,
  type GridFilterAnchorRect,
} from '../utils/gridFilterAnchor'

export type GridExcelExport<T> = {
  sheetName: string
  filenamePrefix: string
  getExportValue?: (row: T, columnKey: string) => string | number
  /** When set, runs instead of exporting visible grid columns/rows. */
  runExport?: () => void | Promise<void>
}

export type GridExcelImport = {
  applyParsedRows: (rows: Record<string, string>[]) => void | Promise<void>
  /** When set, parses the workbook instead of matching grid column headers. */
  parseFile?: (file: File) => Promise<Record<string, string>[]>
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
  /** When set, column filter pick-list values come from these rows (e.g. all orders' inputs). */
  filterOptionRows?: T[]
  /** When set, called when the filter menu opens (avoids stale pick-lists). */
  getFilterOptionRows?: () => T[]
  /** When set, overrides default unique-value collection for the filter pick-list. */
  getFilterOptions?: (columnKey: string) => string[]
  getFilterValue: (row: T, columnKey: string) => string
  /** When set with filterOptionRows, resolves values for the filter pick-list only. */
  getFilterOptionValue?: (row: T, columnKey: string) => string
  getSortValue?: (row: T, columnKey: string) => unknown
  excelExport?: GridExcelExport<T>
  excelImport?: GridExcelImport
  excelLabel?: string
  importLabel?: string
  contextMenuItems?: ContextMenuItem[]
  /** Grid-only row removal (context menu). DB changes use toolbar Update / Delete. */
  rowDelete?: GridRowDelete
  /** Share column filter state across multiple grids (e.g. Production List Input Item). */
  columnFiltersApi?: GridColumnFiltersApi
  /** Bump when async filter-option sources change (e.g. item-process cache). */
  filterOptionsRevision?: number
}

export function useExcelLikeGrid<T>({
  columns,
  rows,
  filterOptionRows,
  getFilterOptionRows,
  getFilterOptions,
  getFilterValue,
  getFilterOptionValue,
  getSortValue,
  excelExport,
  excelImport,
  excelLabel = 'Export',
  importLabel = 'Import',
  contextMenuItems = [],
  rowDelete,
  columnFiltersApi,
  filterOptionsRevision = 0,
}: Options<T>) {
  const sort = useGridSort()
  const internalFilters = useGridColumnFilters()
  const filters = columnFiltersApi ?? internalFilters
  const [filterMenu, setFilterMenu] = useState<{
    key: string
    label: string
    anchor: HTMLElement
    anchorRect: GridFilterAnchorRect
    pointerAtOpen: FilterMenuPointerAtOpen
    gridRoot: Element | null
    openNonce: number
  } | null>(null)
  const [contextMenu, setContextMenu] = useState<GridContextMenuState>(null)
  const [contextMenuDeleteMode, setContextMenuDeleteMode] = useState(false)
  const layoutRef = useRef<GridColumnLayout | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const rowDeleteRef = useRef(rowDelete)
  rowDeleteRef.current = rowDelete
  const getFilterOptionRowsRef = useRef(getFilterOptionRows)
  getFilterOptionRowsRef.current = getFilterOptionRows
  const getFilterOptionsRef = useRef(getFilterOptions)
  getFilterOptionsRef.current = getFilterOptions
  const filterOptionRowsRef = useRef(filterOptionRows)
  filterOptionRowsRef.current = filterOptionRows
  const [importBusy, setImportBusy] = useState(false)

  useEffect(() => {
    if (filterOptionsRevision === 0) return
    setFilterMenu(null)
  }, [filterOptionsRevision])

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

  const resolveFilterOptionValue = getFilterOptionValue ?? getFilterValue

  // Recompute every render while the menu is open (BOM cache can load after open).
  void filterOptionsRevision
  const filterOptions =
    filterMenu == null
      ? []
      : (() => {
          if (getFilterOptionsRef.current) {
            return getFilterOptionsRef.current(filterMenu.key)
          }
          const filterOptionSource = getFilterOptionRowsRef.current
            ? getFilterOptionRowsRef.current()
            : filterOptionRowsRef.current !== undefined
              ? filterOptionRowsRef.current
              : rows
          return collectUniqueFilterValues(
            filterOptionSource,
            filterMenu.key,
            resolveFilterOptionValue
          )
        })()

  const filterColumnLabel =
    columns.find((c) => c.key === filterMenu?.key)?.label ?? filterMenu?.label ?? ''

  const runExport = useCallback(() => {
    if (!excelExport) return
    if (excelExport.runExport) {
      void excelExport.runExport()
      return
    }
    const layout = layoutRef.current
    if (!layout || !excelExport.getExportValue) return
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
        const parsed = excelImport.parseFile
          ? await excelImport.parseFile(file)
          : await parseGridExcelFile(file, dataColumns)
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
    onFilterClick: (
      key: string,
      anchor: HTMLElement,
      anchorRect: GridFilterAnchorRect,
      pointerAtOpen: FilterMenuPointerAtOpen
    ) => {
      const col = columns.find((c) => c.key === key)
      setFilterMenu({
        key,
        label: col?.label ?? key,
        anchor,
        anchorRect,
        pointerAtOpen,
        gridRoot: resolveFilterGridRoot(anchor),
        openNonce: Date.now(),
      })
    },
  }

  const filterMenuOptionsKey =
    filterMenu != null
      ? `${filterMenu.openNonce}:${filterMenu.key}:${filterOptions.length}`
      : ''

  const filterMenuElement: ReactNode =
    filterMenu != null ? (
      <GridColumnFilterMenu
        key={filterMenuOptionsKey}
        columnLabel={filterColumnLabel}
        filterColumnKey={filterMenu.key}
        filterGridRoot={filterMenu.gridRoot}
        options={filterOptions}
        selected={filters.getSelected(filterMenu.key, filterOptions)}
        anchorEl={filterMenu.anchor}
        anchorRectAtOpen={filterMenu.anchorRect}
        pointerAtOpen={filterMenu.pointerAtOpen}
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
    columnFilters: filters.filters,
    clearColumnFilters: filters.clearAll,
    onLayoutReady,
    openContextMenu,
    triggerImport,
    tableProps,
    filterMenuElement,
    contextMenuElement,
  }
}
