import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { TOOLBAR_HINT_AUTO_HIDE_MS } from '../constants/feedbackTiming'
import { useAppNavigate } from '../context/AppNavigateContext'
import { api } from '../api/client'
import { ErpGridPanel, erpRowClass } from '../components/erp/ErpGridPanel'
import { ErpScreen } from '../components/erp/ErpScreen'
import { productionOrderListEditColumns } from '../components/erp/masterGridColumns'
import { GridRowNumCell } from '../components/GridRowNumCell'
import { ProductionOrderHeaderGridCell } from '../components/ProductionOrderHeaderGridCells'
import { MasterGridToolbarActions } from '../components/masters/MasterGridToolbar'
import { ProductionDetailSplit } from '../components/ProductionDetailSplit'
import { ListDetailSplitLayout } from '../components/ListDetailSplitLayout'
import { ProductionProcessInputPanels } from '../components/ProductionProcessInputPanels'
import { useProductionPanelSplitLayout } from '../hooks/useProductionPanelSplitLayout'
import { GridRowSelectButtons } from '../components/GridRowSelectButtons'
import { BomTreePanel } from '../components/BomTreePanel'
import { ProductionTreeSidebar } from '../components/ProductionTreeSidebar'
import { TreeToolbarToggle } from '../components/TreeToolbarToggle'
import { useExcelLikeGrid } from '../hooks/useExcelLikeGrid'
import { useGridColumnLayout, type GridColumnLayout } from '../hooks/useGridColumnLayout'
import type { Item } from '../types'
import { useMasterCatalog } from '../context/MasterCatalogContext'
import { useItemTypColors } from '../context/ItemTypColorContext'
import type { ItemProcessesOut } from '../types/itemprocs'
import type {
  ProductionOrderDetail,
  ProductionOrderListItem,
  ProductionOrderUpdatePayload,
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
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../utils/gridTrailingBlankRow'
import { deleteSelectedConfirm, removeSelectedGridRows, savedCountMessage } from '../utils/gridRowChange'
import {
  aggregateProductionInputsFromOrders,
  aggregateTraceabilityInputRows,
  orderIdsMatchingInputColumnFilters,
} from '../utils/productionOrderInputAggregate'
import {
  buildProductionOrderExportBodyRows,
  downloadProductionOrderExcel,
} from '../utils/productionOrderExcel'
import {
  buildInputPayload,
  buildProcessPayload,
  createBlankProcessRowForDetail,
  detailToEditInputRows,
  detailToEditProcessRows,
  isActiveInputRow,
  isActiveProcessRow,
  isBlankInputRow,
  isBlankProcessRow,
  isProductionInputDirty,
  isProductionProcessDirty,
  itemProcessesToProductionEditRows,
  itemProcessesToProductionInputRows,
  type EditInputRow,
  type EditProcessRow,
} from '../utils/productionEdit'
import { type BomTreeLine, type ProcessTreeHighlight } from '../utils/bomTree'
import { loadWipItemProcessCache } from '../utils/loadWipItemProcessCache'
import {
  collectProductionOrderWipIds,
  isSameProductionTreeData,
  type ProductionTreeData,
} from '../utils/productionOrderTree'
import {
  buildCreateProductionOrderPayload,
  buildUpdateProductionOrderHeaderPayload,
  changedRegisteredHeaderOrderIds,
  emptyEditProductionOrderHeaderRow,
  filterProductionOrderParentItems,
  headerRowSnapshotsFromOrders,
  isActiveProductionOrderHeaderRow,
  isBlankProductionOrderHeaderRow,
  listOrderToEditHeaderRow,
  productionOrderHeaderRowSaveError,
  productionOrderHeaderMissingFieldsMessage,
  type EditProductionOrderHeaderRow,
  type ProductionOrderHeaderRowSnapshot,
} from '../utils/productionOrderListEdit'
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
      return row.reference_no?.trim() || '*'
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

const PANEL_SPLIT_LAYOUT_ID = 'production-orders-panels-v1'

export function ProductionOrdersPage() {
  const navigate = useAppNavigate()
  const [orders, setOrders] = useState<ProductionOrderListItem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ProductionOrderDetail | null>(null)
  const [statusFilter, setStatusFilter] = useState<'' | ProductionStatus>('registered')
  const showHeaderNewRows = statusFilter === 'registered'
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const { items: masterItems, locations: masterLocations, itemtyps } = useMasterCatalog()
  const { colorForItem } = useItemTypColors()
  const parentItemCatalog = useMemo(
    () => filterProductionOrderParentItems(masterItems, itemtyps),
    [masterItems, itemtyps]
  )
  const [headerNewRows, setHeaderNewRows] = useState<EditProductionOrderHeaderRow[]>(() => [
    emptyEditProductionOrderHeaderRow(),
  ])
  const [selectedHeaderNewRowKeys, setSelectedHeaderNewRowKeys] = useState<Set<string>>(
    () => new Set()
  )
  const [registeredHeaderEdits, setRegisteredHeaderEdits] = useState<
    Map<number, EditProductionOrderHeaderRow>
  >(() => new Map())
  const [savedRegisteredHeaderSnapshots, setSavedRegisteredHeaderSnapshots] = useState<
    Map<number, ProductionOrderHeaderRowSnapshot>
  >(() => new Map())
  const [headerRowError, setHeaderRowError] = useState<string | null>(null)
  const [headerSuccess, setHeaderSuccess] = useState<string | null>(null)
  const [editProcessRows, setEditProcessRows] = useState<EditProcessRow[]>([])
  const [editInputRows, setEditInputRows] = useState<EditInputRow[]>([])
  const [processRowError, setProcessRowError] = useState<string | null>(null)
  const [inputRowError, setInputRowError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [processStatusMessage, setProcessStatusMessage] = useState<string | null>(null)
  const [inputStatusMessage, setInputStatusMessage] = useState<string | null>(null)
  const [reloadingFromItemProcesses, setReloadingFromItemProcesses] = useState(false)
  const [reloadItemProcessesError, setReloadItemProcessesError] = useState<string | null>(null)
  const [reloadFromMasterNonce, setReloadFromMasterNonce] = useState(0)
  const [orderGridLayoutApi, setOrderGridLayoutApi] = useState<{
    saveLayout: () => void
    isDirty: boolean
  } | null>(null)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(() => new Set())
  /** Orders hidden by grid context-menu Delete row only (restored on reload). */
  const [gridHiddenOrderIds, setGridHiddenOrderIds] = useState<Set<number>>(() => new Set())
  const deleteHeaderRowsRef = useRef<() => void>(() => {})
  const [treeTitle, setTreeTitle] = useState<string | null>(null)
  const [treeLines, setTreeLines] = useState<BomTreeLine[]>([])
  const [treeOnSelect, setTreeOnSelect] = useState(true)
  const [treeHighlight, setTreeHighlight] = useState<ProcessTreeHighlight | null>(null)
  const [itemProcessCache, setItemProcessCache] = useState<Map<number, ItemProcessesOut>>(
    () => new Map()
  )
  const orderLayoutRef = useRef<GridColumnLayout | null>(null)
  const ordersGridRef = useRef<{ displayRows: ProductionOrderListItem[] } | null>(null)
  const detailRequestRef = useRef(0)
  const loadedDetailOrderIdRef = useRef<number | null>(null)
  const processInputLayoutApiRef = useRef<{ saveLayouts: () => void; isDirty: boolean } | null>(
    null
  )
  const panelSplit = useProductionPanelSplitLayout(PANEL_SPLIT_LAYOUT_ID)
  const [processInputGridDirty, setProcessInputGridDirty] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [orderTraceabilityEnabled, setOrderTraceabilityEnabled] = useState(false)
  const [inputColumnFilters, setInputColumnFilters] = useState<Record<string, Set<string>>>(
    {}
  )
  const [panelResetNonce, setPanelResetNonce] = useState(0)

  const handleInputColumnFiltersChange = useCallback(
    (filters: Record<string, Set<string>>) => {
      setInputColumnFilters(
        Object.fromEntries(
          Object.entries(filters).map(([key, values]) => [key, new Set(values)])
        )
      )
    },
    []
  )

  useEffect(() => {
    setInputColumnFilters({})
  }, [orderTraceabilityEnabled])
  const [allOrdersDetailCache, setAllOrdersDetailCache] = useState<
    Map<number, ProductionOrderDetail>
  >(() => new Map())
  const [loadingAllOrderInputs, setLoadingAllOrderInputs] = useState(false)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await api.listProductionOrders({
        status: statusFilter || undefined,
      })
      setOrders(rows)
      setGridHiddenOrderIds(new Set())
      setSelectedId((prev) => (prev && rows.some((r) => r.production_order_id === prev) ? prev : (rows[0]?.production_order_id ?? null)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load production orders')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    if (!showHeaderNewRows) setSelectedHeaderNewRowKeys(new Set())
  }, [showHeaderNewRows])

  useEffect(() => {
    if (!headerSuccess) return
    const timer = window.setTimeout(() => setHeaderSuccess(null), 4000)
    return () => window.clearTimeout(timer)
  }, [headerSuccess])

  useEffect(() => {
    if (!processStatusMessage) return
    const timer = window.setTimeout(
      () => setProcessStatusMessage(null),
      TOOLBAR_HINT_AUTO_HIDE_MS
    )
    return () => window.clearTimeout(timer)
  }, [processStatusMessage])

  const loadDetail = useCallback(async (orderId: number | null) => {
    setProcessStatusMessage(null)
    setInputStatusMessage(null)
    if (!orderId) {
      detailRequestRef.current += 1
      loadedDetailOrderIdRef.current = null
      setDetail(null)
      setDetailLoading(false)
      return
    }
    const requestId = detailRequestRef.current + 1
    detailRequestRef.current = requestId
    setDetailLoading(true)
    try {
      const row = await api.getProductionOrder(orderId)
      if (requestId !== detailRequestRef.current) return
      loadedDetailOrderIdRef.current = row.production_order_id
      setDetail(row)
    } catch (e) {
      if (requestId !== detailRequestRef.current) return
      loadedDetailOrderIdRef.current = null
      setError(e instanceof Error ? e.message : 'Failed to load order detail')
      setDetail(null)
    } finally {
      if (requestId === detailRequestRef.current) {
        setDetailLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  useEffect(() => {
    const edits = new Map<number, EditProductionOrderHeaderRow>()
    for (const order of orders) {
      if (order.status !== 'registered') continue
      edits.set(order.production_order_id, listOrderToEditHeaderRow(order))
    }
    setRegisteredHeaderEdits(edits)
    setSavedRegisteredHeaderSnapshots(headerRowSnapshotsFromOrders(orders))
  }, [orders])

  useEffect(() => {
    setSelectedOrderIds(new Set())
  }, [statusFilter])

  useEffect(() => {
    if (selectedId == null) {
      void loadDetail(null)
      return
    }
    if (loadedDetailOrderIdRef.current === selectedId) return
    void loadDetail(selectedId)
  }, [selectedId, orders, loadDetail])

  const canEditPlan = detail?.status === 'registered'
  const canEditActuals = detail?.status === 'approved'
  const canEditDetail = canEditPlan || canEditActuals

  useEffect(() => {
    if (!detail) return
    let cancelled = false
    const wipIds = collectProductionOrderWipIds({
      detail,
      inputRows: editInputRows,
      items: masterItems,
      itemtyps,
      useEditRows: canEditDetail,
    })
    void (async () => {
      const next = await loadWipItemProcessCache(wipIds, masterItems, itemtyps, new Map())
      if (!cancelled) {
        setItemProcessCache((prev) => {
          const merged = new Map(prev)
          for (const [itemId, data] of next) merged.set(itemId, data)
          return merged
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    detail?.production_order_id,
    detail?.status,
    editInputRows,
    masterItems,
    itemtyps,
    canEditDetail,
  ])

  useEffect(() => {
    if (!detail || !canEditDetail) {
      setEditProcessRows([])
      setEditInputRows([])
      return
    }
    setReloadItemProcessesError(null)
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
  }, [detail?.production_order_id, detail?.status, canEditDetail, canEditPlan])


  const statusOptions: Array<{ value: '' | ProductionStatus; label: string }> = [
    { value: '', label: 'All' },
    { value: 'registered', label: productionStatusLabel.registered },
    { value: 'approved', label: productionStatusLabel.approved },
    { value: 'completed', label: productionStatusLabel.completed },
  ]
  const visibleHeaderNewRows = showHeaderNewRows ? headerNewRows : []

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
  const bulkDeleteTargetCount = useMemo(
    () =>
      orders.filter(
        (r) => selectedOrderIds.has(r.production_order_id) && r.status === 'registered'
      ).length + (showHeaderNewRows ? selectedHeaderNewRowKeys.size : 0),
    [orders, selectedOrderIds, selectedHeaderNewRowKeys, showHeaderNewRows]
  )
  const hasBulkSelection = selectedOrderIds.size > 0
  const hasListSelection =
    hasBulkSelection || (showHeaderNewRows && selectedHeaderNewRowKeys.size > 0)

  const canReverseOrder = detail?.status === 'approved'
  const canDelete = detail?.status === 'registered'

  const handleReloadFromItemProcesses = useCallback(async () => {
    if (!detail || !canEditPlan) return
    if (editProcessRows.some((row) => row.status === 'completed')) {
      setReloadItemProcessesError('Cannot reload after a process step is completed.')
      return
    }
    if (
      !confirm(
        'Reload process and input rows from Item Process master? Current process/input edits in the grid will be replaced.'
      )
    ) {
      return
    }
    setReloadingFromItemProcesses(true)
    setReloadItemProcessesError(null)
    setProcessRowError(null)
    setInputRowError(null)
    setProcessStatusMessage(null)
    setInputStatusMessage(null)
    try {
      const data = await api.getItemProcesses(detail.parent_item_id)
      if (!data.processes.length) {
        setReloadItemProcessesError('No item processes are defined for this item.')
        return
      }
      const nextProcessRows = ensureTrailingBlankRow(
        itemProcessesToProductionEditRows(data, detail.planned_qty, detail.status),
        isBlankProcessRow,
        (rows) => createBlankProcessRowForDetail(rows)
      )
      const nextInputRows = itemProcessesToProductionInputRows(
        data,
        detail.status,
        detail.lot
      )
      setEditProcessRows(nextProcessRows)
      setEditInputRows(nextInputRows)
      setItemProcessCache((prev) => {
        const next = new Map(prev)
        next.set(detail.parent_item_id, data)
        return next
      })
      setReloadFromMasterNonce((n) => n + 1)
      setProcessStatusMessage('Reloaded from Item Process master.')
    } catch (e) {
      setReloadItemProcessesError(
        e instanceof Error ? e.message : 'Failed to reload from Item Process master'
      )
    } finally {
      setReloadingFromItemProcesses(false)
    }
  }, [detail, canEditPlan, editProcessRows])

  const handleDelete = async () => {
    if (!selectedId || detail?.status !== 'registered') return
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
        loadedDetailOrderIdRef.current = null
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
    const processSaveContext = {
      parentItemId: detail.parent_item_id,
      orderPlannedQty: detail.planned_qty,
    }
    if (detail.status === 'approved') {
      const lines = buildProcessPayload(editProcessRows, masterItems, processSaveContext)
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
    const lines = buildProcessPayload(editProcessRows, masterItems, processSaveContext)
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
    const inputSaveContext = {
      status: detail.status,
      orderPlannedQty: detail.planned_qty,
      processRows: editProcessRows,
    }
    const activeInputRows = editInputRows.filter(isActiveInputRow)
    const partialInputRows = editInputRows.some(
      (r) => !isBlankInputRow(r) && !isActiveInputRow(r)
    )
    if (detail.status === 'approved') {
      const inputs = buildInputPayload(editInputRows, inputSaveContext)
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
    const inputs = buildInputPayload(editInputRows, inputSaveContext)
    if (partialInputRows || (activeInputRows.length > 0 && inputs.length === 0)) {
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

  const saveSelectedOrderDirtyParts = useCallback(async (flags: {
    header: boolean
    process: boolean
    input: boolean
  }): Promise<boolean> => {
    if (!selectedId || !detail || !canEditDetail) return false
    if (!flags.header && !flags.process && !flags.input) return true

    const headerRow =
      flags.header && detail.status === 'registered'
        ? registeredHeaderEdits.get(selectedId)
        : undefined
    const orderPlannedQty = headerRow?.planned_qty ?? detail.planned_qty
    const parentItemId =
      headerRow && headerRow.parent_item_id !== ''
        ? Number(headerRow.parent_item_id)
        : detail.parent_item_id
    const processSaveContext = {
      parentItemId,
      orderPlannedQty,
    }
    const inputSaveContext = {
      status: detail.status,
      orderPlannedQty,
      processRows: editProcessRows,
    }
    const payload: ProductionOrderUpdatePayload = {}

    if (headerRow) {
      Object.assign(payload, buildUpdateProductionOrderHeaderPayload(headerRow))
    }

    if (flags.process) {
      if (detail.status === 'approved') {
        const lines = buildProcessPayload(editProcessRows, masterItems, processSaveContext)
        if (lines.length === 0) {
          setProcessRowError('process_validation')
          return false
        }
        payload.lines = lines
        setProcessRowError(null)
      } else if (detail.status === 'registered') {
        const processRows = editProcessRows.filter((r) => !isBlankProcessRow(r))
        const lines = buildProcessPayload(editProcessRows, masterItems, processSaveContext)
        if (lines.length === 0) {
          setProcessRowError('process_validation')
          return false
        }
        if (!processRows.every((r) => isActiveProcessRow(r, editProcessRows, masterItems))) {
          setProcessRowError('process_validation')
          return false
        }
        payload.lines = lines
        setProcessRowError(null)
        if (!flags.header) {
          payload.planned_qty = Number(detail.planned_qty)
          payload.lot = detail.lot
          payload.notes = detail.notes
        }
      } else {
        return false
      }
    }

    if (flags.input) {
      const activeInputRows = editInputRows.filter(isActiveInputRow)
      const partialInputRows = editInputRows.some(
        (r) => !isBlankInputRow(r) && !isActiveInputRow(r)
      )
      if (detail.status === 'approved') {
        const inputs = buildInputPayload(editInputRows, inputSaveContext)
        if (inputs.length === 0) {
          setInputRowError('input_validation')
          return false
        }
        payload.inputs = inputs
        setInputRowError(null)
      } else if (detail.status === 'registered') {
        const inputs = buildInputPayload(editInputRows, inputSaveContext)
        if (partialInputRows || (activeInputRows.length > 0 && inputs.length === 0)) {
          setInputRowError('input_validation')
          return false
        }
        payload.inputs = inputs
        setInputRowError(null)
      } else {
        return false
      }
    }

    try {
      const row = await api.updateProductionOrder(selectedId, payload)
      setDetail(row)
      if (flags.process) {
        setEditProcessRows(
          ensureTrailingBlankRow(
            detailToEditProcessRows(row),
            isBlankProcessRow,
            (rows) => createBlankProcessRowForDetail(rows)
          )
        )
      }
      if (flags.input) {
        setEditInputRows(detailToEditInputRows(row))
      }
      await loadOrders()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update production order')
      return false
    }
  }, [
    selectedId,
    detail,
    canEditDetail,
    registeredHeaderEdits,
    editProcessRows,
    editInputRows,
    masterItems,
    loadOrders,
  ])

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

  const handleReverseOrder = async () => {
    if (!selectedId || detail?.status !== 'approved') return
    if (
      !confirm(
        'Reverse this order to Registered? Posted process steps will be reversed.'
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
      setSuccess('Order reversed; production order is registered again.')
      await loadOrders()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reverse order')
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

  const handleBulkDelete = async () => {
    const savedTargets = orders.filter(
      (r) => selectedOrderIds.has(r.production_order_id) && r.status === 'registered'
    )
    const newRowKeys = showHeaderNewRows ? [...selectedHeaderNewRowKeys] : []
    if (savedTargets.length === 0 && newRowKeys.length === 0) return
    const total = savedTargets.length + newRowKeys.length
    if (!confirm(deleteSelectedConfirm(total, 'production order row(s)'))) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      if (newRowKeys.length > 0) {
        setHeaderNewRows((rows) =>
          ensureTrailingBlankRow(
            rows.filter((row) => !newRowKeys.includes(row.key)),
            isBlankProductionOrderHeaderRow,
            () => emptyEditProductionOrderHeaderRow()
          )
        )
        setSelectedHeaderNewRowKeys(new Set())
      }
      for (const row of savedTargets) {
        await api.deleteProductionOrder(row.production_order_id)
      }
      setSelectedOrderIds(new Set())
      if (savedTargets.length > 0) {
        setSuccess(`Deleted ${total} production order row(s).`)
        if (selectedId && savedTargets.some((r) => r.production_order_id === selectedId)) {
          setSelectedId(null)
          loadedDetailOrderIdRef.current = null
          setDetail(null)
        }
        await loadOrders()
      } else {
        setSuccess(`Removed ${newRowKeys.length} unsaved row(s).`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete production order')
    } finally {
      setSubmitting(false)
    }
  }

  const handleProcessInputGridLayoutsReady = useCallback(
    (api: { saveLayouts: () => void; isDirty: boolean }) => {
      processInputLayoutApiRef.current = api
      setProcessInputGridDirty(api.isDirty)
    },
    []
  )

  const handleTreeDataChange = useCallback((data: ProductionTreeData) => {
    setTreeTitle((prev) => (prev === data.title ? prev : data.title))
    setTreeLines((prev) => (isSameProductionTreeData(data, data.title, prev) ? prev : data.lines))
  }, [])

  const handleSaveAllGridLayouts = () => {
    orderGridLayoutApi?.saveLayout()
    panelSplit.saveLayout()
    processInputLayoutApiRef.current?.saveLayouts()
  }

  const saveGridIsDirty =
    panelSplit.isDirty ||
    processInputGridDirty ||
    Boolean(orderGridLayoutApi?.isDirty)

  const getOrderFilterValue = useCallback((row: ProductionOrderListItem, col: string) => {
    const cell = getOrderExportCell(row, col)
    return toFilterCellValue(cell === '' ? null : cell)
  }, [])

  const visibleOrders = useMemo(
    () => orders.filter((row) => !gridHiddenOrderIds.has(row.production_order_id)),
    [orders, gridHiddenOrderIds]
  )

  useEffect(() => {
    if (detail) {
      setAllOrdersDetailCache((prev) => {
        const next = new Map(prev)
        next.set(detail.production_order_id, detail)
        return next
      })
    }
  }, [detail])

  useEffect(() => {
    const orderIds = visibleOrders.map((row) => row.production_order_id)
    if (orderIds.length === 0) {
      setLoadingAllOrderInputs(false)
      return
    }
    let cancelled = false
    setLoadingAllOrderInputs(true)
    ;(async () => {
      try {
        const fetched = new Map<number, ProductionOrderDetail>()
        for (const orderId of orderIds) {
          if (cancelled) return
          try {
            fetched.set(orderId, await api.getProductionOrder(orderId))
          } catch {
            /* skip orders that fail to load */
          }
        }
        if (!cancelled) {
          setAllOrdersDetailCache((prev) => {
            const next = new Map(prev)
            for (const [id, row] of fetched) next.set(id, row)
            for (const id of [...next.keys()]) {
              if (!orderIds.includes(id)) next.delete(id)
            }
            return next
          })
        }
      } finally {
        if (!cancelled) setLoadingAllOrderInputs(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [visibleOrders])

  const allOrdersForHeaderFilter = useMemo(
    () =>
      visibleOrders
        .map((row) => allOrdersDetailCache.get(row.production_order_id))
        .filter((row): row is ProductionOrderDetail => row != null),
    [visibleOrders, allOrdersDetailCache]
  )

  useEffect(() => {
    if (allOrdersForHeaderFilter.length === 0) return
    const parentIds = [
      ...new Set(allOrdersForHeaderFilter.map((order) => order.parent_item_id)),
    ]
    let cancelled = false
    void (async () => {
      for (const itemId of parentIds) {
        if (cancelled) return
        let skip = false
        setItemProcessCache((prev) => {
          skip = prev.has(itemId)
          return prev
        })
        if (skip) continue
        try {
          const data = await api.getItemProcesses(itemId)
          if (cancelled) return
          setItemProcessCache((prev) => {
            if (prev.has(itemId)) return prev
            const next = new Map(prev)
            next.set(itemId, data)
            return next
          })
        } catch {
          /* skip items without process master */
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allOrdersForHeaderFilter])

  const aggregatedInputsForHeaderFilter = useMemo(() => {
    if (allOrdersForHeaderFilter.length === 0) return []
    if (orderTraceabilityEnabled) {
      return aggregateTraceabilityInputRows({
        orders: allOrdersForHeaderFilter,
        selectedOrderId: detail?.production_order_id ?? null,
        liveInputRows: detail && canEditPlan ? editInputRows : undefined,
        locations: masterLocations,
      })
    }
    return aggregateProductionInputsFromOrders({
      orders: allOrdersForHeaderFilter,
      selectedOrderId: detail?.production_order_id ?? null,
      liveInputRows: detail && canEditPlan ? editInputRows : undefined,
      locations: masterLocations,
    })
  }, [
    allOrdersForHeaderFilter,
    detail?.production_order_id,
    orderTraceabilityEnabled,
    canEditPlan,
    editInputRows,
    masterLocations,
  ])

  const headerOrderIdsFromInputFilter = useMemo(
    () => orderIdsMatchingInputColumnFilters(aggregatedInputsForHeaderFilter, inputColumnFilters),
    [aggregatedInputsForHeaderFilter, inputColumnFilters]
  )

  const ordersForHeaderGrid = useMemo(() => {
    if (!headerOrderIdsFromInputFilter) return visibleOrders
    return visibleOrders.filter((row) =>
      headerOrderIdsFromInputFilter.has(row.production_order_id)
    )
  }, [visibleOrders, headerOrderIdsFromInputFilter])

  /** Traceability grid + filter pick-list: all header-list orders (not narrowed by Input filters). */
  const allOrdersForInput = useMemo(() => {
    if (!orderTraceabilityEnabled) return []
    return allOrdersForHeaderFilter
  }, [orderTraceabilityEnabled, allOrdersForHeaderFilter])

  const showDetailPanels =
    !detailLoading &&
    (detail != null || (orderTraceabilityEnabled && visibleOrders.length > 0))

  const headerGridDeleteSelectionCount = useMemo(() => {
    const orderCount = ordersForHeaderGrid.filter((row) =>
      selectedOrderIds.has(row.production_order_id)
    ).length
    const headerCount = showHeaderNewRows
      ? headerNewRows.filter(
          (row, hi) =>
            selectedHeaderNewRowKeys.has(row.key) &&
            !(hi === headerNewRows.length - 1 && isBlankProductionOrderHeaderRow(row))
        ).length
      : 0
    return orderCount + headerCount
  }, [
    ordersForHeaderGrid,
    selectedOrderIds,
    headerNewRows,
    selectedHeaderNewRowKeys,
    showHeaderNewRows,
  ])

  const removeSelectedFromHeaderGrid = () => {
    const orderIdsToHide = ordersForHeaderGrid
      .filter((row) => selectedOrderIds.has(row.production_order_id))
      .map((row) => row.production_order_id)
    if (orderIdsToHide.length > 0) {
      setGridHiddenOrderIds((prev) => {
        const next = new Set(prev)
        for (const id of orderIdsToHide) next.add(id)
        return next
      })
      setRegisteredHeaderEdits((prev) => {
        const next = new Map(prev)
        for (const id of orderIdsToHide) next.delete(id)
        return next
      })
      if (selectedId != null && orderIdsToHide.includes(selectedId)) {
        setSelectedId(null)
        loadedDetailOrderIdRef.current = null
        setDetail(null)
      }
    }
    if (selectedHeaderNewRowKeys.size > 0) {
      setHeaderNewRows((rows) =>
        removeSelectedGridRows(
          rows,
          selectedHeaderNewRowKeys,
          isBlankProductionOrderHeaderRow,
          () => emptyEditProductionOrderHeaderRow()
        )
      )
    }
    setSelectedOrderIds(new Set())
    setSelectedHeaderNewRowKeys(new Set())
  }
  deleteHeaderRowsRef.current = removeSelectedFromHeaderGrid

  const runProductionListExport = useCallback(async () => {
    const ordersToExport = ordersGridRef.current?.displayRows ?? ordersForHeaderGrid
    if (ordersToExport.length === 0) return

    setExportingExcel(true)
    setError(null)
    try {
      const detailByOrderId = new Map<number, ProductionOrderDetail>()
      const liveEditsByOrderId = new Map<
        number,
        { processRows: EditProcessRow[]; inputRows: EditInputRow[] }
      >()

      if (selectedId != null && detail) {
        detailByOrderId.set(selectedId, detail)
        liveEditsByOrderId.set(selectedId, {
          processRows: editProcessRows,
          inputRows: editInputRows,
        })
      }

      for (const order of ordersToExport) {
        const orderId = order.production_order_id
        if (detailByOrderId.has(orderId)) continue
        try {
          detailByOrderId.set(orderId, await api.getProductionOrder(orderId))
        } catch {
          /* header-only row when detail cannot be loaded */
        }
      }

      const body = buildProductionOrderExportBodyRows({
        orders: ordersToExport,
        headerEdits: registeredHeaderEdits,
        detailByOrderId,
        liveEditsByOrderId,
        locations: masterLocations,
      })
      downloadProductionOrderExcel(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export production order list')
    } finally {
      setExportingExcel(false)
    }
  }, [
    ordersForHeaderGrid,
    selectedId,
    detail,
    editProcessRows,
    editInputRows,
    registeredHeaderEdits,
    masterLocations,
  ])

  const ordersGrid = useExcelLikeGrid({
    columns: productionOrderListEditColumns,
    rows: ordersForHeaderGrid,
    getFilterValue: getOrderFilterValue,
    rowDelete: {
      label: 'Delete row',
      getSelectedCount: () => headerGridDeleteSelectionCount,
      onDelete: () => deleteHeaderRowsRef.current(),
    },
    excelExport: {
      sheetName: 'Production Order List',
      filenamePrefix: 'production_orders',
      getExportValue: getOrderExportCell,
      runExport: () => void runProductionListExport(),
    },
  })
  ordersGridRef.current = ordersGrid

  useEffect(() => {
    if (!detail) {
      setTreeHighlight(null)
      if (treeOnSelect) {
        setTreeTitle(null)
        setTreeLines([])
      }
    }
  }, [detail?.production_order_id, treeOnSelect])

  const activateOrder = useCallback(
    (row: ProductionOrderListItem) => {
      if (selectedId === row.production_order_id) {
        void loadDetail(row.production_order_id)
        return
      }
      setSelectedId(row.production_order_id)
    },
    [selectedId, loadDetail]
  )

  const handleOrderRowFocusCapture = useCallback(
    (row: ProductionOrderListItem) => (e: FocusEvent<HTMLTableRowElement>) => {
      const el = e.target
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
        return
      }
      activateOrder(row)
    },
    [activateOrder]
  )

  const handleTreeOnSelectChange = useCallback((enabled: boolean) => {
    setTreeOnSelect(enabled)
    if (!enabled) {
      setTreeTitle(null)
      setTreeLines([])
    }
  }, [])

  const handleReload = useCallback(async () => {
    setError(null)
    setSuccess(null)
    setProcessRowError(null)
    setInputRowError(null)
    setProcessStatusMessage(null)
    setInputStatusMessage(null)
    setOrderTraceabilityEnabled(false)
    setInputColumnFilters({})
    setTreeOnSelect(true)
    ordersGrid.clearColumnFilters()
    setPanelResetNonce((n) => n + 1)
    await loadOrders()
    if (selectedId != null) {
      await loadDetail(selectedId)
    } else {
      loadedDetailOrderIdRef.current = null
      setDetail(null)
      setEditProcessRows([])
      setEditInputRows([])
    }
  }, [loadOrders, loadDetail, selectedId, ordersGrid.clearColumnFilters])

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

  const updateHeaderRow = useCallback(
    (key: string, patch: Partial<EditProductionOrderHeaderRow>) => {
      setHeaderNewRows((rows) =>
        updateRowWithTrailingBlank(
          rows,
          key,
          patch,
          isBlankProductionOrderHeaderRow,
          () => emptyEditProductionOrderHeaderRow()
        )
      )
      setHeaderRowError(null)
      setHeaderSuccess(null)
    },
    []
  )

  const updateRegisteredHeaderRow = useCallback(
    (orderId: number, patch: Partial<EditProductionOrderHeaderRow>) => {
      setRegisteredHeaderEdits((prev) => {
        const row = prev.get(orderId)
        if (!row) return prev
        const next = new Map(prev)
        next.set(orderId, { ...row, ...patch })
        return next
      })
      setHeaderRowError(null)
      setHeaderSuccess(null)
    },
    []
  )

  const commitHeaderSentinelOnEnter = useCallback((row: EditProductionOrderHeaderRow) => {
    setHeaderNewRows((rows) => {
      if (rows[rows.length - 1]?.key !== row.key) return rows
      if (isBlankProductionOrderHeaderRow(row)) return rows
      return ensureTrailingBlankRow(
        rows,
        isBlankProductionOrderHeaderRow,
        () => emptyEditProductionOrderHeaderRow()
      )
    })
  }, [])

  const handleHeaderCellKeyDown = useCallback(
    (e: KeyboardEvent, row: EditProductionOrderHeaderRow) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      commitHeaderSentinelOnEnter(row)
    },
    [commitHeaderSentinelOnEnter]
  )

  const handleUpdateHeaderOrders = useCallback(async () => {
    const saveError = showHeaderNewRows
      ? productionOrderHeaderRowSaveError(headerNewRows)
      : null
    if (saveError) {
      setHeaderRowError(saveError)
      return
    }
    const newActive = showHeaderNewRows
      ? headerNewRows.filter(isActiveProductionOrderHeaderRow)
      : []
    const toUpdate = changedRegisteredHeaderOrderIds(
      registeredHeaderEdits,
      savedRegisteredHeaderSnapshots
    )
    const changedSaveError = productionOrderHeaderMissingFieldsMessage(
      toUpdate
        .map((orderId) => registeredHeaderEdits.get(orderId))
        .filter((row): row is EditProductionOrderHeaderRow => row != null),
      'changed_order'
    )
    if (changedSaveError) {
      setHeaderRowError(changedSaveError)
      return
    }

    const selectedHeaderRow =
      selectedId != null ? registeredHeaderEdits.get(selectedId) : undefined
    const selectedOrderPlannedQty = selectedHeaderRow?.planned_qty ?? detail?.planned_qty
    const selectedHeaderDirty =
      selectedId != null && toUpdate.includes(selectedId)
    const processDirty =
      selectedId != null &&
      detail != null &&
      canEditDetail &&
      isProductionProcessDirty(
        detail,
        editProcessRows,
        masterItems,
        selectedOrderPlannedQty ?? detail.planned_qty
      )
    const inputDirty =
      selectedId != null &&
      detail != null &&
      canEditDetail &&
      isProductionInputDirty(
        detail,
        editInputRows,
        editProcessRows,
        selectedOrderPlannedQty ?? detail.planned_qty
      )
    const selectedNeedsSave =
      selectedId != null &&
      detail != null &&
      canEditDetail &&
      (selectedHeaderDirty || processDirty || inputDirty)
    const toUpdateOthers = toUpdate.filter((orderId) => orderId !== selectedId)

    if (newActive.length === 0 && toUpdateOthers.length === 0 && !selectedNeedsSave) {
      setHeaderRowError(null)
      const message = savedCountMessage(0, 'production order')
      setHeaderSuccess(message)
      return
    }
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    setHeaderRowError(null)
    setHeaderSuccess(null)
    setProcessStatusMessage(null)
    setInputStatusMessage(null)
    try {
      let lastTouchedId: number | null = null
      for (const orderId of toUpdateOthers) {
        const row = registeredHeaderEdits.get(orderId)!
        await api.updateProductionOrder(orderId, buildUpdateProductionOrderHeaderPayload(row))
        lastTouchedId = orderId
      }
      for (const row of newActive) {
        const created = await api.createProductionOrder(buildCreateProductionOrderPayload(row))
        lastTouchedId = created.production_order_id
      }
      if (selectedNeedsSave) {
        const ok = await saveSelectedOrderDirtyParts({
          header: selectedHeaderDirty,
          process: processDirty,
          input: inputDirty,
        })
        if (!ok) return
        lastTouchedId = selectedId
      }
      setHeaderNewRows([emptyEditProductionOrderHeaderRow()])
      setSelectedHeaderNewRowKeys(new Set())
      let savedCount = toUpdateOthers.length + newActive.length
      if (selectedNeedsSave) savedCount += 1
      const message = savedCountMessage(savedCount, 'production order')
      setHeaderSuccess(message)
      await loadOrders()
      if (lastTouchedId != null) {
        setSelectedId(lastTouchedId)
        await loadDetail(lastTouchedId)
      }
    } catch (e) {
      setHeaderRowError(e instanceof Error ? e.message : 'Failed to update production order')
    } finally {
      setSubmitting(false)
    }
  }, [
    headerNewRows,
    registeredHeaderEdits,
    savedRegisteredHeaderSnapshots,
    selectedId,
    detail,
    canEditDetail,
    editProcessRows,
    editInputRows,
    masterItems,
    loadOrders,
    loadDetail,
    saveSelectedOrderDirtyParts,
    showHeaderNewRows,
  ])

  const headerListRowCount =
    ordersGrid.displayRows.length + visibleHeaderNewRows.length
  const selectableOrderRows = ordersGrid.displayRows
  const selectableHeaderNewRows = visibleHeaderNewRows.filter(
    (row, hi) =>
      !(hi === visibleHeaderNewRows.length - 1 && isBlankProductionOrderHeaderRow(row))
  )
  const selectableListRowsCount = selectableOrderRows.length + selectableHeaderNewRows.length
  const selectableOrderSelectedCount = selectableOrderRows.filter((r) =>
    selectedOrderIds.has(r.production_order_id)
  ).length
  const selectableListSelectedCount =
    selectableOrderSelectedCount +
    (showHeaderNewRows ? selectedHeaderNewRowKeys.size : 0)

  return (
    <ErpScreen
      error={error}
      success={success}
      className="erp-screen-stacked erp-screen-production-list"
      title="Production Order List"
      onRefresh={() => void handleReload()}
      onSaveGrid={handleSaveAllGridLayouts}
      saveGridIsDirty={saveGridIsDirty}
    >
      {ordersGrid.filterMenuElement}
      {ordersGrid.contextMenuElement}
      <ListDetailSplitLayout
        listHeightRatio={panelSplit.layout.listHeightRatio}
        onListHeightRatioChange={panelSplit.setListHeightRatio}
        list={
      <ErpGridPanel
        gridId="production-orders-v6"
        titleBarStyle="section"
        panelClassName="erp-panel-orders-header"
        columns={productionOrderListEditColumns}
        loading={loading}
        isEmpty={!loading && orders.length === 0}
        selectColumnHeader={
          <GridRowSelectButtons
            rowCount={selectableListRowsCount}
            selectedCount={selectableListSelectedCount}
            onSelectAll={() => {
              setSelectedOrderIds(
                new Set(selectableOrderRows.map((r) => r.production_order_id))
              )
              if (showHeaderNewRows) {
                setSelectedHeaderNewRowKeys(
                  new Set(selectableHeaderNewRows.map((r) => r.key))
                )
              }
            }}
            onClearSelection={() => {
              setSelectedOrderIds(new Set())
              setSelectedHeaderNewRowKeys(new Set())
            }}
          />
        }
        titleActions={
          <div className="erp-production-order-header-actions">
            <div className="erp-production-order-header-actions-left">
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
              <div className="erp-toolbar-select-tree">
                <TreeToolbarToggle checked={treeOnSelect} onChange={handleTreeOnSelectChange} />
              </div>
            </div>
            <div className="erp-production-order-header-actions-right">
              <MasterGridToolbarActions
                submitting={submitting || exportingExcel}
                rowError={headerRowError}
                statusMessage={headerSuccess}
                onSave={() => void handleUpdateHeaderOrders()}
              />
              {hasListSelection && (
                <>
                  {bulkOrderTargetCount > 0 && (
                    <button
                      type="button"
                      className="btn erp-btn erp-btn-approve"
                      disabled={submitting || exportingExcel}
                      onClick={() => void handleBulkOrder()}
                    >
                      Order
                    </button>
                  )}
                  {bulkDeleteTargetCount > 0 && (
                    <button
                      type="button"
                      className="btn erp-btn erp-btn-cancel"
                      disabled={submitting || exportingExcel}
                      onClick={() => void handleBulkDelete()}
                    >
                      Delete
                    </button>
                  )}
                </>
              )}
              {!hasListSelection && selectedId && canApproveSelected && (
                <button
                  type="button"
                  className="btn erp-btn erp-btn-approve"
                  disabled={submitting || exportingExcel}
                  onClick={() => void handleApprove()}
                >
                  Order
                </button>
              )}
              {!hasListSelection && selectedId && canReverseOrder && (
                <button
                  type="button"
                  className="btn erp-btn erp-btn-cancel"
                  disabled={submitting || exportingExcel}
                  onClick={() => void handleReverseOrder()}
                >
                  Cancel
                </button>
              )}
              {!hasListSelection && selectedId && canDelete && (
                <button
                  type="button"
                  className="btn erp-btn erp-btn-cancel"
                  disabled={submitting || exportingExcel}
                  onClick={() => void handleDelete()}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        }
        onLayoutReady={handleOrderGridLayoutReady}
        onGridContextMenu={ordersGrid.openContextMenu}
        layoutOptions={{ pinFirst: ['rownum', 'select'] }}
        rowCount={headerListRowCount}
        {...ordersGrid.tableProps}
      >
        {(layout) => (
          <tbody>
            {ordersGrid.displayRows.map((row, index) => {
              const editRow =
                row.status === 'registered'
                  ? registeredHeaderEdits.get(row.production_order_id)
                  : undefined
              const headerEditable = editRow != null
              return (
              <tr
                key={row.production_order_id}
                data-production-order-id={row.production_order_id}
                className={`${erpRowClass(index, selectedId === row.production_order_id)}${
                  headerEditable ? ' erp-grid-row-editing' : ''
                }`}
                onFocusCapture={handleOrderRowFocusCapture(row)}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button, textarea, .erp-col-check')) return
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
                  if (headerEditable && editRow) {
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
                      case 'source':
                        return (
                          <td key={col.key}>
                            {productionSourceLabel[row.source_type] ?? row.source_type}
                          </td>
                        )
                      case 'actual_qty':
                        return (
                          <td key={col.key} className="erp-col-num erp-grid-cell-readonly">
                            {row.actual_qty != null ? formatQty(row.actual_qty) : '-'}
                          </td>
                        )
                      case 'lines':
                        return (
                          <td key={col.key}>
                            {row.completed_line_count}/{row.line_count}
                          </td>
                        )
                      case 'created':
                        return <td key={col.key}>{formatDateTime(row.created_at)}</td>
                      case 'approved':
                        return <td key={col.key}>{formatDateTime(row.approved_at)}</td>
                      default: {
                        const cell = ProductionOrderHeaderGridCell({
                          colKey: col.key,
                          row: editRow,
                          isBlank: false,
                          parentItemCatalog,
                          colorForItem,
                          itemReadOnly: false,
                          listIdPrefix: `production-list-order-${row.production_order_id}`,
                          onUpdate: (patch) =>
                            updateRegisteredHeaderRow(row.production_order_id, patch),
                        })
                        return cell ?? <td key={col.key} />
                      }
                    }
                  }
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
                          {row.reference_no?.trim() || '*'}
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
            )})}
            {visibleHeaderNewRows.map((row, hi) => {
              const index = ordersGrid.displayRows.length + hi
              const isSentinel =
                hi === visibleHeaderNewRows.length - 1 &&
                isBlankProductionOrderHeaderRow(row)
              const isBlank = isBlankProductionOrderHeaderRow(row)
              return (
                <tr
                  key={row.key}
                  className={`erp-grid-row-editing${index % 2 === 1 ? ' row-alt' : ''}${
                    isSentinel ? ' erp-grid-row-sentinel' : ''
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {layout.orderedColumns.map((col) => {
                    switch (col.key) {
                      case 'rownum':
                        return <GridRowNumCell key={col.key} index={index} />
                      case 'select':
                        if (isSentinel) {
                          return <td key={col.key} className="erp-col-check" />
                        }
                        return (
                          <td
                            key={col.key}
                            className="erp-col-check"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selectedHeaderNewRowKeys.has(row.key)}
                              aria-label={`Select new order row ${index + 1}`}
                              onChange={(e) => {
                                setSelectedHeaderNewRowKeys((prev) => {
                                  const next = new Set(prev)
                                  if (e.target.checked) next.add(row.key)
                                  else next.delete(row.key)
                                  return next
                                })
                              }}
                            />
                          </td>
                        )
                      case 'id':
                      case 'status':
                      case 'source':
                      case 'actual_qty':
                      case 'lines':
                      case 'created':
                      case 'approved':
                        return <td key={col.key} className="erp-grid-cell-readonly" />
                      default: {
                        const cell = ProductionOrderHeaderGridCell({
                          colKey: col.key,
                          row,
                          isBlank,
                          parentItemCatalog,
                          colorForItem,
                          itemReadOnly: false,
                          listIdPrefix: 'production-list-header',
                          onUpdate: (patch) => updateHeaderRow(row.key, patch),
                          onKeyDown: handleHeaderCellKeyDown,
                        })
                        return cell ?? <td key={col.key} />
                      }
                    }
                  })}
                </tr>
              )
            })}
          </tbody>
        )}
      </ErpGridPanel>
        }
        detail={
      <ProductionDetailSplit
        hasTree={treeOnSelect}
        treeWidthRatio={panelSplit.layout.treeWidthRatio}
        onTreeWidthRatioChange={panelSplit.setTreeWidthRatio}
        tree={
          treeTitle && treeLines.length > 0 ? (
            <BomTreePanel
              sidebar
              title={treeTitle}
              lines={treeLines}
              highlight={treeHighlight}
              expandMode="production-fg"
            />
          ) : (
            <ProductionTreeSidebar
              expandAll={false}
              expandAllDisabled
              onExpandAllChange={() => {}}
            >
              <p className="muted erp-grid-empty">Select an order to show tree.</p>
            </ProductionTreeSidebar>
          )
        }
      >
          {!showDetailPanels ? (
            <div className="erp-panel erp-panel-grow erp-detail-panel">
              <div className="erp-panel-content erp-detail-content erp-detail-content-split">
                <p className="muted erp-grid-empty">
                  {detailLoading || loadingAllOrderInputs
                    ? 'Loading…'
                    : 'Select an order.'}
                </p>
              </div>
            </div>
          ) : (
            <ProductionProcessInputPanels
              detail={detail}
              orderTraceabilityEnabled={orderTraceabilityEnabled}
              onOrderTraceabilityChange={setOrderTraceabilityEnabled}
              allOrdersForInput={allOrdersForInput}
              allOrdersForHeaderFilter={allOrdersForHeaderFilter}
              loadingAllOrderInputs={loadingAllOrderInputs}
              panelResetNonce={panelResetNonce}
              onInputColumnFiltersChange={
                orderTraceabilityEnabled ? handleInputColumnFiltersChange : undefined
              }
              canEdit={canEditDetail}
              canEditPlan={canEditPlan}
              canEditActuals={canEditActuals}
              hideInputFromLocation
              hideInputActualQty={detail.status === 'registered'}
              autoSelectProcess="last"
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
              onReloadFromItemProcesses={
                canEditPlan ? () => void handleReloadFromItemProcesses() : undefined
              }
              reloadingFromItemProcesses={reloadingFromItemProcesses}
              reloadItemProcessesError={reloadItemProcessesError}
              reloadFromMasterNonce={reloadFromMasterNonce}
              lineGridId="production-lines-v4"
              inputGridId="production-inputs-v3"
              processEditGridId="production-lines-edit-v2"
              inputEditGridId="production-inputs-edit-v2"
              onGridLayoutsReady={handleProcessInputGridLayoutsReady}
              onTreeHighlightChange={setTreeHighlight}
              onTreeDataChange={handleTreeDataChange}
              itemProcessCache={itemProcessCache}
              itemtyps={itemtyps}
              processInputSplit={{
                processHeightRatio: panelSplit.layout.processHeightRatio,
                onProcessHeightRatioChange: panelSplit.setProcessHeightRatio,
              }}
            />
          )}
      </ProductionDetailSplit>
        }
      />
    </ErpScreen>
  )
}
