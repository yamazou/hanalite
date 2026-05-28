import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel, erpRowClass } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { ErpSearchPanel } from '../../components/erp/ErpSearchPanel'
import { itemprocColumns } from '../../components/erp/masterGridColumns'
import type { Item } from '../../types'
import type { ItemProcMaster, LocationMaster } from '../../types/masters'

const emptyForm = {
  item_id: '',
  process_no: '',
  process_nm: '',
  rm_location_id: '',
  wip_location_id: '',
}

export function ItemProcessesPage() {
  const [rows, setRows] = useState<ItemProcMaster[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [locations, setLocations] = useState<LocationMaster[]>([])
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [procs, itemRows, locRows] = await Promise.all([
        api.listItemprocsMaster(),
        api.listItems(),
        api.listLocationsMaster(),
      ])
      setRows(procs)
      setItems(itemRows)
      setLocations(locRows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      if (editId) {
        await api.updateItemproc(editId, {
          process_no: Number(form.process_no),
          process_nm: form.process_nm.trim(),
          rm_location_id: Number(form.rm_location_id),
          wip_location_id: Number(form.wip_location_id),
        })
      } else {
        await api.createItemproc({
          item_id: Number(form.item_id),
          process_no: Number(form.process_no),
          process_nm: form.process_nm.trim(),
          rm_location_id: Number(form.rm_location_id),
          wip_location_id: Number(form.wip_location_id),
        })
      }
      setEditId(null)
      setForm(emptyForm)
      setSuccess('Saved.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (row: ItemProcMaster) => {
    setEditId(row.itemproc_id)
    setForm({
      item_id: String(row.item_id),
      process_no: String(row.process_no),
      process_nm: row.process_nm,
      rm_location_id: String(row.rm_location_id),
      wip_location_id: String(row.wip_location_id),
    })
    setError(null)
    setSuccess(null)
  }

  const cancelEdit = () => {
    setEditId(null)
    setForm(emptyForm)
  }

  const handleDelete = async (itemproc_id: number) => {
    if (!confirm('Delete item process?')) return
    setError(null)
    setSuccess(null)
    try {
      await api.deleteItemproc(itemproc_id)
      if (editId === itemproc_id) cancelEdit()
      setSuccess('Deleted.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  return (
    <ErpScreen error={error} success={success}>
      <ErpSearchPanel>
        <form className="erp-search-form" onSubmit={onSubmit}>
          <label className="erp-search-field erp-search-field-item">
            <select
              className={`erp-input${form.item_id === '' ? ' erp-input-empty' : ''}`}
              value={form.item_id}
              onChange={(e) => setForm((p) => ({ ...p, item_id: e.target.value }))}
              disabled={editId !== null}
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
              min="1"
              step="1"
              placeholder="Proc No"
              value={form.process_no}
              onChange={(e) => setForm((p) => ({ ...p, process_no: e.target.value }))}
              required
            />
          </label>
          <label className="erp-search-field erp-search-field-grow">
            <input
              className="erp-input"
              placeholder="Location"
              value={form.process_nm}
              onChange={(e) => setForm((p) => ({ ...p, process_nm: e.target.value }))}
              required
            />
          </label>
          <label className="erp-search-field erp-search-field-supplier">
            <select
              className={`erp-input${form.rm_location_id === '' ? ' erp-input-empty' : ''}`}
              value={form.rm_location_id}
              onChange={(e) => setForm((p) => ({ ...p, rm_location_id: e.target.value }))}
              required
            >
              <option value="">From Location</option>
              {locations.map((l) => (
                <option key={l.location_id} value={l.location_id}>
                  {l.location_cd}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-search-field erp-search-field-supplier">
            <select
              className={`erp-input${form.wip_location_id === '' ? ' erp-input-empty' : ''}`}
              value={form.wip_location_id}
              onChange={(e) => setForm((p) => ({ ...p, wip_location_id: e.target.value }))}
              required
            >
              <option value="">To Location</option>
              {locations.map((l) => (
                <option key={l.location_id} value={l.location_id}>
                  {l.location_cd}
                </option>
              ))}
            </select>
          </label>
          <div className="erp-search-actions">
            <button className="btn erp-btn erp-btn-search" type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : editId ? 'Update' : 'Save'}
            </button>
            {editId && (
              <button className="btn erp-btn erp-btn-clear" type="button" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </ErpSearchPanel>

      <ErpGridPanel
        gridId="masters-itemprocs-v1"
        title="Item Process Master"
        columns={itemprocColumns}
        loading={loading}
        isEmpty={!loading && rows.length === 0}
        onRefresh={() => void load()}
      >
        {(layout) => (
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.itemproc_id}
                className={erpRowClass(index, editId === row.itemproc_id)}
                onClick={() => startEdit(row)}
              >
                {layout.orderedColumns.map((col) => {
                  switch (col.key) {
                    case 'item':
                      return <td key={col.key}><code>{row.item_cd}</code> {row.item_nm}</td>
                    case 'process_no':
                      return <td key={col.key}>{row.process_no}</td>
                    case 'process_nm':
                      return <td key={col.key}>{row.process_nm}</td>
                    case 'rm':
                      return <td key={col.key}>{row.rm_location_cd}</td>
                    case 'wip':
                      return <td key={col.key}>{row.wip_location_cd}</td>
                    case 'actions':
                      return (
                        <td key={col.key} className="erp-col-actions" onClick={(e) => e.stopPropagation()}>
                          <button className="btn erp-btn erp-btn-search" type="button" onClick={() => startEdit(row)}>
                            Edit
                          </button>
                          <button
                            className="btn erp-btn erp-btn-cancel"
                            type="button"
                            onClick={() => void handleDelete(row.itemproc_id)}
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
