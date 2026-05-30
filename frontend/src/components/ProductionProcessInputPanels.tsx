import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GridColumnLayout } from '../hooks/useGridColumnLayout'
import { erpRowClass } from './erp/ErpGridPanel'
import {
  GRID_SELECT_COLUMN,
  itemProcessInputEditColumns,
  itemProcessProcessEditColumns,
  productionInputColumns,
  productionLineColumns,
} from './erp/masterGridColumns'
import { isBlankItemProcessInputRow, isBlankItemProcessRow } from '../utils/itemProcessEdit'
import { GridRowSelectButtons } from './GridRowSelectButtons'
import { ProductionGridToolbar } from './ProductionGridToolbar'
import { GRID_ROWNUM_COLUMN, GridRowNumCell } from './GridRowNumCell'
import { ResizableGridTable, type GridColumnDef } from './ResizableGridTable'
import { useGridColumnLayout } from '../hooks/useGridColumnLayout'
import { useExcelLikeGrid } from '../hooks/useExcelLikeGrid'
import { toFilterCellValue } from '../utils/gridColumnFilter'
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
  emptyEditInputRow,
  emptyEditProcessRow,
  inputRowsWithSingleTrailingBlank,
  isBlankInputRow,
  isBlankProcessRow,
  processRowsWithSingleTrailingBlank,
  sortEditInputRowsForDisplay,
  itemCdFieldPatch,
  itemNmFieldPatch,
  processItemCdFieldPatch,
  processItemNmFieldPatch,
  processWipLocationPatch,
  actualQtyForEdit,
  consumeQtyForEdit,
  type EditInputRow,
  type EditProcessRow,
} from '../utils/productionEdit'
import { formatQty } from '../utils/format'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../utils/gridTrailingBlankRow'
import { processLinesFromDetail } from '../utils/productionProcessDisplay'
import { gridCellPlaceholder } from '../utils/gridPlaceholder'
import type { ProcessTreeHighlight } from '../utils/bomTree'
import {
  parentTreeHighlight,
  resolveProcessTreeHighlight,
} from '../utils/productionTreeHighlight'
import { buildItemProcessMasterTree } from '../utils/itemProcessTree'
import type { ItemProcessesOut } from '../types/itemprocs'
import type { ItemListRow } from '../types/masters'
import {
  buildProductionOrderTree,
  resolveInputTreeHighlight,
  type ProductionTreeData,
} from '../utils/productionOrderTree'

function formatInputLotCell(row: EditInputRow): string {
  if (isBlankInputRow(row)) return ''
  return (row.lot ?? '').trim() || '-'
}

const GRID_COPY = {
  deleteRowBtn: 'Delete row',
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

const processEditColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  GRID_SELECT_COLUMN,
  { key: 'process', label: 'Location Code', defaultWidth: 100 },
  { key: 'output_item_cd', label: 'Item Code', defaultWidth: 100 },
  { key: 'output_item_nm', label: 'Item Name', defaultWidth: 160 },
  { key: 'planned_qty', label: 'Plan Qty', defaultWidth: 80, className: 'erp-col-num' },
  { key: 'actual_qty', label: 'Actual Qty', defaultWidth: 80, className: 'erp-col-num' },
  { key: 'status', label: 'Status', defaultWidth: 88 },
]

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
  { key: 'item_cd', label: 'Item Code', defaultWidth: 110 },
  { key: 'item_nm', label: 'Item Name', defaultWidth: 160 },
  { key: 'from_location', label: 'From Location', defaultWidth: 100 },
  { key: 'lot', label: 'Lot', defaultWidth: 100 },
  { key: 'req_qty', label: 'Plan Input Qty', defaultWidth: 96, className: 'erp-col-num' },
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
  detail: ProductionOrderDetail | null
  loading?: boolean
  emptyMessage?: string
  canEdit?: boolean
  /** Registered: edit plan fields (not actual qty). */
  canEditPlan?: boolean
  /** Ordered/Started: edit actual qty fields only. */
  canEditActuals?: boolean
  items?: Item[]
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
  onResetHandlerChange?: (handler: (() => void) | null) => void
  /** When false, no process row is selected on load (Production Entry). */
  autoSelectFirstProcess?: boolean
  /** Render process/input sections only (no outer panel wrapper). */
  embedded?: boolean
  /** Item Processes master: process grid shows location only. */
  processColumnsMode?: 'default' | 'location-only'
  /** Saved subprocess definitions for WIP expansion in item-process tree. */
  itemProcessCache?: Map<number, ItemProcessesOut>
}

