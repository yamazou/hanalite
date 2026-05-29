import { useEffect, useMemo, useState } from 'react'
import type { GridColumnLayout } from '../hooks/useGridColumnLayout'
import { erpRowClass } from './erp/ErpGridPanel'
import { productionInputColumns, productionLineColumns } from './erp/masterGridColumns'
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
  itemCdFieldPatch,
  itemNmFieldPatch,
  processItemCdFieldPatch,
  processItemNmFieldPatch,
  processWipLocationPatch,
  type EditInputRow,
  type EditProcessRow,
} from '../utils/productionEdit'
import { formatQty } from '../utils/format'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../utils/gridTrailingBlankRow'
import { processLinesFromDetail } from '../utils/productionProcessDisplay'
import { gridCellPlaceholder } from '../utils/gridPlaceholder'

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
  saveProcessBtn: 'Save',
  saveInputBtn: 'Save',
  selectOption: 'Select...',
}

const processEditColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  { key: 'select', label: '', defaultWidth: 36, className: 'erp-col-check' },
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
  { key: 'select', label: '', defaultWidth: 36, className: 'erp-col-check' },
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
  onSaveProcess,
  onSaveInput,
  savingProcess = false,
  savingInput = false,
  lineGridId = 'production-process-lines-v5',
  inputGridId = 'production-process-inputs-v4',
  processEditGridId = 'production-process-edit-v3',
  inputEditGridId = 'production-input-edit-v3',
  onGridLayoutsReady,
}: Props) {
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
  const editProcessColumns = useMemo(
    () =>
      canEditPlan ? processEditColumns : processEditColumns.filter((c) => c.key !== 'select'),
    [canEditPlan]
  )
  const editInputColumnsActive = useMemo(
    () => (canEditPlan ? inputEditColumns : inputEditColumns.filter((c) => c.key !== 'select')),
    [canEditPlan]
  )
  const [selectedProcessKey, setSelectedProcessKey] = useState<string | null>(null)
  const [selectedProcessKeys, setSelectedProcessKeys] = useState<Set<string>>(() => new Set())
  const [selectedInputKeys, setSelectedInputKeys] = useState<Set<string>>(() => new Set())

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
    setSelectedProcessKeys(new Set())
    setSelectedInputKeys(new Set())
  }, [detail?.production_order_id])

  useEffect(() => {
    if (!canEdit || processRows.length === 0) return
    setSelectedProcessKey((prev) => {
      if (prev && processRows.some((row) => row.key === prev)) return prev
      return processRows[0]?.key ?? null
    })
  }, [canEdit, detail?.production_order_id, processRows])

  useEffect(() => {
    if (!canEdit) return
    const valid = new Set(processRows.map((row) => row.key))
    setSelectedProcessKeys((prev) => {
      const next = new Set([...prev].filter((key) => valid.has(key)))
      return next.size === prev.size ? prev : next
    })
    if (selectedProcessKey && !valid.has(selectedProcessKey)) {
      setSelectedProcessKey(null)
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
    if (!canEdit) return null
    const row = processRows.find((r) => r.key === selectedProcessKey)
    return row?.line_no ?? null
  }, [canEdit, processRows, selectedProcessKey])

  const visibleEditInputs = useMemo(() => {
    if (selectedProcessLineNo == null) return []
    return inputRows
      .filter((row) => row.line_no === selectedProcessLineNo)
      .sort((a, b) => a.line_no - b.line_no || a.key.localeCompare(b.key))
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
      isBlankProcessRow,
      (rows) => (detail ? makeBlankProcessRow(rows) : emptyEditProcessRow(rows.length + 1))
    )
    onProcessRowsChange(next)
    const touched = next.find((row) => row.key === key)
    if (touched && !isBlankProcessRow(touched)) {
      setSelectedProcessKey(touched.key)
    }
  }

  const updateInputRow = (key: string, patch: Partial<EditInputRow>) => {
    if (!onInputRowsChange) return
    onInputRowsChange(
      updateRowWithTrailingBlank(
        inputRows,
        key,
        patch,
        isBlankInputRow,
        (rows) =>
          detail && selectedProcessLineNo != null
            ? makeBlankInputRow(rows)
            : emptyEditInputRow(selectedProcessLineNo ?? 1)
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
    if (!canEdit || !detail || !onInputRowsChange || selectedProcessLineNo == null) return
    const forProcess = inputRows.filter((row) => row.line_no === selectedProcessLineNo)
    const other = inputRows.filter((row) => row.line_no !== selectedProcessLineNo)
    const ensured = appendBlankInputRow(forProcess)
    if (
      ensured.length === forProcess.length &&
      ensured.every((row, index) => row.key === forProcess[index]?.key)
    ) {
      return
    }
    onInputRowsChange([...other, ...ensured])
  }, [canEdit, detail?.production_order_id, selectedProcessLineNo])

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
        return toFilterCellValue(row.lot || detail?.lot)
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

  useEffect(() => {
    if (!onGridLayoutsReady) return
    const layouts: GridColumnLayout[] = canEdit
      ? [processEditLayout, inputEditLayout]
      : [lineLayout, inputLayout]
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
    lineLayout.saveLayout,
    inputLayout.saveLayout,
    processEditLayout.saveLayout,
    inputEditLayout.saveLayout,
  ])

  useEffect(() => {
    processEditExcel.onLayoutReady(processEditLayout)
  }, [processEditLayout, processEditExcel.onLayoutReady])

  useEffect(() => {
    inputEditExcel.onLayoutReady(inputEditLayout)
  }, [inputEditLayout, inputEditExcel.onLayoutReady])

  useEffect(() => {
    processReadExcel.onLayoutReady(lineLayout)
  }, [lineLayout, processReadExcel.onLayoutReady])

  useEffect(() => {
    inputReadExcel.onLayoutReady(inputLayout)
  }, [inputLayout, inputReadExcel.onLayoutReady])

  if (loading) {
    return <p className="muted erp-grid-empty">Loading process and input…</p>
  }

  if (!detail) {
    return <p className="muted erp-grid-empty">{emptyMessage}</p>
  }

  const actualQtyReadonly = !canEditActuals
  const planFieldsReadonly = !canEditPlan

  if (canEditPlan || canEditActuals) {
    const sortedProcessRows = [...processRows].sort((a, b) => a.line_no - b.line_no)

    return (
      <div className="erp-panel erp-panel-grow erp-detail-panel">
        {processEditExcel.filterMenuElement}
        {inputEditExcel.filterMenuElement}
        {processEditExcel.contextMenuElement}
        {inputEditExcel.contextMenuElement}
        <div className="erp-panel-content erp-detail-content">
          <section className="erp-production-detail-section" data-production-grid="process">
            <div className="erp-production-detail-section-title">Process</div>
            <ProductionGridToolbar
              checkAllTitle={GRID_COPY.checkAllRowsTitle}
              uncheckAllTitle={GRID_COPY.uncheckAllRowsTitle}
              rowCount={sortedProcessRows.length}
              rowError={processRowError ?? rowError}
              rowErrorMessage={toolbarErrorMessage(processRowError ?? rowError)}
              saveLabel={GRID_COPY.saveProcessBtn}
              saving={savingProcess}
              onSave={onSaveProcess}
              onCheckAll={() => setSelectedProcessKeys(new Set(sortedProcessRows.map((r) => r.key)))}
              onUncheckAll={() => setSelectedProcessKeys(new Set())}
            />
            <div
                className="erp-grid-wrap erp-grid-wrap-detail"
                onContextMenu={processEditExcel.openContextMenu}
              >
                <ResizableGridTable layout={processEditLayout} {...processEditExcel.tableProps}>
                  <tbody>
                    {processEditExcel.displayRows.map((row, index) => (
                      <tr
                        key={row.key}
                        className={erpRowClass(index, selectedProcessKey === row.key) ?? undefined}
                        onClick={() => setSelectedProcessKey(row.key)}
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
                                  onClick={(e) => e.stopPropagation()}
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
                                      {isBlankProcessRow(row) ? '' : GRID_COPY.selectOption}
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
                                  className="erp-grid-cell-edit"
                                  onClick={(e) => e.stopPropagation()}
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
                                  className="erp-grid-cell-edit"
                                  onClick={(e) => e.stopPropagation()}
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
                                  className="erp-grid-cell-edit erp-col-num"
                                  onClick={(e) => e.stopPropagation()}
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
                                  onClick={actualQtyReadonly ? undefined : (e) => e.stopPropagation()}
                                >
                                  {actualQtyReadonly ? (
                                    row.actual_qty.trim() ? formatQty(row.actual_qty) : '-'
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
              checkAllTitle={GRID_COPY.checkAllRowsTitle}
              uncheckAllTitle={GRID_COPY.uncheckAllRowsTitle}
              rowCount={visibleEditInputs.length}
              rowError={inputRowError ?? rowError}
              rowErrorMessage={toolbarErrorMessage(inputRowError ?? rowError)}
              saveLabel={GRID_COPY.saveInputBtn}
              saving={savingInput}
              onSave={onSaveInput}
              onCheckAll={() =>
                setSelectedInputKeys(new Set(visibleEditInputs.map((r) => r.key)))
              }
              onUncheckAll={() => setSelectedInputKeys(new Set())}
            />
            {selectedProcessLineNo == null && (
              <p className="muted erp-grid-empty">{GRID_COPY.inputSelectProcessMsg}</p>
            )}
            {selectedProcessLineNo != null && (
              <div
                className="erp-grid-wrap erp-grid-wrap-detail"
                onContextMenu={inputEditExcel.openContextMenu}
              >
                <ResizableGridTable layout={inputEditLayout} {...inputEditExcel.tableProps}>
                  <tbody>
                    {inputEditExcel.displayRows.map((row, index) => (
                      <tr key={row.key} className={erpRowClass(index) ?? undefined}>
                        {inputEditLayout.orderedColumns.map((col) => {
                          switch (col.key) {
                            case 'rownum':
                              return <GridRowNumCell key={col.key} index={index} />
                            case 'select':
                              return (
                                <td key={col.key} className="erp-col-check">
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
                                      {isBlankInputRow(row) ? '' : GRID_COPY.selectOption}
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
                                    <code>{row.lot.trim() || detail.lot}</code>
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
                                    row.consume_qty.trim() ? formatQty(row.consume_qty) : '-'
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
        </div>
      </div>
    )
  }

  return (
    <div className="erp-panel erp-panel-grow erp-detail-panel">
      {processReadExcel.filterMenuElement}
      {inputReadExcel.filterMenuElement}
      {processReadExcel.contextMenuElement}
      {inputReadExcel.contextMenuElement}
      <div className="erp-panel-content erp-detail-content">
        <section className="erp-production-detail-section" data-production-grid="process">
          <div className="erp-production-detail-section-title">Process</div>
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
                      onClick={() =>
                        setSelectedProcessKey((prev) => (prev === ln.key ? null : ln.key))
                      }
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
                                {ln.actualQty != null ? formatQty(ln.actualQty) : '-'}
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
                    <tr key={ln.prd_order_input_id} className={erpRowClass(idx)}>
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
                                {formatQty(ln.consume_qty)}
                              </td>
                            )
                          case 'lot':
                            return (
                              <td key={col.key}>
                                <code>{ln.lot || detail.lot}</code>
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
      </div>
    </div>
  )
}
