import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel, erpRowClass } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { ErpSearchPanel } from '../../components/erp/ErpSearchPanel'
import { masterItemColumns } from '../../components/erp/masterGridColumns'
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
    <ErpScreen error={error} success={success}>
      <ErpSearchPanel className="erp-panel-master-form">
        <form onSubmit={onSubmit} className="erp-search-form">
          <label className="erp-search-field erp-search-field-grow">
            <input
              className="erp-input"
              value={itemCd}
              onChange={(e) => setItemCd(e.target.value)}
              placeholder="Item Code"
              aria-label="Item Code"
              required
            />
          </label>
          <label className="erp-search-field erp-search-field-grow">
            <input
              className="erp-input"
              value={itemNm}
              onChange={(e) => setItemNm(e.target.value)}
              placeholder="Item Name"
              aria-label="Item Name"
              required
            />
          </label>
          <label className="erp-search-field erp-search-field-supplier">
            <select
              className={`erp-input${itemtypId === '' ? ' erp-input-empty' : ''}`}
              value={itemtypId}
              aria-label="Item Type"
              onChange={(e) => setItemtypId(e.target.value)}
              required
            >
              <option value="">Item Type</option>
              {itemtyps.map((t) => (
                <option key={t.itemtyp_id} value={t.itemtyp_id}>
                  {t.itemtyp_nm}
                </option>
              ))}
            </select>
          </label>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="erp-search-field erp-search-field-supplier">
              <select
                className={`erp-input${supplierIds[n - 1] === '' ? ' erp-input-empty' : ''}`}
                value={supplierIds[n - 1]}
                aria-label={n === 1 ? 'Main Supplier' : `Supplier ${n}`}
                onChange={(e) => setSupplier(n - 1, e.target.value)}
              >
                <option value="">{n === 1 ? 'Main Supplier' : `Supplier ${n}`}</option>
                {suppliers.map((s) => (
                  <option key={s.suppliers_id} value={s.suppliers_id}>
                    {s.suppliers_nm}
                  </option>
                ))}
              </select>
            </label>
          ))}
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
        gridId="masters-items-v1"
        title="Items"
        columns={masterItemColumns}
        loading={loading}
        isEmpty={!loading && rows.length === 0}
        onRefresh={load}
      >
        {(layout) => (
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.item_id}
                className={erpRowClass(index, editId === row.item_id)}
                onClick={() => void startEdit(row.item_id)}
              >
                {layout.orderedColumns.map((col) => {
                  switch (col.key) {
                    case 'id':
                      return <td key={col.key}>{row.item_id}</td>
                    case 'code':
                      return (
                        <td key={col.key}>
                          <code>{row.item_cd}</code>
                        </td>
                      )
                    case 'name':
                      return <td key={col.key}>{row.item_nm}</td>
                    case 'type':
                      return <td key={col.key}>{row.itemtyp_nm}</td>
                    case 'supplier':
                      return <td key={col.key}>{row.supplier1_nm ?? '—'}</td>
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
                            onClick={() => void startEdit(row.item_id)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn erp-btn erp-btn-cancel"
                            onClick={() => void handleDelete(row.item_id)}
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
