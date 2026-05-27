import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { Alert } from '../../components/Alert'
import { ItemSearchPicker } from '../../components/ItemSearchPicker'
import type { BomCreatePayload, BomRow } from '../../types/boms'
import { itemRefFromSearch } from '../../types/boms'
import type { ItemSearchRow } from '../../types/masters'
import { formatQty } from '../../utils/format'

export function BomsPage() {
  const [rows, setRows] = useState<BomRow[]>([])
  const [parentFilter, setParentFilter] = useState<ItemSearchRow | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [parent, setParent] = useState<ItemSearchRow | null>(null)
  const [child, setChild] = useState<ItemSearchRow | null>(null)
  const [reqQty, setReqQty] = useState('')
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

  const resetForm = () => {
    setEditId(null)
    setParent(null)
    setChild(null)
    setReqQty('')
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
    setError(null)
    setSuccess(null)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!parent || !child) {
      setError('Select parent and child items.')
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
    <>
      <header className="page-header">
        <div>
          <h1>BOM</h1>
          <p className="page-desc">Parent item (FG) → child item (RM) required quantity</p>
        </div>
      </header>

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      <div className="card">
        <h2>Filter by parent</h2>
        <div className="form-grid">
          <ItemSearchPicker label="Parent item" value={parentFilter} onChange={setParentFilter} />
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={load}>
              Apply filter
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setParentFilter(null)
              }}
            >
              Clear filter
            </button>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>{editId ? 'Edit' : 'Add'} BOM line</h2>
          <form className="form-grid" onSubmit={onSubmit}>
            <ItemSearchPicker label="Parent item (FG)" value={parent} onChange={setParent} required />
            <ItemSearchPicker label="Child item (RM)" value={child} onChange={setChild} required />
            <label className="full">
              Child required qty
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={reqQty}
                onChange={(e) => setReqQty(e.target.value)}
                required
              />
            </label>
            <div className="form-actions full">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save'}
              </button>
              {editId && (
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="card">
          <div className="card-header-row">
            <h2>List</h2>
            <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
              Refresh
            </button>
          </div>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="muted">No BOM lines</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Parent</th>
                  <th>Child</th>
                  <th className="num">Req Qty</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.bom_id}>
                    <td>
                      <code>{row.p_item_cd}</code>
                      <br />
                      <span className="muted small">{row.p_item_nm}</span>
                    </td>
                    <td>
                      <code>{row.c_item_cd}</code>
                      <br />
                      <span className="muted small">{row.c_item_nm}</span>
                    </td>
                    <td className="num">{formatQty(row.c_req_qty)}</td>
                    <td className="action-cell">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => startEdit(row)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(row.bom_id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
