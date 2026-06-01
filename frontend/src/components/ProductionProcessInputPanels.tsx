import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import type { GridColumnLayout } from '../hooks/useGridColumnLayout'
import { erpRowClass } from './erp/ErpGridPanel'
import {
  GRID_SELECT_COLUMN,
  itemProcessInputEditColumns,
  itemProcessProcessEditColumns,
  productionInputColumns,
  productionLineColumns,
} from './erp/masterGridColumns'
import { OrderTraceabilityToggle } from './OrderTraceabilityToggle'
import {
  aggregateProductionInputsFromOrders,
  aggregateTraceabilityInputRows,
  productionAggregatedInputFilterValue,
  rowsForTraceabilityFilterPicklist,
  type AggregatedProductionInputRow,
} from '../utils/productionOrderInputAggregate'
import { isBlankItemProcessInputRow, isBlankItemProcessRow } from '../utils/itemProcessEdit'
import { GridRowSelectButtons } from './GridRowSelectButtons'
import { ProcessInputSplitLayout } from './ProcessInputSplitLayout'
import { ProductionGridToolbar } from './ProductionGridToolbar'
import { ToolbarFeedback } from './ToolbarFeedback'
import { GRID_ROWNUM_COLUMN, GridRowNumCell } from './GridRowNumCell'
import { ResizableGridTable, type GridColumnDef } from './ResizableGridTable'
import { useGridColumnLayout } from '../hooks/useGridColumnLayout'
import { useExcelLikeGrid } from '../hooks/useExcelLikeGrid'
import { useGridColumnFilters } from '../hooks/useGridColumnFilters'
import { collectUniqueFilterValues, toFilterCellValue } from '../utils/gridColumnFilter'
import { isGridDataColumn } from '../utils/excelLikeGrid'
import { gridColumnLayoutOptions } from '../hooks/useGridColumnLayoutOptions'
import type { Item } from '../types'
import type { LocationMaster } from '../types/masters'
import type { ProductionOrderDetail } from '../types/production'
import { ColoredItemCode, ColoredItemName } from './ColoredItemText'
import { useItemTypColors } from '../context/ItemTypColorContext'
import { itemTextColorStyle } from '../utils/itemTypColor'
import {
  createBlankInputRowForDetail,
  createBlankProcessRowForDetail,
  ensureEditInputRowsFromItemProcess,
  emptyEditInputRow,
  emptyEditProcessRow,
  editInputText,
  inputRowsWithSingleTrailingBlank,
  isBlankInputRow,
  isActiveInputRow,
  isBlankProcessRow,
  processRowsWithSingleTrailingBlank,
  sortEditInputRowsForDisplay,
  itemCdFieldPatch,
  itemNmFieldPatch,
  processItemCdFieldPatch,
  processItemNmFieldPatch,
  processWipLocationPatch,
  processWipLocationCdFieldPatch,
  processLocationCdDisplay,
  reorderProcessRows,
  remapInputRowsAfterProcessReorder,
  actualQtyForEdit,
  consumeQtyForEdit,
  type EditInputRow,
  type EditProcessRow,
} from '../utils/productionEdit'
import { formatQty } from '../utils/format'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../utils/gridTrailingBlankRow'
import { processLinesFromDetail } from '../utils/productionProcessDisplay'
import { GridItemDatalistField, GridItemResolvedInput, type GridItemDatalistItem } from './GridItemDatalistField'
import {
  GridLocationDatalistField,
  GridLocationResolvedInput,
  showLocationMasterDatalist,
} from './GridLocationDatalistField'
import { gridCellPlaceholder, showItemMasterDatalist } from '../utils/gridPlaceholder'
import { isSameProcessTreeHighlight, type ProcessTreeHighlight } from '../utils/bomTree'
import {
  parentTreeHighlight,
  resolveProcessTreeHighlight,
} from '../utils/productionTreeHighlight'
import { buildItemProcessMasterTree } from '../utils/itemProcessTree'
import type { ItemProcessesOut } from '../types/itemprocs'
import type { ItemListRow } from '../types/masters'
import {
  buildProductionOrderTree,
  isSameProductionTreeData,
  resolveInputTreeHighlight,
  type ProductionTreeData,
} from '../utils/productionOrderTree'

function formatInputLotCell(row: EditInputRow): string {
  if (isBlankInputRow(row)) return ''
  return (row.lot ?? '').trim() || '-'
}

const GRID_COPY = {
  deleteRowBtn: 'Delete row',
  moveUpBtn: '▲',
  moveDownBtn: '▼',
  checkAllRowsTitle: 'Select all rows',
  uncheckAllRowsTitle: 'Clear selection',
  processNoLinesMsg: 'Enter a process step on the last row.',
  inputNoLinesMsg: 'Select a process step, then enter input on the last row.',
  inputSelectProcessMsg: 'Select a process step to show input lines',
  lineValidation: 'Enter at least one valid process step and input line before saving.',
  processValidation: 'Enter at least one valid process step before saving.',
  inputValidation: 'Enter at least one valid input line before saving.',
  saveProcessBtn: 'Update',
  saveInputBtn: 'Update',
  selectOption: 'Select...',
}

const PIN_EDIT_COLUMNS = ['rownum', 'select'] as const

const LINE_LAYOUT_OPTS = gridColumnLayoutOptions({
  headerFilterable: true,
  pinFirst: ['rownum'],
})
const INPUT_LAYOUT_OPTS = gridColumnLayoutOptions({
  headerFilterable: true,
  pinFirst: ['rownum'],
})
const PROCESS_EDIT_LAYOUT_OPTS = gridColumnLayoutOptions({
  headerFilterable: true,
  pinFirst: [...PIN_EDIT_COLUMNS],
})
const INPUT_EDIT_LAYOUT_OPTS = gridColumnLayoutOptions({
  headerFilterable: true,
  pinFirst: [...PIN_EDIT_COLUMNS],
})

const inputEditColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  GRID_SELECT_COLUMN,
  { key: 'item_cd', label: 'Item Code', defaultWidth: 110, headerRequired: true },
  { key: 'item_nm', label: 'Item Name', defaultWidth: 160 },
  { key: 'from_location', label: 'From Location', defaultWidth: 100 },
  { key: 'lot', label: 'Lot', defaultWidth: 100 },
  { key: 'req_qty', label: 'Plan Input Qty', defaultWidth: 96, className: 'erp-col-num', headerRequired: true },
  { key: 'consume_qty', label: 'Actual Input Qty', defaultWidth: 104, className: 'erp-col-num' },
]

function toolbarErrorMessage(rowError: string | null | undefined): string | undefined {
  if (!rowError) return undefined
  switch (rowError) {
    case 'line_validation':
      return GRID_COPY.lineValidation
    case 'process_validation':
      return GRID_COPY.processValidation
    case 'input_validation':
      return GRID_COPY.inputValidation
    default:
      return rowError
  }
}

function itemtypSortKey(itemtypNm: string | undefined): number {
  const n = (itemtypNm ?? '').trim().toLowerCase()
  if (n === 'fg') return 0
  if (n === 'wip') return 1
  if (n.includes('purchase')) return 2
  if (n === 'rm' || n === 'material') return 3
  return 99
}

type Props = {
  detail?: ProductionOrderDetail | null
  loading?: boolean
  emptyMessage?: string
  canEdit?: boolean
  /** Registered: edit plan fields (not actual qty). */
  canEditPlan?: boolean
  /** Ordered: edit actual qty fields only. */
  canEditActuals?: boolean
  items?: Item[]
  /** Full catalog for process Output Item datalist (Item Process: FG/WIP). */
  outputItemDatalistCatalog?: GridItemDatalistItem[]
  /** Full catalog for Input Item datalist (Item Process: RM/PARTS/WIP). */
  inputItemDatalistCatalog?: GridItemDatalistItem[]
  /** @deprecated Use outputItemDatalistCatalog / inputItemDatalistCatalog */
  itemDatalistCatalog?: GridItemDatalistItem[]
  locations?: LocationMaster[]
  processRows?: EditProcessRow[]
  inputRows?: EditInputRow[]
  onProcessRowsChange?: (rows: EditProcessRow[]) => void
  onInputRowsChange?: (rows: EditInputRow[]) => void
  /** Shown on both grids when set (e.g. Production Entry). */
  rowError?: string | null
  processRowError?: string | null
  inputRowError?: string | null
  processStatusMessage?: string | null
  inputStatusMessage?: string | null
  onSaveProcess?: () => void
  onSaveInput?: () => void
  savingProcess?: boolean
  savingInput?: boolean
  onReloadFromItemProcesses?: () => void
  reloadingFromItemProcesses?: boolean
  reloadItemProcessesError?: string | null
  /** Bumped after Reload Master so auto-fill from item process does not duplicate rows. */
  reloadFromMasterNonce?: number
  lineGridId?: string
  inputGridId?: string
  processEditGridId?: string
  inputEditGridId?: string
  onGridLayoutsReady?: (api: {
    saveLayouts: () => void
    isDirty: boolean
  }) => void
  onTreeHighlightChange?: (highlight: ProcessTreeHighlight | null) => void
  onTreeDataChange?: (data: ProductionTreeData) => void
  /** When false, no process row is selected on load (Production Entry). */
  autoSelectFirstProcess?: boolean
  /** Which process step to select when rows load; overrides autoSelectFirstProcess when set. */
  autoSelectProcess?: 'first' | 'last' | false
  /** Render process/input sections only (no outer panel wrapper). */
  embedded?: boolean
  /** Item Processes master: process grid shows location only. */
  processColumnsMode?: 'default' | 'location-only'
  /** Production Entry: hide Actual Input Qty on Input Item grid. */
  hideInputActualQty?: boolean
  /** Production Entry: hide From Location on Input Item grid. */
  hideInputFromLocation?: boolean
  /** Saved subprocess definitions for WIP expansion in production tree. */
  itemProcessCache?: Map<number, ItemProcessesOut>
  itemtyps?: ItemTyp[]
  /** Resizable Process / Input Item boundary (height ratio of Process pane). */
  processInputSplit?: {
    processHeightRatio: number
    onProcessHeightRatioChange: (ratio: number) => void
  }
  /** Production List: when true, Input Item filters and narrows header grid by material. */
  orderTraceabilityEnabled?: boolean
  onOrderTraceabilityChange?: (value: boolean) => void
  /** Header-displayed orders (with details) for traceability Input grid and filter pick-list. */
  allOrdersForInput?: ProductionOrderDetail[]
  /** All list-visible orders (for matching Input filters → header grid). */
  allOrdersForHeaderFilter?: ProductionOrderDetail[]
  onInputColumnFiltersChange?: (filters: Record<string, Set<string>>) => void
  /** Production List: loading all visible order details for the all-orders Input view. */
  loadingAllOrderInputs?: boolean
  /** Bumped when Production List Reset clears detail-panel grid filters. */
  panelResetNonce?: number
}