export function ProductionProcessInputPanels({
  detail,
  loading = false,
  emptyMessage = 'No order data.',
  canEdit = false,
  canEditPlan: canEditPlanProp,
  canEditActuals: canEditActualsProp,
  items = [],
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
  lineGridId = 'production-process-lines-v5',
  inputGridId = 'production-process-inputs-v4',
  processEditGridId = 'production-process-edit-v3',
  inputEditGridId = 'production-input-edit-v3',
  onGridLayoutsReady,
  onTreeHighlightChange,
  onTreeDataChange,
  onResetHandlerChange,
  autoSelectFirstProcess = true,
  embedded = false,
  processColumnsMode = 'default',
  itemProcessCache,
}: Props) {
  const isProcessRowBlank =
    processColumnsMode === 'location-only' ? isBlankItemProcessRow : isBlankProcessRow
  const isInputRowBlank =
    processColumnsMode === 'location-only' ? isBlankItemProcessInputRow : isBlankInputRow
  const showSectionSaveButtons = processColumnsMode !== 'location-only'
  const { colorForItem } = useItemTypColors()
  const orderStatus = detail?.status
  const canEditPlan =
    canEditPlanProp !== undefined
      ? canEditPlanProp
      : Boolean(canEdit && orderStatus === 'registered')
  const canEditActuals =
    canEditActualsProp !== undefined
      ? canEditActualsProp
      : Boolean(canEdit && (orderStatus === 'approved' || orderStatus === 'started'))
  const baseProcessEditColumns =
    processColumnsMode === 'location-only' ? itemProcessProcessEditColumns : processEditColumns
  const editProcessColumns = useMemo(
    () =>
      canEditPlan ? baseProcessEditColumns : baseProcessEditColumns.filter((c) => c.key !== 'select'),
    [canEditPlan, baseProcessEditColumns]
  )
  const baseInputEditColumns =
    processColumnsMode === 'location-only' ? itemProcessInputEditColumns : inputEditColumns
  const editInputColumnsActive = useMemo(
    () =>
      canEditPlan ? baseInputEditColumns : baseInputEditColumns.filter((c) => c.key !== 'select'),
    [canEditPlan, baseInputEditColumns]
  )
  const [selectedProcessKey, setSelectedProcessKey] = useState<string | null>(null)
  const [treeProcessHighlightKey, setTreeProcessHighlightKey] = useState<string | null>(null)
  const [selectedProcessKeys, setSelectedProcessKeys] = useState<Set<string>>(() => new Set())
  const [selectedInputKey, setSelectedInputKey] = useState<string | null>(null)
  const [selectedInputKeys, setSelectedInputKeys] = useState<Set<string>>(() => new Set())
  const pinnedProcessLineNoRef = useRef<number | null>(null)
  const inputRowsRef = useRef(inputRows)
  const processRowsRef = useRef(processRows)
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

  const resetProcessInputSelection = useCallback(() => {
    setSelectedProcessKey(null)
    setTreeProcessHighlightKey(null)
    setSelectedProcessKeys(new Set())
    setSelectedInputKey(null)
    setSelectedInputKeys(new Set())
    pinnedProcessLineNoRef.current = null
  }, [])

  useEffect(() => {
    if (!onResetHandlerChange) return
    onResetHandlerChange(onTreeHighlightChange ? resetProcessInputSelection : null)
    return () => onResetHandlerChange(null)
  }, [onResetHandlerChange, onTreeHighlightChange, resetProcessInputSelection])

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
    if (processColumnsMode === 'location-only' && itemProcessCache) {
      onTreeDataChange(
        buildItemProcessMasterTree({
          detail,
          processRows,
          inputRows,
          locations,
          items: items as ItemListRow[],
          itemProcessCache,
        })
      )
      return
    }
    onTreeDataChange(
      buildProductionOrderTree({
        detail,
        processRows,
        inputRows,
        locations,
        items,
        useEditRows: useEditProcessRows,
      })
    )
  }, [
    onTreeDataChange,
    detail,
    processRows,
    inputRows,
    locations,
    items,
    useEditProcessRows,
    processColumnsMode,
    itemProcessCache,
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
    if (inputHighlight) {
      onTreeHighlightChange(inputHighlight)
      return
    }
    if (treeProcessHighlightKey == null) {
      onTreeHighlightChange(parentTreeHighlight(detail.parent_item_id))
      return
    }
    onTreeHighlightChange(
      resolveProcessTreeHighlight(
        detail,
        treeProcessHighlightKey,
        processRows,
        locations,
        useEditProcessRows
      )
    )
  }, [
    detail,
    treeProcessHighlightKey,
    selectedInputKey,
    inputRows,
    processRows,
    locations,
    useEditProcessRows,
    onTreeHighlightChange,
  ])

  useEffect(() => {
    if (!autoSelectFirstProcess || !canEdit || loading || processRows.length === 0) return
    const topProcess = processRows
      .filter((row) => !isProcessRowBlank(row))
      .sort((a, b) => a.line_no - b.line_no)[0]
    if (!topProcess) return
    const keepCurrent =
      selectedProcessKey != null &&
      processRows.some(
        (row) => row.key === selectedProcessKey && !isProcessRowBlank(row)
      )
    if (keepCurrent) return
    pinnedProcessLineNoRef.current = topProcess.line_no
    setTreeProcessHighlightKey(topProcess.key)
    setSelectedProcessKey(topProcess.key)
    setSelectedInputKey(null)
    setSelectedInputKeys(new Set())
  }, [
    autoSelectFirstProcess,
    canEdit,
    loading,
    detail?.production_order_id,
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
    if (selectedProcessLineNo == null) return []
    return sortEditInputRowsForDisplay(
      inputRows.filter((row) => row.line_no === selectedProcessLineNo)
    )
  }, [inputRows, selectedProcessLineNo])

  const visibleInputs = useMemo(() => {
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
  }, [detail, selectedProcessKey, processGroups])

  const makeBlankProcessRow = (existing: EditProcessRow[]) =>
    createBlankProcessRowForDetail(existing)

  const appendBlankProcessRow = (existing: EditProcessRow[]) => {
    if (!detail) return existing
    return processRowsWithSingleTrailingBlank(existing, makeBlankProcessRow)
  }

  const makeBlankInputRow = (_existing: EditInputRow[]) =>
    createBlankInputRowForDetail([], selectedProcessLineNo ?? 1)

  const appendBlankInputRow = (existing: EditInputRow[]) => {
    if (!detail || selectedProcessLineNo == null) return existing
    return inputRowsWithSingleTrailingBlank(existing, makeBlankInputRow)
  }

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
    const lineNoRemap = new Map<number, number>()
    remaining.forEach((row, index) => {
      lineNoRemap.set(row.line_no, index + 1)
    })
    const renumbered = remaining.map((row, index) => ({ ...row, line_no: index + 1 }))
    // Do not re-append a trailing blank on explicit delete; use Add row or edit last row instead.
    const nextProcess =
      renumbered.length === 0 ? appendBlankProcessRow([]) : renumbered
    onProcessRowsChange(nextProcess)
    onInputRowsChange(
      inputRows
        .filter((row) => !removedLineNos.has(row.line_no))
        .map((row) => {
          const newLineNo = lineNoRemap.get(row.line_no)
          return newLineNo != null ? { ...row, line_no: newLineNo } : row
        })
    )
    if (selectedProcessKey && drop.has(selectedProcessKey)) {
      setSelectedProcessKey(nextProcess[0]?.key ?? null)
    }
    setSelectedProcessKeys(new Set())
  }

  const removeInputRows = (keys: string[]) => {
    if (!onInputRowsChange || keys.length === 0) return
    const drop = new Set(keys)
    onInputRowsChange(inputRows.filter((row) => !drop.has(row.key)))
    setSelectedInputKeys(new Set())
  }

  useEffect(() => {
    if (!useEditProcessRows || !detail || !onInputRowsChange || selectedProcessLineNo == null) return
    const currentInputRows = inputRowsRef.current
    const forProcess = currentInputRows.filter((row) => row.line_no === selectedProcessLineNo)
    const other = currentInputRows.filter((row) => row.line_no !== selectedProcessLineNo)
    const ensured = appendBlankInputRow(forProcess)
    if (
      ensured.length === forProcess.length &&
      ensured.every((row, index) => row.key === forProcess[index]?.key)
    ) {
      return
    }
    onInputRowsChange([...other, ...ensured])
  }, [useEditProcessRows, detail?.production_order_id, selectedProcessLineNo, onInputRowsChange])

  const datalistScope = processEditGridId

  const orderIdSuffix =
    detail?.production_order_id != null ? `order_${detail.production_order_id}` : 'production'

  const processEditFilterValue = (row: EditProcessRow, col: string) => {
    switch (col) {
      case 'process': {
        const loc = locations.find((l) => l.location_id === row.wip_location_id)
        return toFilterCellValue(loc?.location_cd ?? null)
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
        return toFilterCellValue(row.process)
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

  const inputReadFilterValue = (
    row: NonNullable<ProductionOrderDetail['inputs']>[number],
    col: string
  ) => {
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

  const inputEditExcel = useExcelLikeGrid({
    columns: editInputColumnsActive,
    rows: visibleEditInputs,
    getFilterValue: inputEditFilterValue,
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
    () => sortEditInputRowsForDisplay(inputEditExcel.displayRows),
    [inputEditExcel.displayRows]
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

  const inputReadExcel = useExcelLikeGrid({
    columns: productionInputColumns,
    rows: visibleInputs,
    getFilterValue: inputReadFilterValue,
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
  const inputLayout = useGridColumnLayout(inputGridId, productionInputColumns, {
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

  useEffect(() => {
    if (!onGridLayoutsReady) return
    const bundle = layoutBundleRef.current
    const layouts: GridColumnLayout[] = canEdit
      ? [bundle.processEditLayout, bundle.inputEditLayout]
      : [bundle.lineLayout, bundle.inputLayout]
    onGridLayoutsReady({
      saveLayouts: () => layouts.forEach((layout) => layout.saveLayout()),
      isDirty: layouts.some((layout) => layout.isDirty),
    })
  }, [
    canEdit,
    onGridLayoutsReady,
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
    return <p className="muted erp-grid-empty">Loading process and input…</p>
  }

  if (!detail) {
    if (embedded) return null
    return <p className="muted erp-grid-empty">{emptyMessage}</p>
  }

  const actualQtyReadonly = !canEditActuals
  const planFieldsReadonly = !canEditPlan

  if (canEditPlan || canEditActuals) {
    const sortedProcessRows = [...processRows].sort((a, b) => a.line_no - b.line_no)

    const editSections = (
      <>
        <section className="erp-production-detail-section" data-production-grid="process">
            <div className="erp-production-detail-section-title">Process</div>
            <ProductionGridToolbar
              rowError={processRowError ?? rowError}
              rowErrorMessage={toolbarErrorMessage(processRowError ?? rowError)}
              statusMessage={processStatusMessage}
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
                    {processEditExcel.displayRows.map((row, index) => (
                      <tr
                        key={row.key}
                        className={erpRowClass(index, selectedProcessKey === row.key) ?? undefined}
                        onClick={() => activateProcessRow(row.key)}
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
                              if (planFieldsReadonly) {
                                return (
                                  <td key={col.key} className="erp-grid-cell-readonly">
                                    <code>{loc?.location_cd ?? '-'}</code>
                                  </td>
                                )
                              }
                              return (
                                <td
                                  key={col.key}
                                  className="erp-grid-cell-edit"
                                >
                                  <select
                                    className="erp-grid-input"
                                    value={row.wip_location_id}
                                    onChange={(e) =>
                                      updateProcessRow(
                                        row.key,
                                        processWipLocationPatch(
                                          e.target.value === '' ? '' : Number(e.target.value),
                                          row.key,
                                          processRows
                                        )
                                      )
                                    }
                                  >
                                    <option value="">
                                      {isProcessRowBlank(row) ? '' : GRID_COPY.selectOption}
                                    </option>
                                    {processLocations.map((l) => (
                                      <option key={l.location_id} value={l.location_id}>
                                        {l.location_cd}
                                      </option>
                                    ))}
                                  </select>
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
                                  ) : (
                                    <>
                                      <input
                                        className="erp-grid-input"
                                        style={itemTextColorStyle(
                                          colorForItem(
                                            row.output_item_id === '' ? null : row.output_item_id
                                          )
                                        )}
                                        value={row.output_item_cd}
                                        placeholder={gridCellPlaceholder(
                                          'Item Code',
                                          isBlankProcessRow(row)
                                        )}
                                        list={`${datalistScope}-process-item-cd-${row.key}`}
                                        onChange={(e) =>
                                          updateProcessRow(
                                            row.key,
                                            processItemCdFieldPatch(items, e.target.value)
                                          )
                                        }
                                      />
                                      <datalist id={`${datalistScope}-process-item-cd-${row.key}`}>
                                        {items.map((item) => (
                                          <option key={item.item_id} value={item.item_cd}>
                                            {item.item_nm}
                                          </option>
                                        ))}
                                      </datalist>
                                    </>
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
                                  ) : (
                                    <input
                                      className="erp-grid-input"
                                      style={itemTextColorStyle(
                                        colorForItem(
                                          row.output_item_id === '' ? null : row.output_item_id
                                        )
                                      )}
                                      value={row.output_item_nm}
                                      placeholder={gridCellPlaceholder(
                                        'Item Name',
                                        isBlankProcessRow(row)
                                      )}
                                      list={`${datalistScope}-process-item-nm-${row.key}`}
                                      onChange={(e) =>
                                        updateProcessRow(
                                          row.key,
                                          processItemNmFieldPatch(items, e.target.value)
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
                            default:
                              return <td key={col.key} />
                          }
                        })}
                      </tr>
                    ))}
                  </tbody>
                </ResizableGridTable>
              </div>
          </section>

          <section className="erp-production-detail-section" data-production-grid="input">
            <div className="erp-production-detail-section-title">Input Item</div>
            <ProductionGridToolbar
              rowError={inputRowError ?? rowError}
              rowErrorMessage={toolbarErrorMessage(inputRowError ?? rowError)}
              statusMessage={inputStatusMessage}
              saveLabel={GRID_COPY.saveInputBtn}
              saving={savingInput}
              onSave={showSectionSaveButtons ? onSaveInput : undefined}
            />
            {selectedProcessLineNo == null && (
              <p className="muted erp-grid-empty">{GRID_COPY.inputSelectProcessMsg}</p>
            )}
            {selectedProcessLineNo != null && (
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
                  {...inputEditExcel.tableProps}
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
                                  ) : (
                                    <>
                                      <input
                                        className="erp-grid-input"
                                        style={itemTextColorStyle(
                                          colorForItem(row.item_id === '' ? null : row.item_id)
                                        )}
                                        value={row.item_cd}
                                        list={`${datalistScope}-item-cd-${row.key}`}
                                        onChange={(e) =>
                                          updateInputRow(
                                            row.key,
                                            itemCdFieldPatch(items, e.target.value)
                                          )
                                        }
                                      />
                                      <datalist id={`${datalistScope}-item-cd-${row.key}`}>
                                        {items.map((item) => (
                                          <option key={item.item_id} value={item.item_cd}>
                                            {item.item_nm}
                                          </option>
                                        ))}
                                      </datalist>
                                    </>
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
                                  ) : (
                                    <>
                                      <input
                                        className="erp-grid-input"
                                        style={itemTextColorStyle(
                                          colorForItem(row.item_id === '' ? null : row.item_id)
                                        )}
                                        value={row.item_nm}
                                        list={`${datalistScope}-item-nm-${row.key}`}
                                        onChange={(e) =>
                                          updateInputRow(
                                            row.key,
                                            itemNmFieldPatch(items, e.target.value)
                                          )
                                        }
                                      />
                                      <datalist id={`${datalistScope}-item-nm-${row.key}`}>
                                        {items.map((item) => (
                                          <option key={item.item_id} value={item.item_nm}>
                                            {item.item_cd}
                                          </option>
                                        ))}
                                      </datalist>
                                    </>
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
                                    row.req_qty.trim() ? formatQty(row.req_qty) : '-'
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
                                    row.consume_qty.trim() ? formatQty(row.consume_qty) : ''
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
      </>
    )

    if (embedded) {
      return (
        <>
          {processEditExcel.filterMenuElement}
          {inputEditExcel.filterMenuElement}
          {processEditExcel.contextMenuElement}
          {inputEditExcel.contextMenuElement}
          {editSections}
        </>
      )
    }

    return (
      <div className="erp-panel erp-panel-grow erp-detail-panel">
        {processEditExcel.filterMenuElement}
        {inputEditExcel.filterMenuElement}
        {processEditExcel.contextMenuElement}
        {inputEditExcel.contextMenuElement}
        <div className="erp-panel-content erp-detail-content">{editSections}</div>
      </div>
    )
  }

  const readSections = (
    <>
        <section className="erp-production-detail-section" data-production-grid="process">
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
                            return <td key={col.key}>{ln.process}</td>
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
                                  detail.status === 'registered'
                                    ? 'erp-col-num erp-grid-cell-readonly'
                                    : 'erp-col-num'
                                }
                              >
                                {(() => {
                                  const display = actualQtyForEdit(
                                    ln.actualQty,
                                    detail.status
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

        <section className="erp-production-detail-section" data-production-grid="input">
          <div className="erp-production-detail-section-title">Input Item</div>
          <div
            className="erp-grid-wrap erp-grid-wrap-static"
            onContextMenu={inputReadExcel.openContextMenu}
          >
            <ResizableGridTable layout={inputLayout} {...inputReadExcel.tableProps}>
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
                  inputReadExcel.displayRows.map((ln, idx) => (
                    <tr
                      key={ln.prd_order_input_id}
                      className={erpRowClass(idx, selectedInputKey === String(ln.prd_order_input_id))}
                      onClick={() => toggleInputRowRead(String(ln.prd_order_input_id))}
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
                                {ln.from_location_cd ? (
                                  <code>{ln.from_location_cd}</code>
                                ) : (
                                  '-'
                                )}
                              </td>
                            )
                          case 'req_qty':
                            return <td key={col.key}>{formatQty(ln.req_qty)}</td>
                          case 'consume_qty':
                            return (
                              <td
                                key={col.key}
                                className={
                                  detail.status === 'registered'
                                    ? 'erp-col-num erp-grid-cell-readonly'
                                    : 'erp-col-num'
                                }
                              >
                                {(() => {
                                  const display = consumeQtyForEdit(
                                    ln.consume_qty,
                                    ln.req_qty,
                                    detail.status,
                                    detail.planned_qty
                                  )
                                  return display.trim() ? formatQty(display) : ''
                                })()}
                              </td>
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
        </section>
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
      <div className="erp-panel-content erp-detail-content">{readSections}</div>
    </div>
  )
}
