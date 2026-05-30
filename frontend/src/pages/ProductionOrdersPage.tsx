import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppNavigate } from '../context/AppNavigateContext'
import { api } from '../api/client'
import { ErpSuggestInput } from '../components/ErpSuggestInput'
import { ErpGridPanel, erpRowClass } from '../components/erp/ErpGridPanel'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpSearchPanel } from '../components/erp/ErpSearchPanel'
import { SearchDateInput, SearchFilterField } from '../components/erp/SearchFilterField'
import { productionOrderListColumns } from '../components/erp/masterGridColumns'
import { GridRowNumCell } from '../components/GridRowNumCell'
import { ProductionProcessInputPanels } from '../components/ProductionProcessInputPanels'
import { GridRowSelectButtons } from '../components/GridRowSelectButtons'
import { BomTreePanel } from '../components/BomTreePanel'
import { ProductionTreeSidebar } from '../components/ProductionTreeSidebar'
import { useExcelLikeGrid } from '../hooks/useExcelLikeGrid'
import { useGridColumnLayout, type GridColumnLayout } from '../hooks/useGridColumnLayout'
import type { Item } from '../types'
import { useMasterCatalog } from '../context/MasterCatalogContext'
import type {
  ProductionOrderDetail,
  ProductionOrderListItem,
  ProductionSourceType,
  ProductionStatus,
} from '../types/production'
import { StatusBadge } from '../components/StatusBadge'
import { ColoredItemCode, ColoredItemName } from '../components/ColoredItemText'
import {
  formatDate,
  formatDateTime,
  formatQty,
  productionStatusLabel,
} from '../utils/format'
import { toFilterCellValue } from '../utils/gridColumnFilter'
import { ensureTrailingBlankRow } from '../utils/gridTrailingBlankRow'
import { suggestItems, suggestProductionLots } from '../utils/searchSuggest'
import {
  buildInputPayload,
  buildProcessPayload,
  createBlankProcessRowForDetail,
  detailToEditInputRows,
  detailToEditProcessRows,
  isActiveInputRow,
  isActiveProcessRow,
  isBlankProcessRow,
  type EditInputRow,
  type EditProcessRow,
} from '../utils/productionEdit'
import { type BomTreeLine, type ProcessTreeHighlight } from '../utils/bomTree'
import type { ProductionTreeData } from '../utils/productionOrderTree'
type ProductionSearchFilters = {
  dateFrom: string
  dateTo: string
  item: string
  lot: string
}

const emptyProductionSearch: ProductionSearchFilters = {
  dateFrom: '',
  dateTo: '',
  item: '',
  lot: '',
}

const productionSourceLabel: Record<ProductionSourceType, string> = {
  manual: 'Manual',
  excel: 'Excel',
}

function getOrderExportCell(row: ProductionOrderListItem, key: string): string | number {
  switch (key) {
    case 'id':
      return row.production_order_id
    case 'status':
      return productionStatusLabel[row.status] ?? row.status
    case 'production_date':
      return formatDate(row.production_date)
    case 'reference_no':
      return row.reference_no ?? ''
    case 'source':
      return productionSourceLabel[row.source_type] ?? row.source_type
    case 'item_cd':
      return row.parent_item_cd
    case 'item_nm':
      return row.parent_item_nm
    case 'planned_qty':
      return row.planned_qty
    case 'actual_qty':
      return row.actual_qty ?? ''
    case 'lines':
      return `${row.completed_line_count}/${row.line_count}`
    case 'lot':
      return row.lot
    case 'created':
      return formatDateTime(row.created_at)
    case 'approved':
      return formatDateTime(row.approved_at)
    default:
      return ''
  }
}

