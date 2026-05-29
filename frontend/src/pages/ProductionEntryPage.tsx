import { FormEvent, useCallback, useEffect, useState } from 'react'
import { AppLink, useAppNavigate, useAppViewRoute } from '../context/AppNavigateContext'
import { api } from '../api/client'
import { ProductionProcessInputPanels } from '../components/ProductionProcessInputPanels'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpSearchPanel } from '../components/erp/ErpSearchPanel'
import type { Item } from '../types'
import type { ProductionOrderDetail } from '../types/production'
import { parseDateInputValue, toDateInputValue } from '../utils/format'

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
  const [items, setItems] = useState<Item[]>([])
  const [detail, setDetail] = useState<ProductionOrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState(emptyCreate)

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
        const itemRows = await api.listItems()
        setItems(itemRows)
        if (isEdit && orderId != null) {
          await loadDetail(orderId)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load items')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [isEdit, orderId, loadDetail])

  const createOrder = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      if (isEdit && orderId != null) {
        const row = await api.updateProductionOrder(orderId, {
          production_date: createForm.production_date,
          reference_no: createForm.reference_no.trim() || null,
          planned_qty: Number(createForm.planned_qty),
          lot: createForm.lot.trim(),
          notes: createForm.notes.trim() || null,
        })
        setDetail(row)
        setStatus(row.status)
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

  return (
    <ErpScreen error={error} className="erp-screen-stacked">
      <ErpSearchPanel>
        <div className="erp-search-form">
          <AppLink to="/production/orders" className="btn erp-btn erp-btn-clear">
            Back to list
          </AppLink>
          <span className="erp-search-section-label">
            {isEdit ? `Production Order Entry #${orderId}` : 'Production Order Entry'}
          </span>
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

      <ProductionProcessInputPanels
        detail={detail}
        loading={detailLoading}
        emptyMessage={
          isEdit
            ? 'No process and input data.'
            : 'Create the order to view Process and Input from BOM.'
        }
        lineGridId="production-entry-lines-v1"
        inputGridId="production-entry-inputs-v1"
      />
    </ErpScreen>
  )
}
