import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { AppLink, useAppNavigate, useAppViewRoute } from '../context/AppNavigateContext'
import { api } from '../api/client'
import { BomTreePanel } from '../components/BomTreePanel'
import { ProductionTreeSidebar } from '../components/ProductionTreeSidebar'
import { ProductionProcessInputPanels } from '../components/ProductionProcessInputPanels'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpSearchPanel } from '../components/erp/ErpSearchPanel'
import { useMasterCatalog } from '../context/MasterCatalogContext'
import type { ProductionOrderDetail } from '../types/production'
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
  isBlankProcessRow,
  type EditInputRow,
  type EditProcessRow,
} from '../utils/productionEdit'
import { loadBomTreeForParent, type BomTreeLine, type BomTreeParent, type ProcessTreeHighlight } from '../utils/bomTree'
import { parentTreeHighlight } from '../utils/productionTreeHighlight'
import type { ProductionTreeData } from '../utils/productionOrderTree'

const emptyCreate = {
  production_date: toDateInputValue(),
  reference_no: '',
  parent_item_id: '',
  planned_qty: '',
  lot: '',
  notes: '',
}

export function ProductionEntryPage() {
  const navigate = useAppNavigate()
  const { search } = useAppViewRoute()
  const orderIdParam = new URLSearchParams(search).get('id')
  const orderId = orderIdParam ? Number(orderIdParam) : null
  const isEdit = orderId != null && !Number.isNaN(orderId)
  const { items, locations } = useMasterCatalog()
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
  const resetProcessSelectionRef = useRef<(() => void) | null>(null)
  const [treeTitle, setTreeTitle] = useState<string | null>(null)
  const [treeLines, setTreeLines] = useState<BomTreeLine[]>([])
  const [treeOnSelect, setTreeOnSelect] = useState(true)
  const [treeHighlight, setTreeHighlight] = useState<ProcessTreeHighlight | null>(null)
  const [treeFromBomMaster, setTreeFromBomMaster] = useState(false)
  const treeLoadedForKeyRef = useRef<string | null>(null)

  const handleTreeDataChange = useCallback((data: ProductionTreeData) => {
    setTreeTitle(data.title)
    setTreeLines(data.lines)
  }, [])

  const handleResetProcessSelection = useCallback(() => {
    resetProcessSelectionRef.current?.()
  }, [])

  const handleResetHandlerChange = useCallback((handler: (() => void) | null) => {
    resetProcessSelectionRef.current = handler
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
    const rmLocationId = locations.find((l) => l.location_type === 'RM')?.location_id ?? ''
    setEditProcessRows(
      ensureTrailingBlankRow(
        detailToEditProcessRows(detail),
        isBlankProcessRow,
        (rows) => createBlankProcessRowForDetail(rows)
      )
    )
    setEditInputRows(detailToEditInputRows(detail))
    setLineRowError(null)
    setTreeFromBomMaster(false)
  }, [detail?.production_order_id, detail?.updated_at, canEditLines])

  const handleProcessInputGridLayoutsReady = useCallback(
    (api: { saveLayouts: () => void; isDirty: boolean }) => {
      processInputLayoutApiRef.current = api
    },
    []
  )

  const handleSaveGridLayouts = () => {
    processInputLayoutApiRef.current?.saveLayouts()
  }

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
    setTreeFromBomMaster(false)
    setEditProcessRows(rows)
  }, [])

  const handleInputRowsChange = useCallback((rows: EditInputRow[]) => {
    setTreeFromBomMaster(false)
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
      setTreeFromBomMaster(true)
      setEditProcessRows(
        ensureTrailingBlankRow(
          bomPreviewToEditProcessRows(preview.lines, detail.status),
          isBlankProcessRow,
          (rows) => createBlankProcessRowForDetail(rows)
        )
      )
      setEditInputRows(
        bomPreviewToEditInputRowsWithTrailingBlanks(
          preview.inputs,
          preview.lines.map((line) => line.line_no),
          detail.status,
          orderPlannedQty
        )
      )
      const { title, lines } = await loadBomTreeForParent({
        item_cd: detail.parent_item_cd,
        item_nm: detail.parent_item_nm,
        item_id: detail.parent_item_id,
      })
      setTreeTitle(title)
      setTreeLines(lines)
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
          const lines = buildProcessPayload(editProcessRows, items)
          const inputs = buildInputPayload(editInputRows, {
            status: detail.status,
            orderPlannedQty: detail.planned_qty,
          })
          const processRows = editProcessRows.filter((r) => !isBlankProcessRow(r))
          if (
            lines.length === 0 ||
            inputs.length === 0 ||
            !processRows.every((r) => isActiveProcessRow(r, editProcessRows, items)) ||
            !editInputRows.some(isActiveInputRow)
          ) {
            setLineRowError('line_validation')
            setSubmitting(false)
            return
          }
          linesPayload = lines
          inputsPayload = inputs
        }
        const planFromProcess =
          linesPayload != null ? firstActiveProcessPlannedQty(editProcessRows) : null
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

  const pageTitle =
    isEdit && orderId != null ? `Production Order Entry #${orderId}` : 'Production Order Entry'

  return (
    <ErpScreen
      error={error}
      success={success}
      className="erp-screen-stacked"
      title={pageTitle}
      onRefresh={
        isEdit && orderId != null ? () => void loadDetail(orderId) : undefined
      }
      onSaveGrid={isEdit ? handleSaveGridLayouts : undefined}
    >
      <ErpSearchPanel>
        <div className="erp-search-form">
          <AppLink to="/production/orders" className="btn erp-btn erp-btn-clear">
            Back to list
          </AppLink>
          {isEdit && status && <span className="erp-search-section-label">Status: {status}</span>}
        </div>
      </ErpSearchPanel>

      {loading ? (
        <p className="muted erp-grid-empty">Loading…</p>
      ) : (
        <ErpSearchPanel className="erp-panel-master-form">
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
                <select
                  className={`erp-input${createForm.parent_item_id === '' ? ' erp-input-empty' : ''}`}
                  value={createForm.parent_item_id}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, parent_item_id: e.target.value }))
                  }
                  disabled={isEdit}
                  required
                >
                  <option value="">Select...</option>
                  {items.map((i) => (
                    <option key={i.item_id} value={i.item_id}>
                      {i.item_cd} / {i.item_nm}
                    </option>
                  ))}
                </select>
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
                {canEditLines && (
                  <button
                    className="btn erp-btn erp-btn-clear"
                    type="button"
                    disabled={submitting}
                    onClick={() => void reloadFromBom()}
                  >
                    Reload from Item Processes
                  </button>
                )}
                <button className="btn erp-btn erp-btn-search" type="submit" disabled={submitting}>
                  {submitting ? 'Saving…' : isEdit ? 'Update' : 'Create'}
                </button>
                <AppLink to="/production/orders" className="btn erp-btn erp-btn-clear">
                  Cancel
                </AppLink>
              </div>
            </div>
          </form>
        </ErpSearchPanel>
      )}

      <div className={`erp-production-detail-split${treeOnSelect ? ' has-tree' : ''}`}>
        <div className="erp-production-detail-main">
          <ProductionProcessInputPanels
            detail={detail}
            loading={detailLoading}
            canEdit={canEditLines}
            autoSelectFirstProcess={false}
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
            processEditGridId="production-entry-process-edit-v2"
            inputEditGridId="production-entry-input-edit-v2"
            onGridLayoutsReady={handleProcessInputGridLayoutsReady}
            onTreeHighlightChange={setTreeHighlight}
            onTreeDataChange={
              detail && !treeFromBomMaster ? handleTreeDataChange : undefined
            }
            onResetHandlerChange={handleResetHandlerChange}
          />
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
                <p className="muted erp-grid-empty">
                  {isEdit ? 'Loading tree…' : 'Select an item to show BOM tree.'}
                </p>
              </ProductionTreeSidebar>
            )}
          </aside>
        ) : null}
      </div>
    </ErpScreen>
  )
}