function filterInputGridColumns(
  columns: GridColumnDef[],
  options: { hideActualQty?: boolean; hideFromLocation?: boolean }
): GridColumnDef[] {
  return columns.filter((col) => {
    if (options.hideActualQty && col.key === 'consume_qty') return false
    if (options.hideFromLocation && col.key === 'from_location') return false
    return true
  })
}

export function ProductionProcessInputPanels({
  detail,
  loading = false,
  emptyMessage = 'No order data.',
  canEdit = false,
  canEditPlan: canEditPlanProp,
  canEditActuals: canEditActualsProp,
  items = [],
  outputItemDatalistCatalog,
  inputItemDatalistCatalog,
  itemDatalistCatalog,
  locations = [],
  processRows = [],
  inputRows = [],
  onProcessRowsChange,
  onInputRowsChange,
  rowError,
  processRowError,
  inputRowError,
  processStatusMessage,
  inputStatusMessage,
  onSaveProcess,
  onSaveInput,
  savingProcess = false,
  savingInput = false,
  onReloadFromItemProcesses,
  reloadingFromItemProcesses = false,
  reloadItemProcessesError = null,
  reloadFromMasterNonce = 0,
  lineGridId = 'production-process-lines-v6',
  inputGridId = 'production-process-inputs-v4',
  processEditGridId = 'production-process-edit-v5',
  inputEditGridId = 'production-input-edit-v3',
  onGridLayoutsReady,
  onTreeHighlightChange,
  onTreeDataChange,
  autoSelectFirstProcess = true,
  autoSelectProcess: autoSelectProcessProp,
  embedded = false,
  processColumnsMode = 'default',
  hideInputActualQty = false,
  hideInputFromLocation = false,
  itemProcessCache,
  itemtyps = [],
  processInputSplit,
  orderTraceabilityEnabled = false,
  onOrderTraceabilityChange,
  allOrdersForInput = [],
  allOrdersForHeaderFilter = [],
  onInputColumnFiltersChange,
  loadingAllOrderInputs = false,
  panelResetNonce = 0,
}: Props) {
  const isProductionListInputScope = onOrderTraceabilityChange != null

  const showAllOrdersInputs = isProductionListInputScope && orderTraceabilityEnabled

  const sharedInputColumnFilters = useGridColumnFilters()
  const defaultItemCatalog = useMemo(
    () =>
      items.map((item) => ({
        item_id: item.item_id,
        item_cd: item.item_cd,
        item_nm: item.item_nm,
      })),
    [items]
  )

  const processOutputItemCatalog = useMemo(
    () =>
      outputItemDatalistCatalog ??
      itemDatalistCatalog ??
      defaultItemCatalog,
    [outputItemDatalistCatalog, itemDatalistCatalog, defaultItemCatalog]
  )

  const inputItemCatalog = useMemo(
    () =>
      inputItemDatalistCatalog ??
      itemDatalistCatalog ??
      defaultItemCatalog,
    [inputItemDatalistCatalog, itemDatalistCatalog, defaultItemCatalog]
  )

  const isProcessRowBlank =
    processColumnsMode === 'location-only' ? isBlankItemProcessRow : isBlankProcessRow
  const isInputRowBlank =
    processColumnsMode === 'location-only' ? isBlankItemProcessInputRow : isBlankInputRow
  const showSectionSaveButtons =
    processColumnsMode !== 'location-only' && Boolean(onSaveProcess || onSaveInput)
  const { colorForItem } = useItemTypColors()
  const orderStatus = detail?.status
  const canEditPlan =
    canEditPlanProp !== undefined
      ? canEditPlanProp
      : Boolean(canEdit && orderStatus === 'registered')
  const canEditActuals =
    canEditActualsProp !== undefined
      ? canEditActualsProp
      : Boolean(canEdit && orderStatus === 'approved')
  const baseProcessEditColumns = itemProcessProcessEditColumns
  const editProcessColumns = useMemo(
    () =>
      canEditPlan ? baseProcessEditColumns : baseProcessEditColumns.filter((c) => c.key !== 'select'),
    [canEditPlan, baseProcessEditColumns]
  )
  const baseInputEditColumns =
    processColumnsMode === 'location-only' ? itemProcessInputEditColumns : inputEditColumns
  const inputColumnFilter = useMemo(
    () => ({ hideActualQty: hideInputActualQty, hideFromLocation: hideInputFromLocation }),
    [hideInputActualQty, hideInputFromLocation]
  )
  const editInputColumnsActive = useMemo(() => {
    const cols = canEditPlan
      ? baseInputEditColumns
      : baseInputEditColumns.filter((c) => c.key !== 'select')
    return filterInputGridColumns(cols, inputColumnFilter)
  }, [canEditPlan, baseInputEditColumns, inputColumnFilter])
  const inputReadColumns = useMemo(
    () => filterInputGridColumns(productionInputColumns, inputColumnFilter),
    [inputColumnFilter]
  )
  const autoSelectProcess: 'first' | 'last' | false =
    autoSelectProcessProp ?? (autoSelectFirstProcess ? 'first' : false)
  const [selectedProcessKey, setSelectedProcessKey] = useState<string | null>(null)
  const [treeProcessHighlightKey, setTreeProcessHighlightKey] = useState<string | null>(null)
  const [selectedProcessKeys, setSelectedProcessKeys] = useState<Set<string>>(() => new Set())
  const [selectedInputKey, setSelectedInputKey] = useState<string | null>(null)
  const [parentItemProcesses, setParentItemProcesses] = useState<ItemProcessesOut | null>(null)
  const [selectedInputKeys, setSelectedInputKeys] = useState<Set<string>>(() => new Set())
  const pinnedProcessLineNoRef = useRef<number | null>(null)
  const skipInputNormalizeRef = useRef(0)
  const skipEnsureInputFromMasterRef = useRef(false)
  const inputRowsRef = useRef(inputRows)
  const processRowsRef = useRef(processRows)
  const lastTreeDataRef = useRef<ProductionTreeData | null>(null)
  const lastTreeHighlightRef = useRef<ProcessTreeHighlight | null>(null)
  inputRowsRef.current = inputRows
  processRowsRef.current = processRows

  const processLocations = useMemo(
    () => locations.filter((loc) => loc.location_type === 'Process'),
    [locations]
  )
  const rmLocations = useMemo(
    () => locations.filter((loc) => loc.location_type === 'RM'),
    [locations]
  )

  useEffect(() => {
    setSelectedProcessKey(null)
    setTreeProcessHighlightKey(null)
    setSelectedProcessKeys(new Set())
    setSelectedInputKey(null)
    setSelectedInputKeys(new Set())
    pinnedProcessLineNoRef.current = null
    lastTreeDataRef.current = null
    lastTreeHighlightRef.current = null
  }, [detail?.production_order_id, detail?.parent_item_id])

  useEffect(() => {
    setSelectedInputKey(null)
    setSelectedInputKeys(new Set())
  }, [selectedProcessKey])

  const useEditProcessRows = canEditPlan || canEditActuals

  const activateProcessRow = (key: string) => {
    const row = processRowsRef.current.find((r) => r.key === key)
    if (!row || isProcessRowBlank(row)) return
    pinnedProcessLineNoRef.current = row.line_no
    setSelectedProcessKey(key)
    setTreeProcessHighlightKey(key)
    setSelectedInputKey(null)
    setSelectedInputKeys(new Set())
  }

  const activateInputRow = (key: string) => {
    setSelectedInputKey(key)
  }

  const toggleInputRowRead = (key: string) => {
    setSelectedInputKey((prev) => (prev === key ? null : key))
  }

  const toggleProcessRowRead = (key: string) => {
    setSelectedProcessKey((prev) => {
      if (prev === key) {
        setTreeProcessHighlightKey(null)
        return null
      }
      setTreeProcessHighlightKey(key)
      return key
    })
  }

  useEffect(() => {
    if (!onTreeDataChange || !detail) return
    const data =
      processColumnsMode === 'location-only' && itemProcessCache
        ? buildItemProcessMasterTree({
            detail,
            processRows,
            inputRows,
            locations,
            items: items as ItemListRow[],
            itemProcessCache,
          })
        : buildProductionOrderTree({
            detail,
            processRows,
            inputRows,
            locations,
            items,
            itemtyps,
            itemProcessCache,
            useEditRows: useEditProcessRows,
          })
    const prev = lastTreeDataRef.current
    if (
      prev &&
      isSameProductionTreeData(data, prev.title, prev.lines)
    ) {
      return
    }
    lastTreeDataRef.current = data
    onTreeDataChange(data)
  }, [
    onTreeDataChange,
    detail?.production_order_id,
    detail?.parent_item_id,
    detail?.parent_item_cd,
    detail?.parent_item_nm,
    detail?.status,
    processRows,
    inputRows,
    locations,
    items,
    useEditProcessRows,
    processColumnsMode,
    itemProcessCache,
    itemtyps,
  ])

  useEffect(() => {
    if (!onTreeHighlightChange || !detail) return
    const inputHighlight = resolveInputTreeHighlight(
      inputRows,
      selectedInputKey,
      detail,
      processRows,
      locations
    )
    const nextHighlight =
      inputHighlight ??
      (treeProcessHighlightKey == null
        ? parentTreeHighlight(detail.parent_item_id)
        : resolveProcessTreeHighlight(
            detail,
            treeProcessHighlightKey,
            processRows,
            locations,
            useEditProcessRows
          ))
    if (isSameProcessTreeHighlight(lastTreeHighlightRef.current, nextHighlight)) return
    lastTreeHighlightRef.current = nextHighlight
    onTreeHighlightChange(nextHighlight)
  }, [
    detail?.production_order_id,
    detail?.parent_item_id,
    treeProcessHighlightKey,
    selectedInputKey,
    inputRows,
    processRows,
    locations,
    useEditProcessRows,
    onTreeHighlightChange,
  ])

  useEffect(() => {
    if (!autoSelectProcess || loading || !detail) return

    if (!useEditProcessRows) {
      const groups = processLinesFromDetail(detail)
      if (groups.length === 0) return
      const targetProcess =
        autoSelectProcess === 'last' ? groups[groups.length - 1] : groups[0]
      const keepCurrent =
        selectedProcessKey != null &&
        groups.some((group) => group.key === selectedProcessKey)
      if (keepCurrent) return
      pinnedProcessLineNoRef.current = targetProcess.lineNos[0] ?? null
      setTreeProcessHighlightKey(targetProcess.key)
      setSelectedProcessKey(targetProcess.key)
      setSelectedInputKey(null)
      setSelectedInputKeys(new Set())
      return
    }

    if (!canEdit || processRows.length === 0) return
    const activeRows = processRows
      .filter((row) => !isProcessRowBlank(row))
      .sort((a, b) => a.line_no - b.line_no)
    const targetProcess =
      autoSelectProcess === 'last'
        ? activeRows[activeRows.length - 1]
        : activeRows[0]
    if (!targetProcess) return
    const keepCurrent =
      selectedProcessKey != null &&
      processRows.some(
        (row) => row.key === selectedProcessKey && !isProcessRowBlank(row)
      )
    if (keepCurrent) return
    pinnedProcessLineNoRef.current = targetProcess.line_no
    setTreeProcessHighlightKey(targetProcess.key)
    setSelectedProcessKey(targetProcess.key)
    setSelectedInputKey(null)
    setSelectedInputKeys(new Set())
  }, [
    autoSelectProcess,
    canEdit,
    loading,
    detail?.production_order_id,
    detail?.status,
    useEditProcessRows,
    processRows,
    selectedProcessKey,
    isProcessRowBlank,
  ])

  useEffect(() => {
    if (!canEdit) return
    const rows = processRowsRef.current
    const valid = new Set(rows.map((row) => row.key))
    setSelectedProcessKeys((prev) => {
      const next = new Set([...prev].filter((key) => valid.has(key)))
      return next.size === prev.size ? prev : next
    })
    if (selectedProcessKey && !valid.has(selectedProcessKey)) {
      const pinnedLine = pinnedProcessLineNoRef.current
      const fallback =
        pinnedLine != null
          ? rows.find((row) => row.line_no === pinnedLine && !isProcessRowBlank(row))
          : undefined
      if (fallback) {
        setSelectedProcessKey(fallback.key)
        setTreeProcessHighlightKey(fallback.key)
      } else {
        setSelectedProcessKey(null)
        setTreeProcessHighlightKey(null)
      }
    }
  }, [canEdit, processRows, selectedProcessKey])

  useEffect(() => {
    if (!canEdit) return
    const valid = new Set(inputRows.map((row) => row.key))
    setSelectedInputKeys((prev) => {
      const next = new Set([...prev].filter((key) => valid.has(key)))
      return next.size === prev.size ? prev : next
    })
  }, [canEdit, inputRows])

  const processGroups = useMemo(
    () => (detail ? processLinesFromDetail(detail) : []),
    [detail]
  )

  const selectedProcessLineNo = useMemo(() => {
    if (useEditProcessRows && selectedProcessKey != null) {
      const row = processRows.find((r) => r.key === selectedProcessKey)
      if (row && !isProcessRowBlank(row)) {
        pinnedProcessLineNoRef.current = row.line_no
        return row.line_no
      }
    }
    if (pinnedProcessLineNoRef.current != null) {
      const pinnedRow = processRows.find(
        (row) => row.line_no === pinnedProcessLineNoRef.current && !isProcessRowBlank(row)
      )
      if (pinnedRow) {
        return pinnedProcessLineNoRef.current
      }
    }
    return null
  }, [useEditProcessRows, processRows, selectedProcessKey])

  const visibleEditInputs = useMemo(() => {
    if (showAllOrdersInputs || selectedProcessLineNo == null) return []
    return sortEditInputRowsForDisplay(
      inputRows.filter((row) => row.line_no === selectedProcessLineNo),
      isInputRowBlank
    )
  }, [showAllOrdersInputs, inputRows, selectedProcessLineNo, isInputRowBlank])

  const visibleInputs = useMemo(() => {
    if (showAllOrdersInputs) return []
    if (!detail) return []
    if (selectedProcessKey == null) return []
    const group = processGroups.find((g) => g.key === selectedProcessKey)
    if (!group) return []
    const lineNos = new Set(group.lineNos)
    return detail.inputs
      .filter((ln) => lineNos.has(ln.line_no))
      .sort(
        (a, b) =>
          (a.level ?? 0) - (b.level ?? 0) ||
          itemtypSortKey(a.itemtyp_nm) - itemtypSortKey(b.itemtyp_nm) ||
          a.line_no - b.line_no
      )
  }, [showAllOrdersInputs, detail, selectedProcessKey, processGroups])

  /** Traceability grid rows (saved inputs + edit grid for selected order). */
  const fullAggregatedInputRows = useMemo(() => {
    const orders = showAllOrdersInputs ? allOrdersForInput : allOrdersForHeaderFilter
    if (orders.length === 0) return []
    if (showAllOrdersInputs) {
      return aggregateTraceabilityInputRows({
        orders,
        selectedOrderId: detail?.production_order_id ?? null,
        liveInputRows:
          detail && (canEditPlan || canEditActuals) ? inputRows : undefined,
        locations,
      })
    }
    return aggregateProductionInputsFromOrders({
      orders,
      selectedOrderId: detail?.production_order_id ?? null,
      liveInputRows:
        detail && (canEditPlan || canEditActuals) ? inputRows : undefined,
      locations,
    })
  }, [
    showAllOrdersInputs,
    allOrdersForInput,
    allOrdersForHeaderFilter,
    detail,
    canEditPlan,
    canEditActuals,
    inputRows,
    locations,
  ])

  const makeBlankProcessRow = (existing: EditProcessRow[]) =>
    createBlankProcessRowForDetail(existing)

  const appendBlankProcessRow = (existing: EditProcessRow[]) => {
    if (!detail) return existing
    return processRowsWithSingleTrailingBlank(existing, makeBlankProcessRow)
  }

  const makeBlankInputRow = (_existing: EditInputRow[]) =>
    createBlankInputRowForDetail([], selectedProcessLineNo ?? 1)

  const updateProcessRow = (key: string, patch: Partial<EditProcessRow>) => {
    if (!onProcessRowsChange) return
    const next = updateRowWithTrailingBlank(
      processRows,
      key,
      patch,
      isProcessRowBlank,
      (rows) => (detail ? makeBlankProcessRow(rows) : emptyEditProcessRow(rows.length + 1))
    )
    onProcessRowsChange(next)
    const touched = next.find((row) => row.key === key)
    if (touched && !isProcessRowBlank(touched)) {
      pinnedProcessLineNoRef.current = touched.line_no
      setSelectedProcessKey(touched.key)
      setTreeProcessHighlightKey(touched.key)
    }
  }

  const ensureProcessSelectedForLine = (lineNo: number) => {
    if (selectedProcessKey != null) {
      const current = processRowsRef.current.find((row) => row.key === selectedProcessKey)
      if (current && !isProcessRowBlank(current) && current.line_no === lineNo) return
    }
    const procRow = processRowsRef.current.find(
      (row) => row.line_no === lineNo && !isProcessRowBlank(row)
    )
    if (!procRow) return
    pinnedProcessLineNoRef.current = lineNo
    setSelectedProcessKey(procRow.key)
    setTreeProcessHighlightKey(procRow.key)
  }

  const updateInputRow = (key: string, patch: Partial<EditInputRow>) => {
    if (!onInputRowsChange) return
    const sourceRow = inputRowsRef.current.find((row) => row.key === key)
    const lineNo = sourceRow?.line_no ?? selectedProcessLineNo ?? pinnedProcessLineNoRef.current ?? 1
    if (lineNo != null) {
      pinnedProcessLineNoRef.current = lineNo
      ensureProcessSelectedForLine(lineNo)
    }
    onInputRowsChange(
      updateRowWithTrailingBlank(
        inputRowsRef.current,
        key,
        patch,
        isInputRowBlank,
        (rows) =>
          detail && lineNo != null
            ? createBlankInputRowForDetail(rows, lineNo)
            : emptyEditInputRow(lineNo ?? 1)
      )
    )
  }

  const removeProcessRows = (keys: string[]) => {
    if (!onProcessRowsChange || !onInputRowsChange || keys.length === 0) return
    const drop = new Set(keys)
    const deletedRows = processRows.filter((row) => drop.has(row.key))
    const removedLineNos = new Set(deletedRows.map((row) => row.line_no))
    const remaining = processRows.filter((row) => !drop.has(row.key))
    const renumbered = remaining.map((row, index) => ({ ...row, line_no: index + 1 }))
    // Do not re-append a trailing blank on explicit delete; use Add row or edit last row instead.
    const nextProcess =
      renumbered.length === 0 ? appendBlankProcessRow([]) : renumbered
    onProcessRowsChange(nextProcess)
    onInputRowsChange(
      remapInputRowsAfterProcessReorder(
        inputRows.filter((row) => !removedLineNos.has(row.line_no)),
        processRows,
        nextProcess,
        isProcessRowBlank
      )
    )
    if (selectedProcessKey && drop.has(selectedProcessKey)) {
      setSelectedProcessKey(nextProcess[0]?.key ?? null)
    }
    setSelectedProcessKeys(new Set())
  }

  const orderedProcessDataRows = useMemo(
    () =>
      processRows
        .filter((row) => !isProcessRowBlank(row))
        .sort((a, b) => a.line_no - b.line_no),
    [processRows, isProcessRowBlank]
  )

  const moveProcessRow = (key: string, direction: 'up' | 'down') => {
    if (!onProcessRowsChange || !onInputRowsChange || !canEditPlan) return
    const row = processRows.find((entry) => entry.key === key)
    if (!row || isProcessRowBlank(row) || row.status === 'completed') return
    const result = reorderProcessRows(
      processRows,
      key,
      direction,
      isProcessRowBlank,
      makeBlankProcessRow
    )
    if (!result) return
    skipInputNormalizeRef.current = 1
    const nextProcessRows = result.processRows
    onInputRowsChange(
      remapInputRowsAfterProcessReorder(
        inputRows,
        processRows,
        nextProcessRows,
        isProcessRowBlank
      )
    )
    onProcessRowsChange(nextProcessRows)
    const moved = nextProcessRows.find((entry) => entry.key === key)
    if (moved && !isProcessRowBlank(moved)) {
      pinnedProcessLineNoRef.current = moved.line_no
    }
    setSelectedProcessKey(key)
    setTreeProcessHighlightKey(key)
  }

  const removeInputRows = (keys: string[]) => {
    if (!onInputRowsChange || keys.length === 0) return
    const drop = new Set(keys)
    const remaining = inputRows.filter((row) => !drop.has(row.key))
    const affectedLineNos = new Set(
      inputRows.filter((row) => drop.has(row.key)).map((row) => row.line_no)
    )
    let next = remaining
    for (const lineNo of affectedLineNos) {
      const forLine = next.filter((row) => row.line_no === lineNo)
      const other = next.filter((row) => row.line_no !== lineNo)
      if (forLine.length === 0) {
        next = [...other, emptyEditInputRow(lineNo)]
        continue
      }
      next = [
        ...other,
        ...inputRowsWithSingleTrailingBlank(forLine, () => emptyEditInputRow(lineNo), isInputRowBlank),
      ]
    }
    onInputRowsChange(next)
    setSelectedInputKeys(new Set())
  }

  useEffect(() => {
    const itemId = detail?.parent_item_id
    if (!itemId || processColumnsMode === 'location-only' || !canEditPlan) {
      setParentItemProcesses(null)
      return
    }
    const cached = itemProcessCache?.get(itemId)
    if (cached) {
      setParentItemProcesses(cached)
      return
    }
    let cancelled = false
    void api.getItemProcesses(itemId).then(
      (data) => {
        if (!cancelled) setParentItemProcesses(data)
      },
      () => {
        if (!cancelled) setParentItemProcesses(null)
      }
    )
    return () => {
      cancelled = true
    }
  }, [detail?.parent_item_id, processColumnsMode, canEditPlan, itemProcessCache])

  useEffect(() => {
    if (!reloadFromMasterNonce) return
    skipEnsureInputFromMasterRef.current = true
  }, [reloadFromMasterNonce])

  useEffect(() => {
    if (skipEnsureInputFromMasterRef.current) {
      skipEnsureInputFromMasterRef.current = false
      return
    }
    if (!canEditPlan || !detail || !onInputRowsChange || !parentItemProcesses) return
    const processLineNos = processRowsRef.current
      .filter((row) => !isProcessRowBlank(row))
      .map((row) => row.line_no)
    if (processLineNos.length === 0) return
    const merged = ensureEditInputRowsFromItemProcess(
      inputRowsRef.current,
      processLineNos,
      parentItemProcesses,
      detail.status,
      detail.planned_qty
    )
    if (merged === inputRowsRef.current) return
    onInputRowsChange(merged)
  }, [
    canEditPlan,
    detail?.production_order_id,
    detail?.status,
    detail?.planned_qty,
    parentItemProcesses,
    onInputRowsChange,
    processRows,
    isProcessRowBlank,
  ])

  /** When the selected process changes, ensure one trailing blank input row (Item Process + Production). */
  useEffect(() => {
    if (skipInputNormalizeRef.current > 0) {
      skipInputNormalizeRef.current -= 1
      return
    }
    if (!useEditProcessRows || !detail || !onInputRowsChange || selectedProcessLineNo == null) return
    const currentInputRows = inputRowsRef.current
    const forProcess = currentInputRows.filter((row) => row.line_no === selectedProcessLineNo)
    const other = currentInputRows.filter((row) => row.line_no !== selectedProcessLineNo)

    if (forProcess.length === 0) {
      onInputRowsChange([...other, emptyEditInputRow(selectedProcessLineNo)])
      return
    }

    const normalized = inputRowsWithSingleTrailingBlank(
      forProcess,
      () => emptyEditInputRow(selectedProcessLineNo),
      isInputRowBlank
    )
    const unchanged =
      normalized.length === forProcess.length &&
      normalized.every((row, index) => row.key === forProcess[index]?.key)
    if (unchanged) return

    onInputRowsChange([...other, ...normalized])
  }, [useEditProcessRows, detail?.parent_item_id, selectedProcessLineNo, onInputRowsChange])

  const datalistScope = processEditGridId

  const orderIdSuffix =
    detail?.production_order_id != null ? `order_${detail.production_order_id}` : 'production'

  const processEditFilterValue = (row: EditProcessRow, col: string) => {
    switch (col) {
      case 'process':
        return toFilterCellValue(processLocationCdDisplay(row, processLocations))
      case 'process_nm': {
        const loc = locations.find((l) => l.location_id === row.wip_location_id)
        return toFilterCellValue(loc?.location_nm ?? null)
      }
      case 'output_item_cd':
        return toFilterCellValue(row.output_item_cd)
      case 'output_item_nm':
        return toFilterCellValue(row.output_item_nm)
      case 'planned_qty':
        return toFilterCellValue(row.planned_qty)
      case 'actual_qty':
        return toFilterCellValue(row.actual_qty)
      case 'status':
        return toFilterCellValue(row.status)
      default:
        return toFilterCellValue('')
    }
  }

  const inputEditFilterValue = (row: EditInputRow, col: string) => {
    switch (col) {
      case 'item_cd':
        return toFilterCellValue(row.item_cd)
      case 'item_nm':
        return toFilterCellValue(row.item_nm)
      case 'from_location': {
        const loc = locations.find((l) => l.location_id === row.from_location_id)
        return toFilterCellValue(loc?.location_cd ?? null)
      }
      case 'lot':
        return toFilterCellValue(row.lot)
      case 'req_qty':
        return toFilterCellValue(row.req_qty)
      case 'consume_qty':
        return toFilterCellValue(row.consume_qty)
      default:
        return toFilterCellValue('')
    }
  }

  const processReadFilterValue = (row: ReturnType<typeof processLinesFromDetail>[number], col: string) => {
    switch (col) {
      case 'process':
        return toFilterCellValue(row.processCd)
      case 'process_nm':
        return toFilterCellValue(row.processNm)
      case 'output_item_cd':
        return toFilterCellValue(row.outputItemCd)
      case 'output_item_nm':
        return toFilterCellValue(row.outputItemNm)
      case 'planned_qty':
        return toFilterCellValue(row.plannedQty)
      case 'actual_qty':
        return toFilterCellValue(row.actualQty)
      case 'status':
        return toFilterCellValue(row.status)
      default:
        return toFilterCellValue('')
    }
  }

  function isAggregatedInputRow(
    row: NonNullable<ProductionOrderDetail['inputs']>[number] | AggregatedProductionInputRow
  ): row is AggregatedProductionInputRow {
    return 'production_order_id' in row
  }

  const inputReadFilterValue = (
    row: NonNullable<ProductionOrderDetail['inputs']>[number] | AggregatedProductionInputRow,
    col: string
  ) => {
    if (isAggregatedInputRow(row)) {
      return productionAggregatedInputFilterValue(row, col)
    }
    switch (col) {
      case 'item_cd':
        return toFilterCellValue(row.item_cd)
      case 'item_nm':
        return toFilterCellValue(row.item_nm)
      case 'from_location':
        return toFilterCellValue(row.from_location_cd)
      case 'req_qty':
        return toFilterCellValue(row.req_qty)
      case 'consume_qty':
        return toFilterCellValue(row.consume_qty)
      case 'lot':
        return toFilterCellValue((row.lot ?? '').trim() || null)
      default:
        return toFilterCellValue('')
    }
  }

  const processEditExcel = useExcelLikeGrid({
    columns: editProcessColumns,
    rows: processRows,
    getFilterValue: processEditFilterValue,
    rowDelete: canEditPlan
      ? {
          label: GRID_COPY.deleteRowBtn,
          getSelectedCount: () => selectedProcessKeys.size,
          onDelete: () => removeProcessRows([...selectedProcessKeys]),
        }
      : undefined,
    excelExport: {
      sheetName: 'Process',
      filenamePrefix: `${orderIdSuffix}_process_edit`,
      getExportValue: processEditFilterValue,
    },
  })

  const inputColumnFiltersEnabled = onInputColumnFiltersChange != null

  const traceabilityGridRowsRef = useRef(fullAggregatedInputRows)
  traceabilityGridRowsRef.current = fullAggregatedInputRows

  const getTraceabilityFilterOptions = useCallback(
    (columnKey: string) =>
      collectUniqueFilterValues(
        rowsForTraceabilityFilterPicklist({
          gridRows: traceabilityGridRowsRef.current,
        }),
        columnKey,
        productionAggregatedInputFilterValue
      ),
    []
  )

  const getAggregatedInputFilterOptionValue = useCallback(
    (row: AggregatedProductionInputRow, col: string) =>
      productionAggregatedInputFilterValue(row, col),
    []
  )

  const inputEditExcel = useExcelLikeGrid({
    columns: editInputColumnsActive,
    rows: visibleEditInputs,
    getFilterOptions: inputColumnFiltersEnabled ? getTraceabilityFilterOptions : undefined,
    getFilterValue: inputEditFilterValue,
    getFilterOptionValue: inputColumnFiltersEnabled
      ? getAggregatedInputFilterOptionValue
      : undefined,
    columnFiltersApi: onInputColumnFiltersChange ? sharedInputColumnFilters : undefined,
    rowDelete: canEditPlan
      ? {
          label: GRID_COPY.deleteRowBtn,
          getSelectedCount: () => selectedInputKeys.size,
          onDelete: () => removeInputRows([...selectedInputKeys]),
        }
      : undefined,
    excelExport: {
      sheetName: 'Input Item',
      filenamePrefix: `${orderIdSuffix}_input_edit`,
      getExportValue: inputEditFilterValue,
    },
  })

  const inputEditDisplayRows = useMemo(
    () => sortEditInputRowsForDisplay(inputEditExcel.displayRows, isInputRowBlank),
    [inputEditExcel.displayRows, isInputRowBlank]
  )

  const processReadExcel = useExcelLikeGrid({
    columns: productionLineColumns,
    rows: processGroups,
    getFilterValue: processReadFilterValue,
    excelExport: {
      sheetName: 'Process',
      filenamePrefix: `${orderIdSuffix}_process`,
      getExportValue: processReadFilterValue,
    },
  })

  const inputReadUsesAggregatedRows = showAllOrdersInputs

  const inputGridColumns = inputReadColumns

  const inputReadExcel = useExcelLikeGrid({
    columns: inputGridColumns,
    rows: inputReadUsesAggregatedRows ? fullAggregatedInputRows : visibleInputs,
    getFilterOptions: inputColumnFiltersEnabled ? getTraceabilityFilterOptions : undefined,
    getFilterValue: inputReadFilterValue,
    getFilterOptionValue: inputColumnFiltersEnabled
      ? getAggregatedInputFilterOptionValue
      : undefined,
    columnFiltersApi: onInputColumnFiltersChange ? sharedInputColumnFilters : undefined,
    excelExport: {
      sheetName: 'Input Item',
      filenamePrefix: `${orderIdSuffix}_input`,
      getExportValue: inputReadFilterValue,
    },
  })

  const lineLayout = useGridColumnLayout(lineGridId, productionLineColumns, {
    ...LINE_LAYOUT_OPTS,
    rowCount: processReadExcel.displayRows.length,
  })
  const showExpandedInputView = inputReadUsesAggregatedRows

  useEffect(() => {
    if (!isProductionListInputScope) return
    if (!orderTraceabilityEnabled) {
      sharedInputColumnFilters.clearAll()
    }
  }, [orderTraceabilityEnabled, isProductionListInputScope])

  useEffect(() => {
    if (!onInputColumnFiltersChange) return
    onInputColumnFiltersChange(sharedInputColumnFilters.filters)
  }, [onInputColumnFiltersChange, sharedInputColumnFilters.filters])

  useEffect(() => {
    if (!panelResetNonce) return
    sharedInputColumnFilters.clearAll()
    processEditExcel.clearColumnFilters()
    processReadExcel.clearColumnFilters()
    inputReadExcel.clearColumnFilters()
    inputEditExcel.clearColumnFilters()
  }, [
    panelResetNonce,
    sharedInputColumnFilters.clearAll,
    processEditExcel.clearColumnFilters,
    processReadExcel.clearColumnFilters,
    inputReadExcel.clearColumnFilters,
    inputEditExcel.clearColumnFilters,
  ])

  const inputReadTableProps = useMemo(
    () => ({
      ...inputReadExcel.tableProps,
      isColumnFilterable: (key: string) =>
        inputColumnFiltersEnabled && isGridDataColumn(key),
      onFilterClick: inputColumnFiltersEnabled
        ? inputReadExcel.tableProps.onFilterClick
        : undefined,
    }),
    [inputReadExcel.tableProps, inputColumnFiltersEnabled]
  )

  const inputEditTableProps = useMemo(
    () => ({
      ...inputEditExcel.tableProps,
      isColumnFilterable: (key: string) =>
        inputColumnFiltersEnabled && isGridDataColumn(key),
      onFilterClick: inputColumnFiltersEnabled
        ? inputEditExcel.tableProps.onFilterClick
        : undefined,
    }),
    [inputEditExcel.tableProps, inputColumnFiltersEnabled]
  )

  const inputLayout = useGridColumnLayout(inputGridId, inputGridColumns, {
    ...INPUT_LAYOUT_OPTS,
    rowCount: inputReadExcel.displayRows.length,
  })
  const processEditLayout = useGridColumnLayout(processEditGridId, editProcessColumns, {
    ...PROCESS_EDIT_LAYOUT_OPTS,
    rowCount: processEditExcel.displayRows.length,
  })
  const inputEditLayout = useGridColumnLayout(inputEditGridId, editInputColumnsActive, {
    ...INPUT_EDIT_LAYOUT_OPTS,
    rowCount: inputEditExcel.displayRows.length,
  })

  const layoutBundleRef = useRef({
    lineLayout,
    inputLayout,
    processEditLayout,
    inputEditLayout,
  })
  layoutBundleRef.current = {
    lineLayout,
    inputLayout,
    processEditLayout,
    inputEditLayout,
  }

  const canEditRef = useRef(canEdit)
  canEditRef.current = canEdit
  const showAllOrdersInputsRef = useRef(showAllOrdersInputs)
  showAllOrdersInputsRef.current = showAllOrdersInputs

  const readActiveGridLayouts = useCallback((): GridColumnLayout[] => {
    const bundle = layoutBundleRef.current
    if (!canEditRef.current) {
      return [bundle.lineLayout, bundle.inputLayout]
    }
    // Order Traceability uses read/aggregate grid (inputLayout); per-order edit uses inputEditLayout.
    const activeInputLayout = showAllOrdersInputsRef.current
      ? bundle.inputLayout
      : bundle.inputEditLayout
    return [bundle.processEditLayout, activeInputLayout]
  }, [])

  useEffect(() => {
    if (!onGridLayoutsReady) return
    const layouts = readActiveGridLayouts()
    onGridLayoutsReady({
      saveLayouts: () => readActiveGridLayouts().forEach((layout) => layout.saveLayout()),
      isDirty: layouts.some((layout) => layout.isDirty),
    })
  }, [
    canEdit,
    showAllOrdersInputs,
    onGridLayoutsReady,
    readActiveGridLayouts,
    lineLayout.isDirty,
    inputLayout.isDirty,
    processEditLayout.isDirty,
    inputEditLayout.isDirty,
  ])

  useEffect(() => {
    processEditExcel.onLayoutReady(processEditLayout)
  }, [processEditLayout.isDirty, processEditLayout.saveLayout, processEditExcel.onLayoutReady])

  useEffect(() => {
    inputEditExcel.onLayoutReady(inputEditLayout)
  }, [inputEditLayout.isDirty, inputEditLayout.saveLayout, inputEditExcel.onLayoutReady])

  useEffect(() => {
    processReadExcel.onLayoutReady(lineLayout)
  }, [lineLayout.isDirty, lineLayout.saveLayout, processReadExcel.onLayoutReady])

  useEffect(() => {
    inputReadExcel.onLayoutReady(inputLayout)
  }, [inputLayout.isDirty, inputLayout.saveLayout, inputReadExcel.onLayoutReady])

  if (loading) {
    if (embedded) return <p className="muted erp-grid-empty">Loading process and input…</p>
    return (
      <div className="erp-panel erp-panel-grow erp-detail-panel">
        <div className="erp-panel-content erp-detail-content">
          <p className="muted erp-grid-empty">Loading process and input…</p>
        </div>
      </div>
    )
  }

  if (!detail && !showAllOrdersInputs) {
    if (embedded) return null
    return (
      <div className="erp-panel erp-panel-grow erp-detail-panel">
        <div className="erp-panel-content erp-detail-content">
          <p className="muted erp-grid-empty">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  const actualQtyReadonly = !canEditActuals
  const planFieldsReadonly = !canEditPlan
  const sectionSplitClass = processInputSplit ? ' erp-production-detail-section-split' : ''
  const detailContentClass = processInputSplit ? ' erp-detail-content-split' : ''

  const inputItemSectionTitle = (
    <div className="erp-production-detail-section-title">
      <span className="erp-production-detail-section-title-label">Input Item</span>
      {onOrderTraceabilityChange ? (
        <div className="erp-production-detail-section-title-actions">
          <OrderTraceabilityToggle
            checked={orderTraceabilityEnabled}
            onChange={onOrderTraceabilityChange}
          />
        </div>
      ) : null}
    </div>
  )

  const filteredAggregatedInputRows = inputReadExcel.displayRows as AggregatedProductionInputRow[]

  const allOrdersInputGrid = (
    <div
      className="erp-grid-wrap erp-grid-wrap-static"
      onContextMenu={inputReadExcel.openContextMenu}
    >
      <ResizableGridTable layout={inputLayout} {...inputReadTableProps}>
        <tbody>
          {loadingAllOrderInputs ? (
            <tr>
              <td colSpan={inputLayout.orderedColumns.length} className="erp-grid-empty-cell">
                Loading input items for orders in the list…
              </td>
            </tr>
          ) : fullAggregatedInputRows.length === 0 ? (
            <tr>
              <td colSpan={inputLayout.orderedColumns.length} className="erp-grid-empty-cell">
                No input items for orders in the list
              </td>
            </tr>
          ) : filteredAggregatedInputRows.length === 0 ? (
            <tr>
              <td colSpan={inputLayout.orderedColumns.length} className="erp-grid-empty-cell">
                No rows match the current filter
              </td>
            </tr>
          ) : (
            filteredAggregatedInputRows.map((ln, idx) => (
              <tr
                key={ln.key}
                className={erpRowClass(idx, selectedInputKey === ln.key)}
                onClick={() => toggleInputRowRead(ln.key)}
              >
                {inputLayout.orderedColumns.map((col) => {
                  switch (col.key) {
                    case 'rownum':
                      return <GridRowNumCell key={col.key} index={idx} />
                    case 'item_cd':
                      return (
                        <td key={col.key}>
                          <ColoredItemCode itemId={ln.item_id}>{ln.item_cd}</ColoredItemCode>
                        </td>
                      )
                    case 'item_nm':
                      return (
                        <td key={col.key}>
                          <ColoredItemName itemId={ln.item_id}>{ln.item_nm}</ColoredItemName>
                        </td>
                      )
                    case 'from_location':
                      return (
                        <td key={col.key}>
                          {ln.from_location_cd ? <code>{ln.from_location_cd}</code> : '-'}
                        </td>
                      )
                    case 'req_qty':
                      return <td key={col.key}>{formatQty(ln.req_qty)}</td>
                    case 'consume_qty':
                      return hideInputActualQty ? null : (
                        <td key={col.key}>{formatQty(ln.consume_qty)}</td>
                      )
                    case 'lot':
                      return (
                        <td key={col.key}>
                          <code>{ln.lot?.trim() || '-'}</code>
                        </td>
                      )
                    default:
                      return <td key={col.key} />
                  }
                })}
              </tr>
            ))
          )}
        </tbody>
      </ResizableGridTable>
    </div>
  )

  if (!detail && showAllOrdersInputs) {
    const inputOnlySection = (
      <section className={`erp-production-detail-section${sectionSplitClass}`} data-production-grid="input">
        {inputItemSectionTitle}
        {allOrdersInputGrid}
      </section>
    )
    if (embedded) {
      return (
        <>
          {inputReadExcel.filterMenuElement}
          {inputReadExcel.contextMenuElement}
          {inputOnlySection}
        </>
      )
    }
    return (
      <div className="erp-panel erp-panel-grow erp-detail-panel">
        {inputReadExcel.filterMenuElement}
        {inputReadExcel.contextMenuElement}
        <div className={`erp-panel-content erp-detail-content${detailContentClass}`}>
          {inputOnlySection}
        </div>
      </div>
    )
  }

  if (canEditPlan || canEditActuals) {
    const sortedProcessRows = [...processRows].sort((a, b) => a.line_no - b.line_no)

    const editProcessSection = (
        <section className={`erp-production-detail-section${sectionSplitClass}`} data-production-grid="process">
            <div className="erp-production-detail-section-title">
              <span className="erp-production-detail-section-title-label">Process</span>
              {canEditPlan && onReloadFromItemProcesses ? (
                <div className="erp-production-detail-section-title-actions">
                  <button
                    type="button"
                    className="btn erp-btn erp-btn-clear"
                    disabled={reloadingFromItemProcesses}
                    onClick={onReloadFromItemProcesses}
                  >
                    Reload Master
                  </button>
                  <ToolbarFeedback message={processStatusMessage} type="success" />
                  <ToolbarFeedback message={reloadItemProcessesError} type="error" />
                </div>
              ) : null}
            </div>
            <ProductionGridToolbar
              rowError={processRowError ?? rowError}
              rowErrorMessage={toolbarErrorMessage(processRowError ?? rowError)}
              saveLabel={GRID_COPY.saveProcessBtn}
              saving={savingProcess}
              onSave={showSectionSaveButtons ? onSaveProcess : undefined}
            />
            <div
                className="erp-grid-wrap erp-grid-wrap-detail"
                onContextMenu={processEditExcel.openContextMenu}
              >
                <ResizableGridTable
                  layout={processEditLayout}
                  selectColumnHeader={
                    <GridRowSelectButtons
                      rowCount={sortedProcessRows.length}
                      selectedCount={
                        sortedProcessRows.filter((r) => selectedProcessKeys.has(r.key)).length
                      }
                      selectAllTitle={GRID_COPY.checkAllRowsTitle}
                      clearTitle={GRID_COPY.uncheckAllRowsTitle}
                      onSelectAll={() =>
                        setSelectedProcessKeys(new Set(sortedProcessRows.map((r) => r.key)))
                      }
                      onClearSelection={() => setSelectedProcessKeys(new Set())}
                    />
                  }
                  {...processEditExcel.tableProps}
                >
                  <tbody>
                    {processEditExcel.displayRows.map((row, index) => {
                      const selectProcessRow = () => activateProcessRow(row.key)
                      return (
                      <tr
                        key={row.key}
                        className={erpRowClass(index, selectedProcessKey === row.key) ?? undefined}
                        onClick={selectProcessRow}
                      >
                        {processEditLayout.orderedColumns.map((col) => {
                          switch (col.key) {
                            case 'rownum':
                              return <GridRowNumCell key={col.key} index={index} />
                            case 'select':
                              return (
                                <td
                                  key={col.key}
                                  className="erp-col-check"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedProcessKeys.has(row.key)}
                                    aria-label={`Select process row ${index + 1}`}
                                    onChange={(e) => {
                                      setSelectedProcessKeys((prev) => {
                                        const next = new Set(prev)
                                        if (e.target.checked) next.add(row.key)
                                        else next.delete(row.key)
                                        return next
                                      })
                                    }}
                                  />
                                </td>
                              )
                            case 'process': {
                              const loc = processLocations.find(
                                (l) => l.location_id === row.wip_location_id
                              )
                              const locationCd = processLocationCdDisplay(row, processLocations)
                              if (planFieldsReadonly) {
                                return (
                                  <td key={col.key} className="erp-grid-cell-readonly">
                                    <code>{locationCd || loc?.location_cd || '-'}</code>
                                  </td>
                                )
                              }
                              return (
                                <td
                                  key={col.key}
                                  className="erp-grid-cell-edit"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {showLocationMasterDatalist(row.wip_location_id) ? (
                                    <GridLocationDatalistField
                                      mode="cd"
                                      locations={processLocations}
                                      listId={`${datalistScope}-process-loc-cd-${row.key}`}
                                      value={locationCd}
                                      placeholder={gridCellPlaceholder(
                                        'Location Code',
                                        isProcessRowBlank(row)
                                      )}
                                      onFocus={selectProcessRow}
                                      onChange={(value) =>
                                        updateProcessRow(
                                          row.key,
                                          processWipLocationCdFieldPatch(
                                            processLocations,
                                            value,
                                            row.key,
                                            processRows
                                          )
                                        )
                                      }
                                    />
                                  ) : (
                                    <GridLocationResolvedInput
                                      value={locationCd}
                                      placeholder={gridCellPlaceholder(
                                        'Location Code',
                                        isProcessRowBlank(row)
                                      )}
                                      onFocus={selectProcessRow}
                                      onChange={(value) =>
                                        updateProcessRow(
                                          row.key,
                                          processWipLocationCdFieldPatch(
                                            processLocations,
                                            value,
                                            row.key,
                                            processRows
                                          )
                                        )
                                      }
                                    />
                                  )}
                                </td>
                              )
                            }
                            case 'process_nm': {
                              const loc = processLocations.find(
                                (l) => l.location_id === row.wip_location_id
                              )
                              return (
                                <td key={col.key} className="erp-grid-cell-readonly">
                                  {loc?.location_nm ?? ''}
                                </td>
                              )
                            }
                            case 'output_item_cd':
                              return (
                                <td
                                  key={col.key}
                                  className={
                                    planFieldsReadonly || row.status === 'completed'
                                      ? 'erp-grid-cell-readonly'
                                      : 'erp-grid-cell-edit'
                                  }
                                >
                                  {planFieldsReadonly || row.status === 'completed' ? (
                                    <ColoredItemCode
                                      itemId={row.output_item_id === '' ? null : row.output_item_id}
                                      itemCd={row.output_item_cd}
                                    >
                                      {row.output_item_cd || '-'}
                                    </ColoredItemCode>
                                  ) : showItemMasterDatalist(row.output_item_id) ? (
                                    <GridItemDatalistField
                                      mode="cd"
                                      items={processOutputItemCatalog}
                                      listId={`${datalistScope}-process-item-cd-${row.key}`}
                                      value={row.output_item_cd}
                                      placeholder={gridCellPlaceholder(
                                        'Item Code',
                                        isBlankProcessRow(row)
                                      )}
                                      style={itemTextColorStyle(
                                        colorForItem(
                                          row.output_item_id === '' ? null : row.output_item_id
                                        )
                                      )}
                                      onFocus={selectProcessRow}
                                      onChange={(value) =>
                                        updateProcessRow(
                                          row.key,
                                          processItemCdFieldPatch(items, value)
                                        )
                                      }
                                    />
                                  ) : (
                                    <GridItemResolvedInput
                                      value={row.output_item_cd}
                                      placeholder={gridCellPlaceholder(
                                        'Item Code',
                                        isBlankProcessRow(row)
                                      )}
                                      style={itemTextColorStyle(
                                        colorForItem(
                                          row.output_item_id === '' ? null : row.output_item_id
                                        )
                                      )}
                                      onFocus={selectProcessRow}
                                      onChange={(value) =>
                                        updateProcessRow(
                                          row.key,
                                          processItemCdFieldPatch(items, value)
                                        )
                                      }
                                    />
                                  )}
                                </td>
                              )
                            case 'output_item_nm':
                              return (
                                <td
                                  key={col.key}
                                  className={
                                    planFieldsReadonly || row.status === 'completed'
                                      ? 'erp-grid-cell-readonly'
                                      : 'erp-grid-cell-edit'
                                  }
                                >
                                  {planFieldsReadonly || row.status === 'completed' ? (
                                    <ColoredItemName
                                      itemId={row.output_item_id === '' ? null : row.output_item_id}
                                      itemCd={row.output_item_cd}
                                    >
                                      {row.output_item_nm || '-'}
                                    </ColoredItemName>
                                  ) : showItemMasterDatalist(row.output_item_id) ? (
                                    <GridItemDatalistField
                                      mode="nm"
                                      items={processOutputItemCatalog}
                                      listId={`${datalistScope}-process-item-nm-${row.key}`}
                                      value={row.output_item_nm}
                                      placeholder={gridCellPlaceholder(
                                        'Item Name',
                                        isBlankProcessRow(row)
                                      )}
                                      style={itemTextColorStyle(
                                        colorForItem(
                                          row.output_item_id === '' ? null : row.output_item_id
                                        )
                                      )}
                                      onFocus={selectProcessRow}
                                      onChange={(value) =>
                                        updateProcessRow(
                                          row.key,
                                          processItemNmFieldPatch(items, value)
                                        )
                                      }
                                    />
                                  ) : (
                                    <GridItemResolvedInput
                                      value={row.output_item_nm}
                                      placeholder={gridCellPlaceholder(
                                        'Item Name',
                                        isBlankProcessRow(row)
                                      )}
                                      style={itemTextColorStyle(
                                        colorForItem(
                                          row.output_item_id === '' ? null : row.output_item_id
                                        )
                                      )}
                                      onFocus={selectProcessRow}
                                      onChange={(value) =>
                                        updateProcessRow(
                                          row.key,
                                          processItemNmFieldPatch(items, value)
                                        )
                                      }
                                    />
                                  )}
                                </td>
                              )
                            case 'planned_qty':
                              return (
                                <td
                                  key={col.key}
                                  className={
                                    planFieldsReadonly || row.status === 'completed'
                                      ? 'erp-grid-cell-readonly erp-col-num'
                                      : 'erp-grid-cell-edit erp-col-num'
                                  }
                                >
                                  {planFieldsReadonly || row.status === 'completed' ? (
                                    <span>
                                      {row.planned_qty.trim() ? formatQty(row.planned_qty) : '-'}
                                    </span>
                                  ) : (
                                    <input
                                      className="erp-grid-input"
                                      type="number"
                                      min="0.001"
                                      step="0.001"
                                      value={row.planned_qty}
                                      placeholder={gridCellPlaceholder(
                                        'Plan Qty',
                                        isBlankProcessRow(row)
                                      )}
                                      onFocus={selectProcessRow}
                                      onChange={(e) =>
                                        updateProcessRow(row.key, { planned_qty: e.target.value })
                                      }
                                    />
                                  )}
                                </td>
                              )
                            case 'actual_qty':
                              return (
                                <td
                                  key={col.key}
                                  className={
                                    actualQtyReadonly
                                      ? 'erp-col-num erp-grid-cell-readonly'
                                      : 'erp-grid-cell-edit erp-col-num'
                                  }
                                >
                                  {actualQtyReadonly ? (
                                    row.actual_qty.trim() ? formatQty(row.actual_qty) : ''
                                  ) : (
                                    <input
                                      className="erp-grid-input"
                                      type="number"
                                      min="0.001"
                                      step="0.001"
                                      value={row.actual_qty}
                                      onFocus={selectProcessRow}
                                      onChange={(e) =>
                                        updateProcessRow(row.key, { actual_qty: e.target.value })
                                      }
                                    />
                                  )}
                                </td>
                              )
                            case 'status':
                              return (
                                <td key={col.key}>
                                  {row.status === 'completed' ? row.status : row.status || ''}
                                </td>
                              )
                            case 'actions': {
                              if (planFieldsReadonly || isProcessRowBlank(row) || row.status === 'completed') {
                                return <td key={col.key} className="erp-col-actions" />
                              }
                              const dataIndex = orderedProcessDataRows.findIndex(
                                (entry) => entry.key === row.key
                              )
                              const canUp = dataIndex > 0
                              const canDown =
                                dataIndex >= 0 && dataIndex < orderedProcessDataRows.length - 1
                              return (
                                <td
                                  key={col.key}
                                  className="erp-col-actions"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="erp-row-actions">
                                    <button
                                      type="button"
                                      className="erp-btn erp-btn-row-move"
                                      disabled={!canUp}
                                      aria-label={`Move process row ${index + 1} up`}
                                      onClick={() => moveProcessRow(row.key, 'up')}
                                    >
                                      {GRID_COPY.moveUpBtn}
                                    </button>
                                    <button
                                      type="button"
                                      className="erp-btn erp-btn-row-move"
                                      disabled={!canDown}
                                      aria-label={`Move process row ${index + 1} down`}
                                      onClick={() => moveProcessRow(row.key, 'down')}
                                    >
                                      {GRID_COPY.moveDownBtn}
                                    </button>
                                  </div>
                                </td>
                              )
                            }
                            default:
                              return <td key={col.key} />
                          }
                        })}
                      </tr>
                      )
                    })}
                  </tbody>
                </ResizableGridTable>
              </div>
          </section>
    )

    const editInputSection = (
          <section className={`erp-production-detail-section${sectionSplitClass}`} data-production-grid="input">
            {inputItemSectionTitle}
            {!showExpandedInputView ? (
            <ProductionGridToolbar
              rowError={inputRowError ?? rowError}
              rowErrorMessage={toolbarErrorMessage(inputRowError ?? rowError)}
              statusMessage={inputStatusMessage}
              saveLabel={GRID_COPY.saveInputBtn}
              saving={savingInput}
              onSave={showSectionSaveButtons ? onSaveInput : undefined}
            />
            ) : null}
            {loadingAllOrderInputs && showAllOrdersInputs ? (
              <p className="muted erp-grid-empty">Loading input items for orders in the list…</p>
            ) : showExpandedInputView ? (
              allOrdersInputGrid
            ) : selectedProcessLineNo == null ? (
              <p className="muted erp-grid-empty">{GRID_COPY.inputSelectProcessMsg}</p>
            ) : (
              <div
                className="erp-grid-wrap erp-grid-wrap-detail"
                onContextMenu={inputEditExcel.openContextMenu}
              >
                <ResizableGridTable
                  layout={inputEditLayout}
                  selectColumnHeader={
                    <GridRowSelectButtons
                      rowCount={visibleEditInputs.length}
                      selectedCount={
                        visibleEditInputs.filter((r) => selectedInputKeys.has(r.key)).length
                      }
                      selectAllTitle={GRID_COPY.checkAllRowsTitle}
                      clearTitle={GRID_COPY.uncheckAllRowsTitle}
                      onSelectAll={() =>
                        setSelectedInputKeys(new Set(visibleEditInputs.map((r) => r.key)))
                      }
                      onClearSelection={() => setSelectedInputKeys(new Set())}
                    />
                  }
                  {...inputEditTableProps}
                >
                  <tbody>
                    {inputEditDisplayRows.map((row, index) => (
                      <tr
                        key={row.key}
                        className={
                          erpRowClass(
                            index,
                            selectedInputKey === row.key || selectedInputKeys.has(row.key)
                          ) ?? undefined
                        }
                        onClick={() => activateInputRow(row.key)}
                      >
                        {inputEditLayout.orderedColumns.map((col) => {
                          switch (col.key) {
                            case 'rownum':
                              return <GridRowNumCell key={col.key} index={index} />
                            case 'select':
                              return (
                                <td
                                  key={col.key}
                                  className="erp-col-check"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedInputKeys.has(row.key)}
                                    aria-label={`Select input row ${index + 1}`}
                                    onChange={(e) => {
                                      setSelectedInputKeys((prev) => {
                                        const next = new Set(prev)
                                        if (e.target.checked) next.add(row.key)
                                        else next.delete(row.key)
                                        return next
                                      })
                                    }}
                                  />
                                </td>
                              )
                            case 'item_cd':
                              return (
                                <td
                                  key={col.key}
                                  className={
                                    planFieldsReadonly ? 'erp-grid-cell-readonly' : 'erp-grid-cell-edit'
                                  }
                                >
                                  {planFieldsReadonly ? (
                                    <ColoredItemCode
                                      itemId={row.item_id === '' ? null : row.item_id}
                                      itemCd={row.item_cd}
                                    >
                                      {row.item_cd || '-'}
                                    </ColoredItemCode>
                                  ) : showItemMasterDatalist(row.item_id) ? (
                                    <GridItemDatalistField
                                      mode="cd"
                                      items={inputItemCatalog}
                                      listId={`${datalistScope}-item-cd-${row.key}`}
                                      value={row.item_cd}
                                      style={itemTextColorStyle(
                                        colorForItem(row.item_id === '' ? null : row.item_id)
                                      )}
                                      onChange={(value) =>
                                        updateInputRow(row.key, itemCdFieldPatch(items, value))
                                      }
                                    />
                                  ) : (
                                    <GridItemResolvedInput
                                      value={row.item_cd}
                                      style={itemTextColorStyle(
                                        colorForItem(row.item_id === '' ? null : row.item_id)
                                      )}
                                      onChange={(value) =>
                                        updateInputRow(row.key, itemCdFieldPatch(items, value))
                                      }
                                    />
                                  )}
                                </td>
                              )
                            case 'item_nm':
                              return (
                                <td
                                  key={col.key}
                                  className={
                                    planFieldsReadonly ? 'erp-grid-cell-readonly' : 'erp-grid-cell-edit'
                                  }
                                >
                                  {planFieldsReadonly ? (
                                    <ColoredItemName
                                      itemId={row.item_id === '' ? null : row.item_id}
                                      itemCd={row.item_cd}
                                    >
                                      {row.item_nm || '-'}
                                    </ColoredItemName>
                                  ) : showItemMasterDatalist(row.item_id) ? (
                                    <GridItemDatalistField
                                      mode="nm"
                                      items={inputItemCatalog}
                                      listId={`${datalistScope}-item-nm-${row.key}`}
                                      value={row.item_nm}
                                      style={itemTextColorStyle(
                                        colorForItem(row.item_id === '' ? null : row.item_id)
                                      )}
                                      onChange={(value) =>
                                        updateInputRow(row.key, itemNmFieldPatch(items, value))
                                      }
                                    />
                                  ) : (
                                    <GridItemResolvedInput
                                      value={row.item_nm}
                                      style={itemTextColorStyle(
                                        colorForItem(row.item_id === '' ? null : row.item_id)
                                      )}
                                      onChange={(value) =>
                                        updateInputRow(row.key, itemNmFieldPatch(items, value))
                                      }
                                    />
                                  )}
                                </td>
                              )
                            case 'from_location': {
                              const fromLoc = locations.find(
                                (l) => l.location_id === row.from_location_id
                              )
                              if (planFieldsReadonly) {
                                return (
                                  <td key={col.key} className="erp-grid-cell-readonly">
                                    <code>{fromLoc?.location_cd ?? '-'}</code>
                                  </td>
                                )
                              }
                              return (
                                <td
                                  key={col.key}
                                  className="erp-grid-cell-edit"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <select
                                    className="erp-grid-input"
                                    value={row.from_location_id}
                                    onChange={(e) =>
                                      updateInputRow(row.key, {
                                        from_location_id:
                                          e.target.value === '' ? '' : Number(e.target.value),
                                      })
                                    }
                                  >
                                    <option value="">
                                      {isInputRowBlank(row) ? '' : GRID_COPY.selectOption}
                                    </option>
                                    {locations.map((loc) => (
                                      <option key={loc.location_id} value={loc.location_id}>
                                        {loc.location_cd}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              )
                            }
                            case 'lot':
                              return (
                                <td
                                  key={col.key}
                                  className={
                                    planFieldsReadonly ? 'erp-grid-cell-readonly' : 'erp-grid-cell-edit'
                                  }
                                >
                                  {planFieldsReadonly ? (
                                    <code>{formatInputLotCell(row)}</code>
                                  ) : (
                                    <input
                                      className="erp-grid-input"
                                      value={row.lot}
                                      onChange={(e) =>
                                        updateInputRow(row.key, { lot: e.target.value })
                                      }
                                    />
                                  )}
                                </td>
                              )
                            case 'req_qty':
                              return (
                                <td
                                  key={col.key}
                                  className={
                                    planFieldsReadonly
                                      ? 'erp-col-num erp-grid-cell-readonly'
                                      : 'erp-grid-cell-edit erp-col-num'
                                  }
                                >
                                  {planFieldsReadonly ? (
                                    editInputText(row.req_qty).trim() ? formatQty(row.req_qty) : '-'
                                  ) : (
                                    <input
                                      className="erp-grid-input"
                                      type="number"
                                      min="0.001"
                                      step="0.001"
                                      value={row.req_qty}
                                      onChange={(e) =>
                                        updateInputRow(row.key, { req_qty: e.target.value })
                                      }
                                    />
                                  )}
                                </td>
                              )
                            case 'consume_qty':
                              return (
                                <td
                                  key={col.key}
                                  className={
                                    actualQtyReadonly
                                      ? 'erp-col-num erp-grid-cell-readonly'
                                      : 'erp-grid-cell-edit erp-col-num'
                                  }
                                  onClick={actualQtyReadonly ? undefined : (e) => e.stopPropagation()}
                                >
                                  {actualQtyReadonly ? (
                                    editInputText(row.consume_qty).trim()
                                      ? formatQty(row.consume_qty)
                                      : ''
                                  ) : (
                                    <input
                                      className="erp-grid-input"
                                      type="number"
                                      min="0.001"
                                      step="0.001"
                                      value={row.consume_qty}
                                      onChange={(e) =>
                                        updateInputRow(row.key, { consume_qty: e.target.value })
                                      }
                                    />
                                  )}
                                </td>
                              )
                            default:
                              return <td key={col.key} />
                          }
                        })}
                      </tr>
                    ))}
                  </tbody>
                </ResizableGridTable>
              </div>
            )}
          </section>
    )

    const editSections = processInputSplit ? (
      <ProcessInputSplitLayout
        processHeightRatio={processInputSplit.processHeightRatio}
        onProcessHeightRatioChange={processInputSplit.onProcessHeightRatioChange}
        process={editProcessSection}
        input={editInputSection}
      />
    ) : (
      <>
        {editProcessSection}
        {editInputSection}
      </>
    )

    const inputFilterMenuElement = showExpandedInputView
      ? inputReadExcel.filterMenuElement
      : inputEditExcel.filterMenuElement

    if (embedded) {
      return (
        <>
          {processEditExcel.filterMenuElement}
          {inputFilterMenuElement}
          {processEditExcel.contextMenuElement}
          {inputEditExcel.contextMenuElement}
          {editSections}
        </>
      )
    }

    return (
      <div className="erp-panel erp-panel-grow erp-detail-panel">
        {processEditExcel.filterMenuElement}
        {inputFilterMenuElement}
        {processEditExcel.contextMenuElement}
        {inputEditExcel.contextMenuElement}
        <div className={`erp-panel-content erp-detail-content${detailContentClass}`}>{editSections}</div>
      </div>
    )
  }

  const readProcessSection = (
        <section className={`erp-production-detail-section${sectionSplitClass}`} data-production-grid="process">
          <div className="erp-production-detail-section-title">Process</div>
          {onTreeHighlightChange ? (
            <div
              className="erp-detail-toolbar erp-production-detail-toolbar"
              aria-hidden="true"
            />
          ) : null}
          <div
            className="erp-grid-wrap erp-grid-wrap-static"
            onContextMenu={processReadExcel.openContextMenu}
          >
            <ResizableGridTable layout={lineLayout} {...processReadExcel.tableProps}>
              <tbody>
                {processReadExcel.displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={lineLayout.orderedColumns.length} className="erp-grid-empty-cell">
                      No process steps
                    </td>
                  </tr>
                ) : (
                  processReadExcel.displayRows.map((ln, idx) => (
                    <tr
                      key={ln.key}
                      className={erpRowClass(idx, selectedProcessKey === ln.key)}
                      onClick={() => toggleProcessRowRead(ln.key)}
                    >
                      {lineLayout.orderedColumns.map((col) => {
                        switch (col.key) {
                          case 'rownum':
                            return <GridRowNumCell key={col.key} index={idx} />
                          case 'process':
                            return (
                              <td key={col.key}>
                                <code>{ln.processCd}</code>
                              </td>
                            )
                          case 'process_nm':
                            return <td key={col.key}>{ln.processNm}</td>
                          case 'status':
                            return <td key={col.key}>{ln.status}</td>
                          case 'output_item_cd':
                            return (
                              <td key={col.key}>
                                <ColoredItemCode itemId={ln.outputItemId}>
                                  {ln.outputItemCd}
                                </ColoredItemCode>
                              </td>
                            )
                          case 'output_item_nm':
                            return (
                              <td key={col.key}>
                                <ColoredItemName itemId={ln.outputItemId}>
                                  {ln.outputItemNm}
                                </ColoredItemName>
                              </td>
                            )
                          case 'planned_qty':
                            return (
                              <td key={col.key} className="erp-col-num">
                                {formatQty(ln.plannedQty)}
                              </td>
                            )
                          case 'actual_qty':
                            return (
                              <td
                                key={col.key}
                                className={
                                  detail?.status === 'registered'
                                    ? 'erp-col-num erp-grid-cell-readonly'
                                    : 'erp-col-num'
                                }
                              >
                                {(() => {
                                  const display = actualQtyForEdit(
                                    ln.actualQty,
                                    detail?.status ?? 'registered'
                                  )
                                  return display.trim() ? formatQty(display) : ''
                                })()}
                              </td>
                            )
                          case 'actions':
                            return (
                              <td key={col.key} className="erp-col-actions">
                                {ln.status === 'completed' ? 'Done' : ''}
                              </td>
                            )
                          default:
                            return <td key={col.key} />
                        }
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </ResizableGridTable>
          </div>
        </section>
  )

  const readInputSection = (
        <section className={`erp-production-detail-section${sectionSplitClass}`} data-production-grid="input">
          {inputItemSectionTitle}
          {showExpandedInputView ? (
            allOrdersInputGrid
          ) : (
          <div
            className="erp-grid-wrap erp-grid-wrap-static"
            onContextMenu={inputReadExcel.openContextMenu}
          >
            <ResizableGridTable layout={inputLayout} {...inputReadTableProps}>
              <tbody>
                {inputReadExcel.displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={inputLayout.orderedColumns.length} className="erp-grid-empty-cell">
                      {selectedProcessKey == null
                        ? GRID_COPY.inputSelectProcessMsg
                        : 'No child items for selected process'}
                    </td>
                  </tr>
                ) : (
                  inputReadExcel.displayRows.map((ln, idx) => {
                    const detailInput = ln as NonNullable<ProductionOrderDetail['inputs']>[number]
                    return (
                      <tr
                        key={detailInput.prd_order_input_id}
                        className={erpRowClass(
                          idx,
                          selectedInputKey === String(detailInput.prd_order_input_id)
                        )}
                        onClick={() => toggleInputRowRead(String(detailInput.prd_order_input_id))}
                      >
                        {inputLayout.orderedColumns.map((col) => {
                          switch (col.key) {
                            case 'rownum':
                              return <GridRowNumCell key={col.key} index={idx} />
                            case 'item_cd':
                              return (
                                <td key={col.key}>
                                  <ColoredItemCode itemId={detailInput.item_id}>
                                    {detailInput.item_cd}
                                  </ColoredItemCode>
                                </td>
                              )
                            case 'item_nm':
                              return (
                                <td key={col.key}>
                                  <ColoredItemName itemId={detailInput.item_id}>
                                    {detailInput.item_nm}
                                  </ColoredItemName>
                                </td>
                              )
                            case 'from_location':
                              return (
                                <td key={col.key}>
                                  {detailInput.from_location_cd ? (
                                    <code>{detailInput.from_location_cd}</code>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                              )
                            case 'req_qty':
                              return <td key={col.key}>{formatQty(detailInput.req_qty)}</td>
                            case 'consume_qty':
                              return (
                                <td
                                  key={col.key}
                                  className={
                                    detail?.status === 'registered'
                                      ? 'erp-col-num erp-grid-cell-readonly'
                                      : 'erp-col-num'
                                  }
                                >
                                  {(() => {
                                    const display = consumeQtyForEdit(
                                      detailInput.consume_qty,
                                      detailInput.req_qty,
                                      detail?.status ?? 'registered',
                                      detail?.planned_qty
                                    )
                                    return display.trim() ? formatQty(display) : ''
                                  })()}
                                </td>
                              )
                            case 'lot':
                              return (
                                <td key={col.key}>
                                  <code>{detailInput.lot?.trim() || '-'}</code>
                                </td>
                              )
                            default:
                              return <td key={col.key} />
                          }
                        })}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </ResizableGridTable>
          </div>
          )}
        </section>
  )

  const readSections = processInputSplit ? (
    <ProcessInputSplitLayout
      processHeightRatio={processInputSplit.processHeightRatio}
      onProcessHeightRatioChange={processInputSplit.onProcessHeightRatioChange}
      process={readProcessSection}
      input={readInputSection}
    />
  ) : (
    <>
      {readProcessSection}
      {readInputSection}
    </>
  )

  if (embedded) {
    return (
      <>
        {processReadExcel.filterMenuElement}
        {inputReadExcel.filterMenuElement}
        {processReadExcel.contextMenuElement}
        {inputReadExcel.contextMenuElement}
        {readSections}
      </>
    )
  }

  return (
    <div className="erp-panel erp-panel-grow erp-detail-panel">
      {processReadExcel.filterMenuElement}
      {inputReadExcel.filterMenuElement}
      {processReadExcel.contextMenuElement}
      {inputReadExcel.contextMenuElement}
      <div className={`erp-panel-content erp-detail-content${detailContentClass}`}>{readSections}</div>
    </div>
  )
}
