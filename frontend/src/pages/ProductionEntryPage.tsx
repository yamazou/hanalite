import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppLink, useAppNavigate, useAppViewRoute } from '../context/AppNavigateContext'
import { api } from '../api/client'
import { BomTreePanel } from '../components/BomTreePanel'
import { ProductionTreeSidebar } from '../components/ProductionTreeSidebar'
import { ProductionDetailSplit } from '../components/ProductionDetailSplit'
import { ProductionProcessInputPanels } from '../components/ProductionProcessInputPanels'
import { useProductionPanelSplitLayout } from '../hooks/useProductionPanelSplitLayout'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpSearchPanel } from '../components/erp/ErpSearchPanel'
import { ItemSearchPicker } from '../components/ItemSearchPicker'
import { PRODUCTION_ORDER_PARENT_ITEMTYP_CDS } from '../utils/itemTypDisplay'
import { useMasterCatalog } from '../context/MasterCatalogContext'
import type { ProductionOrderDetail } from '../types/production'
import type { ItemSearchRow } from '../types/masters'
import { parseDateInputValue, toDateInputValue } from '../utils/format'
import { ensureTrailingBlankRow } from '../utils/gridTrailingBlankRow'
import {
  bomPreviewToEditInputRowsWithTrailingBlanks,
  bomPreviewToEditProcessRows,
  buildInputPayload,
  buildProcessPayload,
  firstActiveProcessPlannedQty,
  createBlankProcessRowForDetail,
  detailToEditInputRows,
  detailToEditProcessRows,
  isActiveInputRow,
  isActiveProcessRow,
  isBlankInputRow,
  isBlankProcessRow,
  type EditInputRow,
  type EditProcessRow,
} from '../utils/productionEdit'
import { loadBomTreeForParent, type BomTreeLine, type BomTreeParent, type ProcessTreeHighlight } from '../utils/bomTree'
import { parentTreeHighlight } from '../utils/productionTreeHighlight'
import {
  buildProductionOrderTree,
  isSameProductionTreeData,
  type ProductionTreeData,
} from '../utils/productionOrderTree'

const emptyCreate = {
  production_date: toDateInputValue(),
  reference_no: '',
  parent_item_id: '',
  planned_qty: '',
  lot: '',
  notes: '',
}

const PANEL_SPLIT_LAYOUT_ID = 'production-entry-panels-v1'

