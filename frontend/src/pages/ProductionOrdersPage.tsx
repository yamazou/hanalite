import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { ErpGridPanel, erpRowClass } from '../components/erp/ErpGridPanel'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpSearchPanel } from '../components/erp/ErpSearchPanel'
import {
  productionInputColumns,
  productionLineColumns,
  productionOrderColumns,
} from '../components/erp/masterGridColumns'
import { ResizableGridTable } from '../components/ResizableGridTable'
import { useGridColumnLayout } from '../hooks/useGridColumnLayout'
import type { Item } from '../types'
import type {
  ProductionOrderDetail,
  ProductionOrderListItem,
  ProductionStatus,
} from '../types/production'
import { StatusBadge } from '../components/StatusBadge'
import { formatDateTime, formatQty, statusLabel } from '../utils/format'

const emptyCreate = {
  parent_item_id: '',
  planned_qty: '',
  lot: '',
  notes: '',
}

export function ProductionOrdersPage() {
  const [orders, setOrders] = useState<ProductionOrderListItem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ProductionOrderDetail | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [statusFilter, setStatusFilter] = useState<'' | ProductionStatus>('')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState(emptyCreate)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await api.listProductionOrders(statusFilter || undefined)
      setOrders(rows)
      setSelectedId((prev) => (prev && rows.some((r) => r.production_order_id === prev) ? prev : (rows[0]?.production_order_id ?? null)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load production orders')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  const loadDetail = useCallback(async (orderId: number | null) => {
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
    api.listItems().then(setItems).catch(() => {})
  }, [])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  useEffect(() => {
    void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const lineLayout = useGridColumnLayout('production-lines-v1', productionLineColumns)
  const inputLayout = useGridColumnLayout('production-inputs-v1', productionInputColumns)

  const statusOptions: Array<{ value: '' | ProductionStatus; label: string }> = [
    { value: '', label: 'All' },
    { value: 'registered', label: statusLabel.registered },
    { value: 'approved', label: statusLabel.approved },
    { value: 'cancelled', label: statusLabel.cancelled },
  ]

  const selectedOrder = useMemo(
    () => orders.find((r) => r.production_order_id === selectedId) ?? null,
    [orders, selectedId]
  )

  const canApprove =
    detail?.status === 'registered' &&
    (detail?.line_count ?? 0) > 0 &&
    detail?.completed_line_count === detail?.line_count

  const canCancel = detail?.status === 'registered' || detail?.status === 'approved'

  const createOrder = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const created = await api.createProductionOrder({
        parent_item_id: Number(createForm.parent_item_id),
        planned_qty: Number(createForm.planned_qty),
        lot: createForm.lot.trim(),
        notes: createForm.notes.trim() || null,
      })
      setCreateForm(emptyCreate)
      setSuccess(
        `Production order #${created.production_order_id} created with ${created.lines.length} process step(s).`
      )
      await loadOrders()
      setSelectedId(created.production_order_id)
      await loadDetail(created.production_order_id)
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Failed to create production order')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (orderId: number) => {
    if (!confirm('Delete this production order?')) return
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

  const handleApprove = async () => {
    if (!selectedId) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const row = await api.approveProductionOrder(selectedId)
      setDetail(row)
      setSuccess('Production order approved.')
      await loadOrders()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async () => {
    if (!selectedId) return
    if (!confirm('Cancel this production order?')) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const row = await api.cancelProductionOrder(selectedId)
      setDetail(row)
      setSuccess(
        row.status === 'registered'
          ? 'Approval reversed; order is registered again.'
          : 'Production order cancelled.'
      )
      await loadOrders()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveData = async () => {
    if (!selectedId || !detail || detail.status !== 'registered') return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const row = await api.updateProductionOrder(selectedId, {
        planned_qty: Number(detail.planned_qty),
        lot: detail.lot,
        notes: detail.notes,
      })
      setDetail(row)
      setSuccess('Saved.')
      await loadOrders()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save data')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ErpScreen error={error} success={success} className="erp-screen-stacked">
      <ErpSearchPanel>
        <form className="erp-search-form" onSubmit={createOrder}>
          <span className="erp-search-section-label">Create Order</span>
          <label className="erp-search-field erp-search-field-item">
            <select
              className={`erp-input${createForm.parent_item_id === '' ? ' erp-input-empty' : ''}`}
              value={createForm.parent_item_id}
              onChange={(e) => setCreateForm((p) => ({ ...p, parent_item_id: e.target.value }))}
              required
            >
              <option value="">FG Item</option>
              {items.map((i) => (
                <option key={i.item_id} value={i.item_id}>
                  {i.item_cd} / {i.item_nm}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-search-field erp-search-field-qty">
            <input
              className="erp-input"
              type="number"
              step="0.001"
              min="0.001"
              placeholder="Plan Qty"
              value={createForm.planned_qty}
              onChange={(e) => setCreateForm((p) => ({ ...p, planned_qty: e.target.value }))}
              required
            />
          </label>
          <label className="erp-search-field erp-search-field-reference">
            <input
              className="erp-input"
              placeholder="Lot"
              value={createForm.lot}
              onChange={(e) => setCreateForm((p) => ({ ...p, lot: e.target.value }))}
              required
            />
          </label>
          <label className="erp-search-field erp-search-field-grow">
            <input
              className="erp-input"
              placeholder="Notes"
              value={createForm.notes}
              onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </label>
          <div className="erp-search-actions">
            <button className="btn erp-btn erp-btn-search" type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Create'}
            </button>
          </div>
        </form>
      </ErpSearchPanel>

      <ErpGridPanel
        gridId="production-orders-v1"
        panelClassName="erp-panel-orders-header"
        columns={productionOrderColumns}
        loading={loading}
        isEmpty={!loading && orders.length === 0}
        toolbarLeft={statusOptions.map((s) => (
          <button
            key={s.value || 'all'}
            type="button"
            className={`erp-tab ${statusFilter === s.value ? 'active' : ''}`}
            onClick={() => setStatusFilter(s.value)}
          >
            {s.label}
          </button>
        ))}
        toolbarRight={
          <>
            {selectedId && (
              <button
                type="button"
                className="btn erp-btn erp-btn-approve"
                disabled={!canApprove || submitting}
                onClick={() => void handleApprove()}
              >
                Approve
              </button>
            )}
            {selectedId && (
              <button
                type="button"
                className="btn erp-btn erp-btn-cancel"
                disabled={!canCancel || submitting}
                onClick={() => void handleCancel()}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              className="btn erp-btn erp-btn-search"
              disabled={!selectedId || detail?.status !== 'registered' || submitting}
              onClick={() => void handleSaveData()}
            >
              Save Data
            </button>
          </>
        }
        showSaveGridButton
        onRefresh={() => void loadOrders()}
      >
        {(layout) => (
          <tbody>
            {orders.map((row, index) => (
              <tr
                key={row.production_order_id}
                className={erpRowClass(index, selectedId === row.production_order_id)}
                onClick={() => setSelectedId(row.production_order_id)}
              >
                {layout.orderedColumns.map((col) => {
                  switch (col.key) {
                    case 'id':
                      return <td key={col.key}>{row.production_order_id}</td>
                    case 'status':
                      return (
                        <td key={col.key}>
                          <StatusBadge status={row.status} />
                        </td>
                      )
                    case 'parent':
                      return <td key={col.key}><code>{row.parent_item_cd}</code> {row.parent_item_nm}</td>
                    case 'planned_qty':
                      return <td key={col.key}>{formatQty(row.planned_qty)}</td>
                    case 'actual_qty':
                      return <td key={col.key}>{row.actual_qty != null ? formatQty(row.actual_qty) : '-'}</td>
                    case 'lines':
                      return (
                        <td key={col.key}>
                          {row.completed_line_count}/{row.line_count}
                        </td>
                      )
                    case 'lot':
                      return <td key={col.key}><code>{row.lot}</code></td>
                    case 'created':
                      return <td key={col.key}>{formatDateTime(row.created_at)}</td>
                    case 'approved':
                      return <td key={col.key}>{formatDateTime(row.approved_at)}</td>
                    case 'actions':
                      return (
                        <td key={col.key} className="erp-col-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn erp-btn erp-btn-cancel"
                            type="button"
                            disabled={
                              submitting ||
                              row.status === 'approved' ||
                              row.status === 'cancelled' ||
                              row.completed_line_count > 0
                            }
                            onClick={() => void handleDelete(row.production_order_id)}
                          >
                            Delete
                          </button>
                        </td>
                      )
                    default:
                      return <td key={col.key} />
                  }
                })}
              </tr>
            ))}
          </tbody>
        )}
      </ErpGridPanel>

      <div className="erp-panel erp-panel-grow erp-detail-panel">
        <div className="erp-panel-content erp-detail-content">
          {!detail || detailLoading ? (
            <p className="muted erp-grid-empty">{detailLoading ? 'Loading…' : 'Select an order.'}</p>
          ) : (
            <>
              <section className="erp-production-detail-section">
                <div className="erp-production-detail-section-title">Process</div>
                <div className="erp-grid-wrap erp-grid-wrap-static">
                  <ResizableGridTable layout={lineLayout}>
                    <tbody>
                    {detail.lines.map((ln, idx) => (
                      <tr
                        key={ln.prd_order_line_id}
                        className={erpRowClass(idx)}
                      >
                        {lineLayout.orderedColumns.map((col) => {
                          switch (col.key) {
                            case 'line_no':
                              return <td key={col.key}>{ln.line_no}</td>
                            case 'process':
                              return (
                                <td key={col.key}>
                                  {ln.process_nm}
                                </td>
                              )
                            case 'input':
                              return (
                                <td key={col.key}>
                                  <code>{ln.line_no === 1 ? (detail.inputs[0]?.item_cd ?? 'RM') : 'WIP'}</code>
                                </td>
                              )
                            case 'from':
                              return <td key={col.key}>{ln.rm_location_cd}</td>
                            case 'to':
                              return <td key={col.key}>{ln.wip_location_cd}</td>
                            case 'status':
                              return <td key={col.key}>{ln.status}</td>
                            case 'output':
                              return (
                                <td key={col.key}>
                                  <code>{detail.inputs[0]?.item_cd ?? 'WIP'}</code>
                                </td>
                              )
                            case 'actual_qty':
                              return (
                                <td key={col.key}>
                                  {ln.actual_qty != null ? formatQty(ln.actual_qty) : '-'}
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
                    ))}
                    </tbody>
                  </ResizableGridTable>
                </div>
              </section>

              <section className="erp-production-detail-section">
                <div className="erp-production-detail-section-title">Input (RM) — first step</div>
                <div className="erp-grid-wrap erp-grid-wrap-static">
                  <ResizableGridTable layout={inputLayout}>
                    <tbody>
                    {detail.inputs.length === 0 ? (
                      <tr>
                        <td colSpan={inputLayout.orderedColumns.length} className="erp-grid-empty-cell">
                          No input lines
                        </td>
                      </tr>
                    ) : (
                    detail.inputs.map((ln, idx) => (
                      <tr key={ln.prd_order_input_id} className={erpRowClass(idx)}>
                        {inputLayout.orderedColumns.map((col) => {
                          switch (col.key) {
                            case 'line_no':
                              return <td key={col.key}>{ln.line_no}</td>
                            case 'item':
                              return <td key={col.key}><code>{ln.item_cd}</code> {ln.item_nm}</td>
                            case 'req_qty':
                              return <td key={col.key}>{formatQty(ln.req_qty)}</td>
                            case 'consume_qty':
                              return <td key={col.key}>{formatQty(ln.consume_qty)}</td>
                            case 'lot':
                              return <td key={col.key}><code>{ln.lot || detail.lot}</code></td>
                            default:
                              return <td key={col.key} />
                          }
                        })}
                      </tr>
                    )))}
                    </tbody>
                  </ResizableGridTable>
                </div>
              </section>

            </>
          )}
        </div>
      </div>
    </ErpScreen>
  )
}