export function ProductionOrdersPage() {
  const navigate = useAppNavigate()
  const [orders, setOrders] = useState<ProductionOrderListItem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ProductionOrderDetail | null>(null)
  const [statusFilter, setStatusFilter] = useState<'' | ProductionStatus>('registered')
  const [searchInput, setSearchInput] = useState<ProductionSearchFilters>(emptyProductionSearch)
  const [appliedSearch, setAppliedSearch] = useState<ProductionSearchFilters>(emptyProductionSearch)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const { items: masterItems, locations: masterLocations } = useMasterCatalog()
  const [editProcessRows, setEditProcessRows] = useState<EditProcessRow[]>([])
  const [editInputRows, setEditInputRows] = useState<EditInputRow[]>([])
  const [processRowError, setProcessRowError] = useState<string | null>(null)
  const [inputRowError, setInputRowError] = useState<string | null>(null)
  const [lineSaveTarget, setLineSaveTarget] = useState<'process' | 'input' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [processStatusMessage, setProcessStatusMessage] = useState<string | null>(null)
  const [inputStatusMessage, setInputStatusMessage] = useState<string | null>(null)
  const [orderGridLayoutApi, setOrderGridLayoutApi] = useState<{
    saveLayout: () => void
    isDirty: boolean
  } | null>(null)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(() => new Set())
  const [treeTitle, setTreeTitle] = useState<string | null>(null)
  const [treeLines, setTreeLines] = useState<BomTreeLine[]>([])
  const [treeOnSelect, setTreeOnSelect] = useState(true)
  const [treeHighlight, setTreeHighlight] = useState<ProcessTreeHighlight | null>(null)
  const orderLayoutRef = useRef<GridColumnLayout | null>(null)
  const processInputLayoutApiRef = useRef<{ saveLayouts: () => void; isDirty: boolean } | null>(
    null
  )
  const resetProcessSelectionRef = useRef<(() => void) | null>(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await api.listProductionOrders({
        status: statusFilter || undefined,
        date_from: appliedSearch.dateFrom || undefined,
        date_to: appliedSearch.dateTo || undefined,
        item_q: appliedSearch.item.trim() || undefined,
        lot: appliedSearch.lot.trim() || undefined,
      })
      setOrders(rows)
      setSelectedId((prev) => (prev && rows.some((r) => r.production_order_id === prev) ? prev : (rows[0]?.production_order_id ?? null)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load production orders')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, appliedSearch])

  const applySearchField = useCallback(
    (...keys: (keyof ProductionSearchFilters)[]) => {
      if (keys.includes('dateFrom') || keys.includes('dateTo')) {
        if (
          searchInput.dateFrom &&
          searchInput.dateTo &&
          searchInput.dateFrom > searchInput.dateTo
        ) {
          setError('Production Date From must be on or before Production Date To.')
          return
        }
      }
      setError(null)
      setAppliedSearch((prev) => {
        const next = { ...prev }
        for (const key of keys) next[key] = searchInput[key]
        return next
      })
    },
    [searchInput]
  )

  const clearSearchField = useCallback((patch: Partial<ProductionSearchFilters>) => {
    setSearchInput((prev) => ({ ...prev, ...patch }))
    setAppliedSearch((prev) => ({ ...prev, ...patch }))
    setError(null)
  }, [])

  const fetchItemSuggestions = useCallback((q: string) => suggestItems(q), [])
  const fetchLotSuggestions = useCallback((q: string) => suggestProductionLots(q), [])

  const loadDetail = useCallback(async (orderId: number | null) => {
    setProcessStatusMessage(null)
    setInputStatusMessage(null)
    if (!orderId) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    try {
      const row = await api.getProductionOrder(orderId)
      setDetail(row)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load order detail')
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  useEffect(() => {
    setSelectedOrderIds(new Set())
  }, [statusFilter])

  useEffect(() => {
    void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const canEditPlan = detail?.status === 'registered'
  const canEditActuals = detail?.status === 'approved' || detail?.status === 'started'
  const canEditDetail = canEditPlan || canEditActuals

  useEffect(() => {
    if (!detail || !canEditDetail) {
      setEditProcessRows([])
      setEditInputRows([])
      return
    }
    const process = detailToEditProcessRows(detail)
    setEditProcessRows(
      canEditPlan
        ? ensureTrailingBlankRow(
            process,
            isBlankProcessRow,
            (rows) => createBlankProcessRowForDetail(rows)
          )
        : process
    )
    setEditInputRows(detailToEditInputRows(detail))
    setProcessRowError(null)
    setInputRowError(null)
  }, [detail?.production_order_id, detail?.updated_at, canEditDetail, canEditPlan])

  const statusOptions: Array<{ value: '' | ProductionStatus; label: string }> = [
    { value: '', label: 'All' },
    { value: 'cancelled', label: productionStatusLabel.cancelled },
    { value: 'registered', label: productionStatusLabel.registered },
    { value: 'approved', label: productionStatusLabel.approved },
    { value: 'started', label: productionStatusLabel.started },
    { value: 'completed', label: productionStatusLabel.completed },
  ]

  const selectedOrder = useMemo(
    () => orders.find((r) => r.production_order_id === selectedId) ?? null,
    [orders, selectedId]
  )
  const canApproveSelected =
    selectedOrder != null &&
    selectedOrder.status === 'registered' &&
    (selectedOrder.line_count ?? 0) > 0

  const bulkOrderTargetCount = useMemo(
    () =>
      orders.filter(
        (r) =>
          selectedOrderIds.has(r.production_order_id) &&
          r.status === 'registered' &&
          (r.line_count ?? 0) > 0
      ).length,
    [orders, selectedOrderIds]
  )
  const bulkCancelTargetCount = useMemo(
    () =>
      orders.filter(
        (r) => selectedOrderIds.has(r.production_order_id) && r.status === 'registered'
      ).length,
    [orders, selectedOrderIds]
  )
  const bulkDeleteTargetCount = useMemo(
    () =>
      orders.filter(
        (r) => selectedOrderIds.has(r.production_order_id) && r.status === 'cancelled'
      ).length,
    [orders, selectedOrderIds]
  )
  const bulkRestoreTargetCount = bulkDeleteTargetCount
  const hasBulkSelection = selectedOrderIds.size > 0
  const bulkActionsForCancelled = statusFilter === 'cancelled'
  const bulkActionsForRegistered = statusFilter === 'registered'

  const canCancel =
    detail?.status === 'registered' ||
    detail?.status === 'approved' ||
    detail?.status === 'started'
  const canRestore = detail?.status === 'cancelled'
  const canDelete = detail?.status === 'cancelled'

  const handleRestore = async () => {
    if (!selectedId || detail?.status !== 'cancelled') return
    if (!confirm('Restore this production order to registered?')) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const row = await api.restoreProductionOrder(selectedId)
      setDetail(row)
      setSuccess('Production order restored.')
      await loadOrders()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to restore production order')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedId || detail?.status !== 'cancelled') return
    if (!confirm('Delete this production order?')) return
    const orderId = selectedId
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      await api.deleteProductionOrder(orderId)
      setSuccess('Production order deleted.')
      if (selectedId === orderId) {
        setSelectedId(null)
        setDetail(null)
      }
      await loadOrders()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete production order')
    } finally {
      setSubmitting(false)
    }
  }

  const saveProcessOnly = async (): Promise<boolean> => {
    if (!selectedId || !detail) return false
    if (detail.status === 'approved' || detail.status === 'started') {
      const lines = buildProcessPayload(editProcessRows, masterItems)
      if (lines.length === 0) {
        setProcessRowError('process_validation')
        return false
      }
      setProcessRowError(null)
      try {
        const row = await api.updateProductionOrder(selectedId, { lines })
        setDetail(row)
        setEditProcessRows(detailToEditProcessRows(row))
        await loadOrders()
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save actual quantities')
        return false
      }
    }
    if (detail.status !== 'registered') return false
    const processRows = editProcessRows.filter((r) => !isBlankProcessRow(r))
    const lines = buildProcessPayload(editProcessRows, masterItems)
    if (lines.length === 0) {
      setProcessRowError('process_validation')
      return false
    }
    if (!processRows.every((r) => isActiveProcessRow(r, editProcessRows, masterItems))) {
      setProcessRowError('process_validation')
      return false
    }
    setProcessRowError(null)
    try {
      const row = await api.updateProductionOrder(selectedId, {
        planned_qty: Number(detail.planned_qty),
        lot: detail.lot,
        notes: detail.notes,
        lines,
      })
      setDetail(row)
      setEditProcessRows(
        ensureTrailingBlankRow(
          detailToEditProcessRows(row),
          isBlankProcessRow,
          (rows) => createBlankProcessRowForDetail(rows)
        )
      )
      await loadOrders()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save process')
      return false
    }
  }

  const saveInputsOnly = async (): Promise<boolean> => {
    if (!selectedId || !detail) return false
    if (detail.status === 'approved' || detail.status === 'started') {
      const inputs = buildInputPayload(editInputRows, {
        status: detail.status,
        orderPlannedQty: detail.planned_qty,
      })
      if (inputs.length === 0) {
        setInputRowError('input_validation')
        return false
      }
      setInputRowError(null)
      try {
        const row = await api.updateProductionOrder(selectedId, { inputs })
        setDetail(row)
        setEditInputRows(detailToEditInputRows(row))
        await loadOrders()
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save actual input quantities')
        return false
      }
    }
    if (detail.status !== 'registered') return false
    const inputs = buildInputPayload(editInputRows, {
      status: detail.status,
      orderPlannedQty: detail.planned_qty,
    })
    if (inputs.length === 0) {
      setInputRowError('input_validation')
      return false
    }
    if (!editInputRows.some(isActiveInputRow)) {
      setInputRowError('input_validation')
      return false
    }
    setInputRowError(null)
    try {
      const row = await api.updateProductionOrder(selectedId, {
        inputs,
      })
      setDetail(row)
      setEditInputRows(detailToEditInputRows(row))
      await loadOrders()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save input items')
      return false
    }
  }

  const saveProcessAndInputs = async (): Promise<boolean> => {
    const processOk = await saveProcessOnly()
    if (!processOk) return false
    return saveInputsOnly()
  }

  const handleApprove = async () => {
    if (!selectedId) return
    if (
      !confirm(
        'Order this production order? After ordering, only Actual Qty and Actual Input Qty can be edited.'
      )
    ) {
      return
    }
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      if (canEditPlan) {
        const saved = await saveProcessAndInputs()
        if (!saved) return
      }
      const row = await api.approveProductionOrder(selectedId)
      setDetail(row)
      setSuccess('Production order ordered.')
      await loadOrders()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to order production')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async () => {
    if (!selectedId || !detail) return
    const revertToOrdered = detail.status === 'started'
    if (
      !confirm(
        revertToOrdered
          ? 'Return this production order to Ordered status?'
          : 'Cancel this production order?'
      )
    ) {
      return
    }
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const row = await api.cancelProductionOrder(selectedId)
      setDetail(row)
      setSuccess(
        revertToOrdered
          ? 'Returned to Ordered.'
          : row.status === 'registered'
            ? 'Order reversed; production order is registered again.'
            : 'Production order cancelled.'
      )
      await loadOrders()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBulkOrder = async () => {
    const targets = orders.filter(
      (r) =>
        selectedOrderIds.has(r.production_order_id) &&
        r.status === 'registered' &&
        (r.line_count ?? 0) > 0
    )
    if (targets.length === 0) return
    if (
      !confirm(
        `Order ${targets.length} production order(s)? After ordering, only Actual Qty and Actual Input Qty can be edited.`
      )
    ) {
      return
    }
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      for (const row of targets) {
        if (selectedId === row.production_order_id && detail?.status === 'registered') {
          const saved = await saveProcessAndInputs()
          if (!saved) return
        }
        await api.approveProductionOrder(row.production_order_id)
      }
      setSelectedOrderIds(new Set())
      setSuccess(`Ordered ${targets.length} production order(s).`)
      await loadOrders()
      if (selectedId) await loadDetail(selectedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to order production')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBulkCancel = async () => {
    const targets = orders.filter(
      (r) => selectedOrderIds.has(r.production_order_id) && r.status === 'registered'
    )
    if (targets.length === 0) return
    if (!confirm(`Cancel ${targets.length} production order(s)?`)) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      for (const row of targets) {
        await api.cancelProductionOrder(row.production_order_id)
      }
      setSelectedOrderIds(new Set())
      setSuccess(`Cancelled ${targets.length} production order(s).`)
      if (selectedId && targets.some((r) => r.production_order_id === selectedId)) {
        setDetail(null)
        setSelectedId(null)
      }
      await loadOrders()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBulkDelete = async () => {
    const targets = orders.filter(
      (r) => selectedOrderIds.has(r.production_order_id) && r.status === 'cancelled'
    )
    if (targets.length === 0) return
    if (!confirm(`Delete ${targets.length} production order(s)?`)) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      for (const row of targets) {
        await api.deleteProductionOrder(row.production_order_id)
      }
      setSelectedOrderIds(new Set())
      setSuccess(`Deleted ${targets.length} production order(s).`)
      if (selectedId && targets.some((r) => r.production_order_id === selectedId)) {
        setSelectedId(null)
        setDetail(null)
      }
      await loadOrders()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete production order')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBulkRestore = async () => {
    const targets = orders.filter(
      (r) => selectedOrderIds.has(r.production_order_id) && r.status === 'cancelled'
    )
    if (targets.length === 0) return
    if (!confirm(`Restore ${targets.length} production order(s) to registered?`)) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      for (const row of targets) {
        await api.restoreProductionOrder(row.production_order_id)
      }
      setSelectedOrderIds(new Set())
      setSuccess(`Restored ${targets.length} production order(s).`)
      if (selectedId && targets.some((r) => r.production_order_id === selectedId)) {
        await loadDetail(selectedId)
      }
      await loadOrders()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to restore production order')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveProcess = async () => {
    if (!selectedId || !detail || !canEditDetail) return
    setLineSaveTarget('process')
    setSubmitting(true)
    setError(null)
    setProcessStatusMessage(null)
    try {
      const ok = await saveProcessOnly()
      if (ok) setProcessStatusMessage('Process saved.')
    } finally {
      setSubmitting(false)
      setLineSaveTarget(null)
    }
  }

  const handleSaveInput = async () => {
    if (!selectedId || !detail || !canEditDetail) return
    setLineSaveTarget('input')
    setSubmitting(true)
    setError(null)
    setInputStatusMessage(null)
    try {
      const ok = await saveInputsOnly()
      if (ok) setInputStatusMessage('Input items saved.')
    } finally {
      setSubmitting(false)
      setLineSaveTarget(null)
    }
  }

  const handleProcessInputGridLayoutsReady = useCallback(
    (api: { saveLayouts: () => void; isDirty: boolean }) => {
      processInputLayoutApiRef.current = api
    },
    []
  )

  const handleResetProcessSelection = useCallback(() => {
    resetProcessSelectionRef.current?.()
  }, [])

  const handleTreeDataChange = useCallback((data: ProductionTreeData) => {
    setTreeTitle(data.title)
    setTreeLines(data.lines)
  }, [])

  const handleResetHandlerChange = useCallback((handler: (() => void) | null) => {
    resetProcessSelectionRef.current = handler
  }, [])

  const handleSaveAllGridLayouts = () => {
    orderGridLayoutApi?.saveLayout()
    processInputLayoutApiRef.current?.saveLayouts()
  }

  const getOrderFilterValue = useCallback((row: ProductionOrderListItem, col: string) => {
    const cell = getOrderExportCell(row, col)
    return toFilterCellValue(cell === '' ? null : cell)
  }, [])

  useEffect(() => {
    if (!detail) {
      setTreeHighlight(null)
      if (treeOnSelect) {
        setTreeTitle(null)
        setTreeLines([])
      }
    }
  }, [detail?.production_order_id, treeOnSelect])

  const activateOrder = useCallback((row: ProductionOrderListItem) => {
    setSelectedId(row.production_order_id)
  }, [])

  const handleTreeOnSelectChange = useCallback((enabled: boolean) => {
    setTreeOnSelect(enabled)
    if (!enabled) {
      setTreeTitle(null)
      setTreeLines([])
    }
  }, [])

  const ordersGrid = useExcelLikeGrid({
    columns: productionOrderListColumns,
    rows: orders,
    getFilterValue: getOrderFilterValue,
    excelExport: {
      sheetName: 'Production List',
      filenamePrefix: 'production_orders',
      getExportValue: getOrderExportCell,
    },
  })

  const handleOrderGridLayoutReady = useCallback(
    (layout: GridColumnLayout) => {
      orderLayoutRef.current = layout
      ordersGrid.onLayoutReady(layout)
      setOrderGridLayoutApi((prev) =>
        prev && prev.saveLayout === layout.saveLayout && prev.isDirty === layout.isDirty
          ? prev
          : { saveLayout: layout.saveLayout, isDirty: layout.isDirty }
      )
    },
    [ordersGrid.onLayoutReady]
  )

  return (
    <ErpScreen
      error={error}
      success={success}
      className="erp-screen-stacked"
      title="Production List"
      onRefresh={() => void loadOrders()}
      onSaveGrid={handleSaveAllGridLayouts}
    >
      {ordersGrid.filterMenuElement}
      {ordersGrid.contextMenuElement}
      <ErpSearchPanel>
        <div className="erp-search-row erp-search-form-suggest">
          <SearchFilterField
            className="erp-search-field-date"
            showApply={
              searchInput.dateFrom !== appliedSearch.dateFrom ||
              searchInput.dateTo !== appliedSearch.dateTo
            }
            onApply={() => applySearchField('dateFrom', 'dateTo')}
            showClear={Boolean(appliedSearch.dateFrom || appliedSearch.dateTo)}
            onClear={() => clearSearchField({ dateFrom: '', dateTo: '' })}
          >
            <span className="erp-search-date-range">
              <SearchDateInput
                className="erp-input erp-input-date"
                value={searchInput.dateFrom}
                placeholder="From"
                onChange={(dateFrom) => setSearchInput((prev) => ({ ...prev, dateFrom }))}
              />
              <span className="erp-search-date-sep" aria-hidden="true">
                 E              </span>
              <SearchDateInput
                className="erp-input erp-input-date"
                value={searchInput.dateTo}
                placeholder="To"
                onChange={(dateTo) => setSearchInput((prev) => ({ ...prev, dateTo }))}
              />
            </span>
          </SearchFilterField>
          <SearchFilterField
            className="erp-search-field-item"
            showApply={searchInput.item !== appliedSearch.item}
            onApply={() => applySearchField('item')}
            showClear={Boolean(appliedSearch.item.trim())}
            onClear={() => clearSearchField({ item: '' })}
          >
            <ErpSuggestInput
              value={searchInput.item}
              onChange={(item) => setSearchInput((prev) => ({ ...prev, item }))}
              placeholder="Item Code - Item Name"
              ariaLabel="Item Code - Item Name"
              variant="inline"
              fieldClassName="erp-suggest-in-filter"
              fetchSuggestions={fetchItemSuggestions}
            />
          </SearchFilterField>
          <SearchFilterField
            className="erp-search-field-lot"
            showApply={searchInput.lot !== appliedSearch.lot}
            onApply={() => applySearchField('lot')}
            showClear={Boolean(appliedSearch.lot.trim())}
            onClear={() => clearSearchField({ lot: '' })}
          >
            <ErpSuggestInput
              value={searchInput.lot}
              onChange={(lot) => setSearchInput((prev) => ({ ...prev, lot }))}
              placeholder="Lot"
              ariaLabel="Lot"
              variant="inline"
              fieldClassName="erp-suggest-in-filter"
              fetchSuggestions={fetchLotSuggestions}
            />
          </SearchFilterField>
        </div>
      </ErpSearchPanel>

      <ErpGridPanel
        gridId="production-orders-v6"
        hidePanelTitleBar
        panelClassName="erp-panel-orders-header"
        columns={productionOrderListColumns}
        loading={loading}
        isEmpty={!loading && orders.length === 0}
        selectColumnHeader={
          <GridRowSelectButtons
            rowCount={ordersGrid.displayRows.length}
            selectedCount={
              ordersGrid.displayRows.filter((r) =>
                selectedOrderIds.has(r.production_order_id)
              ).length
            }
            onSelectAll={() =>
              setSelectedOrderIds(
                new Set(ordersGrid.displayRows.map((r) => r.production_order_id))
              )
            }
            onClearSelection={() => setSelectedOrderIds(new Set())}
          />
        }
        toolbarLeft={
          <>
            <div className="erp-toolbar-select-tree">
              <label className="erp-toolbar-tree-toggle">
                Tree
                <input
                  type="checkbox"
                  checked={treeOnSelect}
                  onChange={(e) => handleTreeOnSelectChange(e.target.checked)}
                />
              </label>
            </div>
            {statusOptions.map((s) => (
              <button
                key={s.value || 'all'}
                type="button"
                className={`erp-tab ${statusFilter === s.value ? 'active' : ''}`}
                onClick={() => setStatusFilter(s.value)}
              >
                {s.label}
              </button>
            ))}
          </>
        }
        toolbarRight={
          <>
            {hasBulkSelection && (
              <>
                {bulkActionsForCancelled ? (
                  <>
                    <button
                      type="button"
                      className="btn erp-btn erp-btn-new"
                      disabled={submitting || bulkRestoreTargetCount === 0}
                      onClick={() => void handleBulkRestore()}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      className="btn erp-btn erp-btn-cancel"
                      disabled={submitting || bulkDeleteTargetCount === 0}
                      onClick={() => void handleBulkDelete()}
                    >
                      Delete
                    </button>
                  </>
                ) : bulkActionsForRegistered ? (
                  <>
                    <button
                      type="button"
                      className="btn erp-btn erp-btn-approve"
                      disabled={submitting || bulkOrderTargetCount === 0}
                      onClick={() => void handleBulkOrder()}
                    >
                      Order
                    </button>
                    <button
                      type="button"
                      className="btn erp-btn erp-btn-cancel"
                      disabled={submitting || bulkCancelTargetCount === 0}
                      onClick={() => void handleBulkCancel()}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {bulkOrderTargetCount > 0 && (
                      <button
                        type="button"
                        className="btn erp-btn erp-btn-approve"
                        disabled={submitting}
                        onClick={() => void handleBulkOrder()}
                      >
                        Order
                      </button>
                    )}
                    {bulkCancelTargetCount > 0 && (
                      <button
                        type="button"
                        className="btn erp-btn erp-btn-cancel"
                        disabled={submitting}
                        onClick={() => void handleBulkCancel()}
                      >
                        Cancel
                      </button>
                    )}
                    {bulkRestoreTargetCount > 0 && (
                      <button
                        type="button"
                        className="btn erp-btn erp-btn-new"
                        disabled={submitting}
                        onClick={() => void handleBulkRestore()}
                      >
                        Restore
                      </button>
                    )}
                    {bulkDeleteTargetCount > 0 && (
                      <button
                        type="button"
                        className="btn erp-btn erp-btn-cancel"
                        disabled={submitting}
                        onClick={() => void handleBulkDelete()}
                      >
                        Delete
                      </button>
                    )}
                  </>
                )}
              </>
            )}
            {!hasBulkSelection && selectedId && canApproveSelected && (
              <button
                type="button"
                className="btn erp-btn erp-btn-approve"
                disabled={submitting}
                onClick={() => void handleApprove()}
              >
                Order
              </button>
            )}
            {!hasBulkSelection && selectedId && canCancel && (
              <button
                type="button"
                className="btn erp-btn erp-btn-cancel"
                disabled={submitting}
                onClick={() => void handleCancel()}
              >
                Cancel
              </button>
            )}
            {!hasBulkSelection && selectedId && canRestore && (
              <button
                type="button"
                className="btn erp-btn erp-btn-new"
                disabled={submitting}
                onClick={() => void handleRestore()}
              >
                Restore
              </button>
            )}
            {!hasBulkSelection && selectedId && canDelete && (
              <button
                type="button"
                className="btn erp-btn erp-btn-cancel"
                disabled={submitting}
                onClick={() => void handleDelete()}
              >
                Delete
              </button>
            )}
          </>
        }
        onLayoutReady={handleOrderGridLayoutReady}
        onGridContextMenu={ordersGrid.openContextMenu}
        layoutOptions={{ pinFirst: ['rownum', 'select'] }}
        rowCount={ordersGrid.displayRows.length}
        {...ordersGrid.tableProps}
      >
        {(layout) => (
          <tbody>
            {ordersGrid.displayRows.map((row, index) => (
              <tr
                key={row.production_order_id}
                data-production-order-id={row.production_order_id}
                className={erpRowClass(index, selectedId === row.production_order_id)}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('input, select, button, textarea')) return
                  activateOrder(row)
                }}
                onDoubleClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  window.getSelection()?.removeAllRanges()
                  navigate(`/production/new?id=${row.production_order_id}`)
                }}
              >
                {layout.orderedColumns.map((col) => {
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
                            checked={selectedOrderIds.has(row.production_order_id)}
                            aria-label={`Select order ${row.production_order_id}`}
                            onChange={(e) => {
                              setSelectedOrderIds((prev) => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(row.production_order_id)
                                else next.delete(row.production_order_id)
                                return next
                              })
                              if (e.target.checked) activateOrder(row)
                            }}
                          />
                        </td>
                      )
                    case 'id':
                      return <td key={col.key}>{row.production_order_id}</td>
                    case 'status':
                      return (
                        <td key={col.key}>
                          <StatusBadge status={row.status} labels={productionStatusLabel} />
                        </td>
                      )
                    case 'production_date':
                      return <td key={col.key}>{formatDate(row.production_date)}</td>
                    case 'reference_no':
                      return (
                        <td key={col.key}>
                          {row.reference_no ?? '-'}
                        </td>
                      )
                    case 'source':
                      return (
                        <td key={col.key}>
                          {productionSourceLabel[row.source_type] ?? row.source_type}
                        </td>
                      )
                    case 'item_cd':
                      return (
                        <td key={col.key}>
                          <ColoredItemCode itemId={row.parent_item_id}>
                            {row.parent_item_cd}
                          </ColoredItemCode>
                        </td>
                      )
                    case 'item_nm':
                      return (
                        <td key={col.key}>
                          <ColoredItemName itemId={row.parent_item_id}>
                            {row.parent_item_nm}
                          </ColoredItemName>
                        </td>
                      )
                    case 'planned_qty':
                      return (
                        <td key={col.key} className="erp-col-num">
                          {formatQty(row.planned_qty)}
                        </td>
                      )
                    case 'actual_qty':
                      return (
                        <td
                          key={col.key}
                          className={
                            row.status === 'registered'
                              ? 'erp-col-num erp-grid-cell-readonly'
                              : 'erp-col-num'
                          }
                        >
                          {row.actual_qty != null ? formatQty(row.actual_qty) : '-'}
                        </td>
                      )
                    case 'lines':
                      return (
                        <td key={col.key}>
                          {row.completed_line_count}/{row.line_count}
                        </td>
                      )
                    case 'lot':
                      return <td key={col.key}>{row.lot}</td>
                    case 'created':
                      return <td key={col.key}>{formatDateTime(row.created_at)}</td>
                    case 'approved':
                      return <td key={col.key}>{formatDateTime(row.approved_at)}</td>
                    default:
                      return <td key={col.key} />
                  }
                })}
              </tr>
            ))}
          </tbody>
        )}
      </ErpGridPanel>

      <div className={`erp-production-detail-split${treeOnSelect ? ' has-tree' : ''}`}>
        <div className="erp-production-detail-main">
          {!detail || detailLoading ? (
            <div className="erp-panel erp-panel-grow erp-detail-panel">
              <div className="erp-panel-content erp-detail-content">
                <p className="muted erp-grid-empty">
                  {detailLoading ? 'Loading…' : 'Select an order.'}
                </p>
              </div>
            </div>
          ) : (
            <ProductionProcessInputPanels
              detail={detail}
              canEdit={canEditDetail}
              canEditPlan={canEditPlan}
              canEditActuals={canEditActuals}
              items={masterItems}
              locations={masterLocations}
              processRows={editProcessRows}
              inputRows={editInputRows}
              onProcessRowsChange={setEditProcessRows}
              onInputRowsChange={setEditInputRows}
              processRowError={processRowError}
              inputRowError={inputRowError}
              processStatusMessage={processStatusMessage}
              inputStatusMessage={inputStatusMessage}
              onSaveProcess={() => void handleSaveProcess()}
              onSaveInput={() => void handleSaveInput()}
              savingProcess={submitting && lineSaveTarget === 'process'}
              savingInput={submitting && lineSaveTarget === 'input'}
              lineGridId="production-lines-v4"
              inputGridId="production-inputs-v3"
              processEditGridId="production-lines-edit-v2"
              inputEditGridId="production-inputs-edit-v2"
              onGridLayoutsReady={handleProcessInputGridLayoutsReady}
              onTreeHighlightChange={setTreeHighlight}
              onTreeDataChange={handleTreeDataChange}
              onResetHandlerChange={handleResetHandlerChange}
            />
          )}
        </div>
        {treeOnSelect ? (
          <aside className="erp-production-detail-tree" aria-label="BOM tree">
            {treeTitle && treeLines.length > 0 ? (
              <BomTreePanel
                sidebar
                title={treeTitle}
                lines={treeLines}
                highlight={treeHighlight}
                onReset={handleResetProcessSelection}
              />
            ) : (
              <ProductionTreeSidebar title="Tree" onReset={handleResetProcessSelection}>
                <p className="muted erp-grid-empty">Select an order to show tree.</p>
              </ProductionTreeSidebar>
            )}
          </aside>
        ) : null}
      </div>
    </ErpScreen>
  )
}