export function ProductionEntryPage() {
  const navigate = useAppNavigate()
  const { search } = useAppViewRoute()
  const orderIdParam = new URLSearchParams(search).get('id')
  const orderId = orderIdParam ? Number(orderIdParam) : null
  const isEdit = orderId != null && !Number.isNaN(orderId)
  const { items, itemsMaster, locations } = useMasterCatalog()
  const [detail, setDetail] = useState<ProductionOrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState(emptyCreate)
  const [editProcessRows, setEditProcessRows] = useState<EditProcessRow[]>([])
  const [editInputRows, setEditInputRows] = useState<EditInputRow[]>([])
  const [lineRowError, setLineRowError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const processInputLayoutApiRef = useRef<{ saveLayouts: () => void; isDirty: boolean } | null>(
    null
  )
  const panelSplit = useProductionPanelSplitLayout(PANEL_SPLIT_LAYOUT_ID)
  const [processInputGridDirty, setProcessInputGridDirty] = useState(false)
  const [treeTitle, setTreeTitle] = useState<string | null>(null)
  const [treeLines, setTreeLines] = useState<BomTreeLine[]>([])
  const [treeOnSelect, setTreeOnSelect] = useState(true)
  const [treeHighlight, setTreeHighlight] = useState<ProcessTreeHighlight | null>(null)
  const treeLoadedForKeyRef = useRef<string | null>(null)

  const handleTreeDataChange = useCallback((data: ProductionTreeData) => {
    setTreeTitle((prev) => (prev === data.title ? prev : data.title))
    setTreeLines((prev) => (isSameProductionTreeData(data, data.title, prev) ? prev : data.lines))
  }, [])

  const canEditLines = isEdit && status === 'registered'

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    try {
      const row = await api.getProductionOrder(id)
      setDetail(row)
      setStatus(row.status)
      setCreateForm({
        production_date: parseDateInputValue(row.production_date),
        reference_no: row.reference_no ?? '',
        parent_item_id: String(row.parent_item_id),
        planned_qty: String(row.planned_qty),
        lot: row.lot,
        notes: row.notes ?? '',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load production order')
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        if (isEdit && orderId != null) {
          await loadDetail(orderId)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load production order')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [isEdit, orderId, loadDetail])

  useEffect(() => {
    if (!detail || !canEditLines) {
      setEditProcessRows([])
      setEditInputRows([])
      return
    }
    setEditProcessRows(
      ensureTrailingBlankRow(
        detailToEditProcessRows(detail),
        isBlankProcessRow,
        (rows) => createBlankProcessRowForDetail(rows)
      )
    )
    setEditInputRows(detailToEditInputRows(detail))
    setLineRowError(null)
  }, [detail?.production_order_id, detail?.status, canEditLines])

  const handleReload = useCallback(async () => {
    if (!isEdit || orderId == null) return
    setError(null)
    setSuccess(null)
    setLineRowError(null)
    await loadDetail(orderId)
  }, [isEdit, orderId, loadDetail])

  const handleProcessInputGridLayoutsReady = useCallback(
    (api: { saveLayouts: () => void; isDirty: boolean }) => {
      processInputLayoutApiRef.current = api
      setProcessInputGridDirty(api.isDirty)
    },
    []
  )

  const handleSaveGridLayouts = () => {
    panelSplit.saveLayout()
    processInputLayoutApiRef.current?.saveLayouts()
  }

  const saveGridIsDirty = panelSplit.isDirty || processInputGridDirty

  const showTreeForParent = useCallback(async (parent: BomTreeParent) => {
    if (!(parent.item_cd ?? '').trim()) return
    try {
      const { title, lines } = await loadBomTreeForParent(parent)
      setTreeTitle(title)
      setTreeLines(lines)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load BOM tree')
    }
  }, [])

  const resolveTreeParent = useCallback((): BomTreeParent | null => {
    if (detail) {
      return {
        item_cd: detail.parent_item_cd,
        item_nm: detail.parent_item_nm,
        item_id: detail.parent_item_id,
      }
    }
    if (createForm.parent_item_id === '') return null
    const item = items.find((row) => String(row.item_id) === createForm.parent_item_id)
    if (!item) return null
    return {
      item_cd: item.item_cd,
      item_nm: item.item_nm,
      item_id: item.item_id,
      itemtyp_id: item.itemtyp_id,
    }
  }, [detail, createForm.parent_item_id, items])

  const handleTreeOnSelectChange = useCallback(
    (enabled: boolean) => {
      setTreeOnSelect(enabled)
      if (!enabled) {
        setTreeTitle(null)
        setTreeLines([])
        treeLoadedForKeyRef.current = null
        return
      }
      treeLoadedForKeyRef.current = null
      const parent = resolveTreeParent()
      if (parent) void showTreeForParent(parent)
    },
    [resolveTreeParent, showTreeForParent]
  )

  useEffect(() => {
    if (detail) return
    const parent = resolveTreeParent()
    if (parent?.item_id) {
      setTreeHighlight(parentTreeHighlight(parent.item_id))
    } else {
      setTreeHighlight(null)
    }
  }, [detail, resolveTreeParent])

  useEffect(() => {
    if (!treeOnSelect) {
      treeLoadedForKeyRef.current = null
      return
    }
    if (detail) {
      return
    }
    const parent = resolveTreeParent()
    if (!parent?.item_cd?.trim()) {
      setTreeTitle(null)
      setTreeLines([])
      treeLoadedForKeyRef.current = null
      return
    }
    const key = `item-${parent.item_id ?? parent.item_cd}`
    if (treeLoadedForKeyRef.current === key) return
    treeLoadedForKeyRef.current = key
    void showTreeForParent(parent)
  }, [treeOnSelect, detail, resolveTreeParent, showTreeForParent])

  const handleProcessRowsChange = useCallback((rows: EditProcessRow[]) => {
    setEditProcessRows(rows)
  }, [])

  const handleInputRowsChange = useCallback((rows: EditInputRow[]) => {
    setEditInputRows(rows)
  }, [])

  const reloadFromBom = async () => {
    if (!orderId || !canEditLines || !detail) return
    if (
      !confirm(
        'Reload Process and Input Item from Item Processes into the grid? Changes are not saved until you click Update.'
      )
    ) {
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const planQty = Number(createForm.planned_qty)
      const preview = await api.previewProductionOrderFromBom(
        orderId,
        Number.isFinite(planQty) && planQty > 0 ? planQty : undefined
      )
      const orderPlannedQty =
        Number.isFinite(planQty) && planQty > 0 ? planQty : detail.planned_qty
      setLineRowError(null)
      const newProcessRows = ensureTrailingBlankRow(
        bomPreviewToEditProcessRows(preview.lines, detail.status),
        isBlankProcessRow,
        (rows) => createBlankProcessRowForDetail(rows)
      )
      const newInputRows = bomPreviewToEditInputRowsWithTrailingBlanks(
        preview.inputs,
        preview.lines.map((line) => line.line_no),
        detail.status,
        orderPlannedQty
      )
      setEditProcessRows(newProcessRows)
      setEditInputRows(newInputRows)
      const treeData = buildProductionOrderTree({
        detail,
        processRows: newProcessRows,
        inputRows: newInputRows,
        locations,
        items,
        useEditRows: true,
      })
      setTreeTitle(treeData.title)
      setTreeLines(treeData.lines)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reload from BOM')
    } finally {
      setSubmitting(false)
    }
  }

  const createOrder = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      if (isEdit && orderId != null) {
        let linesPayload
        let inputsPayload
        if (canEditLines) {
          const saveContext = {
            parentItemId: detail.parent_item_id,
            orderPlannedQty: detail.planned_qty,
          }
          const lines = buildProcessPayload(editProcessRows, items, saveContext)
          const inputs = buildInputPayload(editInputRows, {
            status: detail.status,
            orderPlannedQty: detail.planned_qty,
            processRows: editProcessRows,
          })
          const processRows = editProcessRows.filter((r) => !isBlankProcessRow(r))
          const activeInputRows = editInputRows.filter(isActiveInputRow)
          const partialInputRows = editInputRows.some(
            (r) => !isBlankInputRow(r) && !isActiveInputRow(r)
          )
          if (
            lines.length === 0 ||
            !processRows.every((r) => isActiveProcessRow(r, editProcessRows, items))
          ) {
            setLineRowError('line_validation')
            setSubmitting(false)
            return
          }
          if (partialInputRows || (activeInputRows.length > 0 && inputs.length === 0)) {
            setLineRowError('input_validation')
            setSubmitting(false)
            return
          }
          linesPayload = lines
          inputsPayload = inputs
        }
        const planFromProcess =
          linesPayload != null
            ? firstActiveProcessPlannedQty(editProcessRows, detail.planned_qty)
            : null
        const row = await api.updateProductionOrder(orderId, {
          production_date: createForm.production_date,
          reference_no: createForm.reference_no.trim() || null,
          planned_qty: planFromProcess ?? Number(createForm.planned_qty),
          lot: createForm.lot.trim(),
          notes: createForm.notes.trim() || null,
          ...(linesPayload != null ? { lines: linesPayload } : {}),
          ...(inputsPayload != null ? { inputs: inputsPayload } : {}),
        })
        setDetail(row)
        setStatus(row.status)
        setLineRowError(null)
      } else {
        if (createForm.parent_item_id === '') {
          setError('Select an item.')
          setSubmitting(false)
          return
        }
        const row = await api.createProductionOrder({
          production_date: createForm.production_date,
          reference_no: createForm.reference_no.trim() || null,
          parent_item_id: Number(createForm.parent_item_id),
          planned_qty: Number(createForm.planned_qty),
          lot: createForm.lot.trim(),
          notes: createForm.notes.trim() || null,
        })
        navigate(`/production/new?id=${row.production_order_id}`)
      }
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Failed to save production order')
    } finally {
      setSubmitting(false)
    }
  }

  const pageTitle = 'Production Order Entry'

  const selectedParentItem = useMemo((): ItemSearchRow | null => {
    if (isEdit && detail) {
      return {
        item_id: detail.parent_item_id,
        item_cd: detail.parent_item_cd,
        item_nm: detail.parent_item_nm,
        itemtyp_id: 0,
        itemtyp_nm: '',
      }
    }
    if (createForm.parent_item_id === '') return null
    const master = itemsMaster.find(
      (row) => String(row.item_id) === createForm.parent_item_id
    )
    if (!master) return null
    return {
      item_id: master.item_id,
      item_cd: master.item_cd,
      item_nm: master.item_nm,
      itemtyp_id: master.itemtyp_id,
      itemtyp_nm: master.itemtyp_nm,
    }
  }, [isEdit, detail, createForm.parent_item_id, itemsMaster])

  return (
    <ErpScreen
      error={error}
      success={success}
      className="erp-screen-stacked erp-screen-production-entry"
      title={pageTitle}
      onRefresh={
        isEdit && orderId != null ? () => void handleReload() : undefined
      }
      onSaveGrid={handleSaveGridLayouts}
      saveGridIsDirty={saveGridIsDirty}
    >
      <ErpSearchPanel className="erp-panel-production-entry-header">
        <div className="erp-production-entry-toolbar">
          <AppLink to="/production/orders" className="btn erp-btn erp-btn-clear">
            Back to list
          </AppLink>
          {isEdit && status && <span className="erp-search-section-label">Status: {status}</span>}
        </div>
        {loading ? (
          <p className="muted erp-grid-empty">Loading…</p>
        ) : (
          <form className="erp-search-form erp-search-form-production-entry" onSubmit={createOrder}>
            <div className="erp-production-entry-row">
              <label className="erp-search-field erp-search-field-date erp-search-field-with-label">
                <span className="bom-field-label">Production Date</span>
                <input
                  className="erp-input"
                  type="date"
                  value={createForm.production_date}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, production_date: e.target.value }))
                  }
                  required
                />
              </label>
              <label className="erp-search-field erp-search-field-reference erp-search-field-with-label">
                <span className="bom-field-label">Reference No.</span>
                <input
                  className="erp-input"
                  type="text"
                  value={createForm.reference_no}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, reference_no: e.target.value }))
                  }
                />
              </label>
            </div>
            <div className="erp-production-entry-row">
              <label className="erp-search-field erp-search-field-item erp-search-field-with-label">
                <span className="bom-field-label">Item</span>
                <ItemSearchPicker
                  hideLabel
                  label="Item"
                  value={selectedParentItem}
                  disabled={isEdit}
                  showInlineClear={false}
                  allowedItemtypCds={PRODUCTION_ORDER_PARENT_ITEMTYP_CDS}
                  onChange={(item) =>
                    setCreateForm((p) => ({
                      ...p,
                      parent_item_id: item ? String(item.item_id) : '',
                    }))
                  }
                />
              </label>
              <label className="erp-search-field erp-search-field-qty erp-search-field-with-label">
                <span className="bom-field-label">Plan Qty</span>
                <input
                  className="erp-input"
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={createForm.planned_qty}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, planned_qty: e.target.value }))
                  }
                  required
                />
              </label>
              <label className="erp-search-field erp-search-field-reference erp-search-field-with-label">
                <span className="bom-field-label">Lot</span>
                <input
                  className="erp-input"
                  value={createForm.lot}
                  onChange={(e) => setCreateForm((p) => ({ ...p, lot: e.target.value }))}
                  required
                />
              </label>
              <label className="erp-search-field erp-search-field-notes erp-search-field-with-label">
                <span className="bom-field-label">Note</span>
                <input
                  className="erp-input"
                  value={createForm.notes}
                  onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </label>
              <div className="erp-search-actions">
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
                <button className="btn erp-btn erp-btn-search" type="submit" disabled={submitting}>
                  {submitting ? 'Saving…' : isEdit ? 'Update' : 'Create'}
                </button>
                <AppLink to="/production/orders" className="btn erp-btn erp-btn-clear">
                  Cancel
                </AppLink>
              </div>
            </div>
          </form>
        )}
      </ErpSearchPanel>

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
            />
          ) : (
            <ProductionTreeSidebar title="Tree">
              <p className="muted erp-grid-empty">
                {isEdit ? 'Loading tree…' : 'Select an item to show BOM tree.'}
              </p>
            </ProductionTreeSidebar>
          )
        }
      >
          <ProductionProcessInputPanels
            detail={detail}
            loading={detailLoading}
            canEdit={canEditLines}
            hideInputActualQty
            hideInputFromLocation
            autoSelectProcess="last"
            items={items}
            locations={locations}
            processRows={editProcessRows}
            inputRows={editInputRows}
            onProcessRowsChange={handleProcessRowsChange}
            onInputRowsChange={handleInputRowsChange}
            rowError={lineRowError}
            emptyMessage={
              isEdit
                ? 'No process and input data.'
                : 'Create the order to view Process and Input Item from BOM.'
            }
            lineGridId="production-entry-lines-v4"
            inputGridId="production-entry-inputs-v3"
            processEditGridId="production-entry-process-edit-v4"
            inputEditGridId="production-entry-input-edit-v2"
            onGridLayoutsReady={handleProcessInputGridLayoutsReady}
            onTreeHighlightChange={setTreeHighlight}
            onTreeDataChange={detail ? handleTreeDataChange : undefined}
            onReloadFromItemProcesses={
              canEditLines && isEdit ? () => void reloadFromBom() : undefined
            }
            reloadingFromItemProcesses={submitting}
            processInputSplit={{
              processHeightRatio: panelSplit.layout.processHeightRatio,
              onProcessHeightRatioChange: panelSplit.setProcessHeightRatio,
            }}
          />
      </ProductionDetailSplit>
    </ErpScreen>
  )
}
