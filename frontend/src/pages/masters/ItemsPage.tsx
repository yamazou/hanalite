import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { Alert } from '../../components/Alert'
import type { ItemDetail, ItemListRow, ItemPayload, ItemTyp, SupplierMaster } from '../../types/masters'

const emptySuppliers = () => ['', '', '', '', '']

export function ItemsPage() {
  const [rows, setRows] = useState<ItemListRow[]>([])
  const [itemtyps, setItemtyps] = useState<ItemTyp[]>([])
  const [suppliers, setSuppliers] = useState<SupplierMaster[]>([])
  const [editId, setEditId] = useState<number | null>(null)
  const [itemCd, setItemCd] = useState('')
  const [itemNm, setItemNm] = useState('')
  const [itemtypId, setItemtypId] = useState('')
  const [supplierIds, setSupplierIds] = useState<string[]>(emptySuppliers())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [items, types, sups] = await Promise.all([
        api.listItemsMaster(),
        api.listItemtyps(),
        api.listSuppliersMaster(),
      ])
      setRows(items)
      setItemtyps(types)
      setSuppliers(sups)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const resetForm = () => {
    setEditId(null)
    setItemCd('')
    setItemNm('')
    setItemtypId('')
    setSupplierIds(emptySuppliers())
  }

  const startEdit = async (id: number) => {
    setError(null)
    try {
      const item: ItemDetail = await api.getItem(id)
      setEditId(id)
      setItemCd(item.item_cd)
      setItemNm(item.item_nm)
      setItemtypId(String(item.itemtyp_id))
      setSupplierIds([
        item.supplier1_id ? String(item.supplier1_id) : '',
        item.supplier2_id ? String(item.supplier2_id) : '',
        item.supplier3_id ? String(item.supplier3_id) : '',
        item.supplier4_id ? String(item.supplier4_id) : '',
        item.supplier5_id ? String(item.supplier5_id) : '',
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load item')
    }
  }

  const buildPayload = (): ItemPayload => ({
    item_cd: itemCd.trim(),
    item_nm: itemNm.trim(),
    itemtyp_id: Number(itemtypId),
    supplier1_id: supplierIds[0] ? Number(supplierIds[0]) : null,
    supplier2_id: supplierIds[1] ? Number(supplierIds[1]) : null,
    supplier3_id: supplierIds[2] ? Number(supplierIds[2]) : null,
    supplier4_id: supplierIds[3] ? Number(supplierIds[3]) : null,
    supplier5_id: supplierIds[4] ? Number(supplierIds[4]) : null,
  })

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const payload = buildPayload()
      if (editId) {
        await api.updateItem(editId, payload)
        setSuccess('Item updated.')
      } else {
        await api.createItem(payload)
        setSuccess('Item created.')
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
    if (!confirm('Delete?')) return
    setError(null)
    setSuccess(null)
    try {
      await api.deleteItem(id)
      if (editId === id) resetForm()
      setSuccess('Item deleted.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const setSupplier = (index: number, value: string) => {
    setSupplierIds((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Items</h1>
        </div>
      </header>

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      <div className="grid-2">
        <div className="card">
          <h2>{editId ? 'Edit' : 'Add'} Item</h2>
          <form className="form-grid" onSubmit={onSubmit}>
            <label className="full">
              Item Code
              <input
                value={itemCd}
                onChange={(e) => setItemCd(e.target.value)}
                placeholder="RM-001"
                required
              />
            </label>
            <label className="full">
              Item Name
              <input value={itemNm} onChange={(e) => setItemNm(e.target.value)} required />
            </label>
            <label className="full">
              Item Type
              <select value={itemtypId} onChange={(e) => setItemtypId(e.target.value)} required>
                <option value="">Select</option>
                {itemtyps.map((t) => (
                  <option key={t.itemtyp_id} value={t.itemtyp_id}>
                    {t.itemtyp_nm}
                  </option>
                ))}
              </select>
            </label>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="full">
                Supplier {n}
                {n === 1 ? ' (Main)' : ' (Sub)'}
                <select value={supplierIds[n - 1]} onChange={(e) => setSupplier(n - 1, e.target.value)}>
                  <option value="">—</option>
                  {suppliers.map((s) => (
                    <option key={s.suppliers_id} value={s.suppliers_id}>
                      {s.suppliers_nm}
                    </option>
                  ))}
                </select>
              </label>
            ))}
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
            <p className="muted">No data</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Main Supplier</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.item_id}>
                    <td>{row.item_id}</td>
                    <td>
                      <code>{row.item_cd}</code>
                    </td>
                    <td>{row.item_nm}</td>
                    <td>{row.itemtyp_nm}</td>
                    <td>{row.supplier1_nm ?? '—'}</td>
                    <td className="action-cell">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => startEdit(row.item_id)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(row.item_id)}
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
