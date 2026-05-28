import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel, erpRowClass } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { ErpSearchPanel } from '../../components/erp/ErpSearchPanel'
import { masterBomColumns } from '../../components/erp/masterGridColumns'
import { ItemSearchPicker } from '../../components/ItemSearchPicker'
import type { BomCreatePayload, BomRow } from '../../types/boms'
import { itemRefFromSearch } from '../../types/boms'
import type { ItemSearchRow, LocationMaster } from '../../types/masters'
import { formatQty } from '../../utils/format'

export function BomsPage() {
  const [rows, setRows] = useState<BomRow[]>([])
  const [parentFilter, setParentFilter] = useState<ItemSearchRow | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [parent, setParent] = useState<ItemSearchRow | null>(null)
  const [child, setChild] = useState<ItemSearchRow | null>(null)
  const [reqQty, setReqQty] = useState('')
  const [locationId, setLocationId] = useState('')
  const [locations, setLocations] = useState<LocationMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listBoms(parentFilter?.item_id)
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [parentFilter])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    api.listLocationsMaster().then(setLocations).catch(() => {})
  }, [])

  const resetForm = () => {
    setEditId(null)
    setParent(null)
    setChild(null)
    setReqQty('')
    setLocationId('')
  }

  const startEdit = (row: BomRow) => {
    setEditId(row.bom_id)
    setParent({
      item_id: row.p_item_id,
      item_cd: row.p_item_cd,
      item_nm: row.p_item_nm,
      itemtyp_id: 0,
      itemtyp_nm: '',
    })
    setChild({
      item_id: row.c_item_id,
      item_cd: row.c_item_cd,
      item_nm: row.c_item_nm,
      itemtyp_id: 0,
      itemtyp_nm: '',
    })
    setReqQty(String(row.c_req_qty))
    setLocationId(String(row.location_id))
    setError(null)
    setSuccess(null)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!parent || !child || !locationId) {
      setError('Select parent, child and location.')
      return
    }
    const qty = Number(reqQty)
    if (!qty || qty <= 0) {
      setError('Child required qty must be greater than 0.')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const payload: BomCreatePayload = {
        parent: itemRefFromSearch(parent),
        child: itemRefFromSearch(child),
        location_id: Number(locationId),
        c_req_qty: qty,
      }
      if (editId) {
        await api.updateBom(editId, payload)
        setSuccess('BOM updated.')
      } else {
        await api.createBom(payload)
        setSuccess('BOM created.')
      }
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this BOM line?')) return
    setError(null)
    setSuccess(null)
    try {
      await api.deleteBom(id)
      if (editId === id) resetForm()
      setSuccess('BOM deleted.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <ErpScreen error={error} success={success}>
      <ErpSearchPanel>
        <div className="erp-search-form">
          <ItemSearchPicker label="Filter parent" value={parentFilter} onChange={setParentFilter} />
          <div className="erp-search-actions">
            <button type="button" className="btn erp-btn erp-btn-search" onClick={load}>
              Apply filter
            </button>
            <button type="button" className="btn erp-btn erp-btn-clear" onClick={() => setParentFilter(null)}>
              Clear
            </button>
          </div>
        </div>
      </ErpSearchPanel>

      <ErpSearchPanel className="erp-panel-master-form">
        <form onSubmit={onSubmit} className="erp-search-form erp-search-form-bom">
          <ItemSearchPicker label="Parent (FG)" value={parent} onChange={setParent} required />
          <ItemSearchPicker label="Child (RM)" value={child} onChange={setChild} required />
          <label className="erp-search-field erp-search-field-qty">
            <select
              className={`erp-input${locationId === '' ? ' erp-input-empty' : ''}`}
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              required
            >
              <option value="">Location</option>
              {locations.map((l) => (
                <option key={l.location_id} value={l.location_id}>
                  {l.location_cd}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-search-field erp-search-field-qty">
            <input
              type="number"
              className="erp-input"
              step="0.001"
              min="0.001"
              value={reqQty}
              onChange={(e) => setReqQty(e.target.value)}
              placeholder="Req Qty"
              aria-label="Child required qty"
              required
            />
          </label>
          <div className="erp-search-actions">
            <button type="submit" className="btn erp-btn erp-btn-search" disabled={submitting}>
              {submitting ? 'Saving…' : editId ? 'Update' : 'Save'}
            </button>
            {editId && (
              <button type="button" className="btn erp-btn erp-btn-clear" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </ErpSearchPanel>

      <ErpGridPanel
        gridId="masters-boms-v1"
        title="BOM"
        columns={masterBomColumns}
        loading={loading}
        isEmpty={!loading && rows.length === 0}
        emptyText="No BOM lines"
        onRefresh={load}
      >
        {(layout) => (
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.bom_id}
                className={erpRowClass(index, editId === row.bom_id)}
                onClick={() => startEdit(row)}
              >
                {layout.orderedColumns.map((col) => {
                  switch (col.key) {
                    case 'parent':
                      return (
                        <td key={col.key}>
                          <code>{row.p_item_cd}</code> {row.p_item_nm}
                        </td>
                      )
                    case 'child':
                      return (
                        <td key={col.key}>
                          <code>{row.c_item_cd}</code> {row.c_item_nm}
                        </td>
                      )
                    case 'qty':
                      return <td key={col.key}>{formatQty(row.c_req_qty)}</td>
                    case 'location':
                      return <td key={col.key}><code>{row.location_cd}</code> {row.location_nm}</td>
                    case 'actions':
                      return (
                        <td
                          key={col.key}
                          className="erp-col-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="btn erp-btn erp-btn-search"
                            onClick={() => startEdit(row)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn erp-btn erp-btn-cancel"
                            onClick={() => void handleDelete(row.bom_id)}
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
    </ErpScreen>
  )
}
