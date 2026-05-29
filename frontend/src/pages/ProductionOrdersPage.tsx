import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppNavigate } from '../context/AppNavigateContext'
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
import type {
  ProductionOrderDetail,
  ProductionOrderListItem,
  ProductionStatus,
} from '../types/production'
import { StatusBadge } from '../components/StatusBadge'
import { formatDateTime, formatQty, statusLabel } from '../utils/format'

/** FG → WIP → Purchase parts → RM/Material (within the same BOM level). */
function itemtypSortKey(itemtypNm: string | undefined): number {
  const n = (itemtypNm ?? '').trim().toLowerCase()
  if (n === 'fg') return 0
  if (n === 'wip') return 1
  if (n.includes('purchase')) return 2
  if (n === 'rm' || n === 'material') return 3
  return 99
}

export function ProductionOrdersPage() {
  const navigate = useAppNavigate()
  const [orders, setOrders] = useState<ProductionOrderListItem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ProductionOrderDetail | null>(null)
  const [statusFilter, setStatusFilter] = useState<'' | ProductionStatus>('')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedProcessKey, setSelectedProcessKey] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [orderGridLayoutApi, setOrderGridLayoutApi] = useState<{
    saveLayout: () => void
    isDirty: boolean
  } | null>(null)
  const [gridHeaderEdits, setGridHeaderEdits] = useState<Record<number, { planned_qty: string; lot: string }>>({})

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
    void loadOrders()
  }, [loadOrders])

  useEffect(() => {
    void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  useEffect(() => {
    setSelectedProcessKey(null)
  }, [detail?.production_order_id])

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
  const selectedGridHeaderEdit = useMemo(
    () => (selectedId != null ? gridHeaderEdits[selectedId] : undefined),
    [gridHeaderEdits, selectedId]
  )

  const processGroups = useMemo(() => {
    if (!detail) return []
    const groups = new Map<
      string,
      {
        key: string
        no: number
        process: string
        status: 'planned' | 'completed'
        output: string
        actualQty: string | number | null
        lineNos: number[]
      }
    >()
    let nextNo = 1
    for (const ln of detail.lines) {
      const key = ln.process_nm
      const existing = groups.get(key)
      if (!existing) {
        groups.set(key, {
          key,
          no: nextNo++,
          process: ln.process_nm,
          status: ln.status,
          output: ln.output_item_cd ?? detail.parent_item_cd,
          actualQty: ln.actual_qty,
          lineNos: [ln.line_no],
        })
        continue
      }
      existing.lineNos.push(ln.line_no)
      if (existing.status !== 'planned' && ln.status === 'planned') {
        existing.status = 'planned'
      }
      if (existing.actualQty == null && ln.actual_qty != null) {
        existing.actualQty = ln.actual_qty
      }
    }
    return Array.from(groups.values())
  }, [detail])

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
          a.line_no - b.line_no,
      )
  }, [detail, selectedProcessKey, processGroups])

  const canApprove =
    detail?.status === 'registered' &&
    (detail?.line_count ?? 0) > 0 &&
    detail?.completed_line_count === detail?.line_count

  const canCancel = detail?.status === 'registered' || detail?.status === 'approved'
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
      const nextPlanned =
        selectedGridHeaderEdit != null
          ? Number(selectedGridHeaderEdit.planned_qty || detail.planned_qty)
          : Number(detail.planned_qty)
      const nextLot = selectedGridHeaderEdit?.lot?.trim() || detail.lot
      const row = await api.updateProductionOrder(selectedId, {
        planned_qty: nextPlanned,
        lot: nextLot,
        notes: detail.notes,
      })
      setDetail(row)
      setGridHeaderEdits((prev) => {
        const next = { ...prev }
        delete next[selectedId]
        return next
      })
      setSuccess('Saved.')
      await loadOrders()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save data')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveAllGridLayouts = () => {
    orderGridLayoutApi?.saveLayout()
    lineLayout.saveLayout()
    inputLayout.saveLayout()
    setSuccess('Grid layout saved.')
  }

  return (
    <ErpScreen error={error} success={success} className="erp-screen-stacked">
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
            {selectedId && canApprove && (
              <button
                type="button"
                className="btn erp-btn erp-btn-approve"
                disabled={submitting}
                onClick={() => void handleApprove()}
              >
                Approve
              </button>
            )}
            {selectedId && canCancel && (
              <button
                type="button"
                className="btn erp-btn erp-btn-cancel"
                disabled={submitting}
                onClick={() => void handleCancel()}
              >
                Cancel
              </button>
            )}
            {selectedId && canRestore && (
              <button
                type="button"
                className="btn erp-btn erp-btn-new"
                disabled={submitting}
                onClick={() => void handleRestore()}
              >
                Restore
              </button>
            )}
            {selectedId && canDelete && (
              <button
                type="button"
                className="btn erp-btn erp-btn-cancel"
                disabled={submitting}
                onClick={() => void handleDelete()}
              >
                Delete
              </button>
            )}
            {selectedId && detail?.status === 'registered' && (
              <button
                type="button"
                className="btn erp-btn erp-btn-search"
                disabled={submitting}
                onClick={() => void handleSaveData()}
              >
                Save Data
              </button>
            )}
            <button type="button" className="btn erp-btn erp-btn-search" onClick={handleSaveAllGridLayouts}>
              Save Grid
            </button>
          </>
        }
        onLayoutReady={(layout) => {
          setOrderGridLayoutApi((prev) =>
            prev && prev.saveLayout === layout.saveLayout && prev.isDirty === layout.isDirty
              ? prev
              : { saveLayout: layout.saveLayout, isDirty: layout.isDirty }
          )
        }}
        onRefresh={() => void loadOrders()}
      >
        {(layout) => (
          <tbody>
            {orders.map((row, index) => (
              <tr
                key={row.production_order_id}
                className={erpRowClass(index, selectedId === row.production_order_id)}
                onClick={() => setSelectedId(row.production_order_id)}
                onDoubleClick={(event) => {
                  event.stopPropagation()
                  navigate(`/production/new?id=${row.production_order_id}`)
                }}
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
                      return (
                        <td key={col.key}>
                          {selectedId === row.production_order_id && row.status === 'registered' ? (
                            <input
                              className="erp-input"
                              type="number"
                              step="0.001"
                              min="0.001"
                              value={
                                gridHeaderEdits[row.production_order_id]?.planned_qty ?? String(row.planned_qty)
                              }
                              onChange={(e) =>
                                setGridHeaderEdits((prev) => ({
                                  ...prev,
                                  [row.production_order_id]: {
                                    planned_qty: e.target.value,
                                    lot:
                                      prev[row.production_order_id]?.lot ??
                                      row.lot,
                                  },
                                }))
                              }
                            />
                          ) : (
                            formatQty(row.planned_qty)
                          )}
                        </td>
                      )
                    case 'actual_qty':
                      return <td key={col.key}>{row.actual_qty != null ? formatQty(row.actual_qty) : '-'}</td>
                    case 'lines':
                      return (
                        <td key={col.key}>
                          {row.completed_line_count}/{row.line_count}
                        </td>
                      )
                    case 'lot':
                      return (
                        <td key={col.key}>
                          {selectedId === row.production_order_id && row.status === 'registered' ? (
                            <input
                              className="erp-input"
                              value={gridHeaderEdits[row.production_order_id]?.lot ?? row.lot}
                              onChange={(e) =>
                                setGridHeaderEdits((prev) => ({
                                  ...prev,
                                  [row.production_order_id]: {
                                    planned_qty:
                                      prev[row.production_order_id]?.planned_qty ??
                                      String(row.planned_qty),
                                    lot: e.target.value,
                                  },
                                }))
                              }
                            />
                          ) : (
                            <code>{row.lot}</code>
                          )}
                        </td>
                      )
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
                    {processGroups.map((ln, idx) => (
                      <tr
                        key={ln.key}
                        className={erpRowClass(idx, selectedProcessKey === ln.key)}
                        onClick={() =>
                          setSelectedProcessKey((prev) => (prev === ln.key ? null : ln.key))
                        }
                      >
                        {lineLayout.orderedColumns.map((col) => {
                          switch (col.key) {
                            case 'line_no':
                              return <td key={col.key}>{ln.no}</td>
                            case 'process':
                              return (
                                <td key={col.key}>
                                  {ln.process}
                                </td>
                              )
                            case 'status':
                              return <td key={col.key}>{ln.status}</td>
                            case 'output':
                              return (
                                <td key={col.key}>
                                  <code>{ln.output}</code>
                                </td>
                              )
                            case 'actual_qty':
                              return (
                                <td key={col.key}>
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
                    ))}
                    </tbody>
                  </ResizableGridTable>
                </div>
              </section>

              <section className="erp-production-detail-section">
                <div className="erp-production-detail-section-title">Input</div>
                <div className="erp-grid-wrap erp-grid-wrap-static">
                  <ResizableGridTable layout={inputLayout}>
                    <tbody>
                    {visibleInputs.length === 0 ? (
                      <tr>
                        <td colSpan={inputLayout.orderedColumns.length} className="erp-grid-empty-cell">
                          {selectedProcessKey == null
                            ? 'Select a process to show input lines'
                            : 'No child items for selected process'}
                        </td>
                      </tr>
                    ) : (
                    visibleInputs.map((ln, idx) => (
                      <tr key={ln.prd_order_input_id} className={erpRowClass(idx)}>
                        {inputLayout.orderedColumns.map((col) => {
                          switch (col.key) {
                            case 'line_no':
                              return <td key={col.key}>{idx + 1}</td>
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
