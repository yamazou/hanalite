import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { ErpGridPanel, erpRowClass } from '../components/erp/ErpGridPanel'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpSearchPanel } from '../components/erp/ErpSearchPanel'
import { currentStockColumns } from '../components/erp/masterGridColumns'
import type { Item } from '../types'
import type { LocationMaster } from '../types/masters'
import type { CurrentStock } from '../types/inventory'
import { formatDateTime, formatItemLabel, formatQty } from '../utils/format'

export function CurrentStockPage() {
  const [items, setItems] = useState<Item[]>([])
  const [lot, setLot] = useState('')
  const [itemId, setItemId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [locations, setLocations] = useState<LocationMaster[]>([])
  const [includeZero, setIncludeZero] = useState(false)
  const [rows, setRows] = useState<CurrentStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listItems().then(setItems).catch(() => {})
    api.listLocationsMaster().then(setLocations).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listCurrentStock({
        lot: lot.trim() || undefined,
        item_id: itemId ? Number(itemId) : undefined,
        location_id: locationId ? Number(locationId) : undefined,
        include_zero: includeZero,
      })
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [lot, itemId, locationId, includeZero])

  useEffect(() => {
    load()
  }, [load])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    load()
  }

  return (
    <ErpScreen error={error}>
      <ErpSearchPanel>
        <form onSubmit={onSearch} className="erp-search-form">
          <label className="erp-search-field erp-search-field-reference">
            <input
              type="text"
              className="erp-input"
              value={lot}
              placeholder="Lot"
              aria-label="Lot"
              onChange={(e) => setLot(e.target.value)}
            />
          </label>
          <label className="erp-search-field erp-search-field-supplier">
            <select
              className={`erp-input${locationId === '' ? ' erp-input-empty' : ''}`}
              value={locationId}
              aria-label="Location"
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">Location</option>
              {locations.map((l) => (
                <option key={l.location_id} value={l.location_id}>
                  {l.location_cd} / {l.location_nm}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-search-field erp-search-field-item">
            <select
              className={`erp-input${itemId === '' ? ' erp-input-empty' : ''}`}
              value={itemId}
              aria-label="Item"
              onChange={(e) => setItemId(e.target.value)}
            >
              <option value="">Item</option>
              {items.map((i) => (
                <option key={i.item_id} value={i.item_id}>
                  {formatItemLabel(i)}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-search-field erp-search-field-check">
            <input
              type="checkbox"
              checked={includeZero}
              onChange={(e) => setIncludeZero(e.target.checked)}
            />
            <span>Include zero</span>
          </label>
          <div className="erp-search-actions">
            <button type="submit" className="btn erp-btn erp-btn-search">
              Search
            </button>
            <button type="button" className="btn erp-btn erp-btn-clear" onClick={load}>
              Refresh
            </button>
          </div>
        </form>
      </ErpSearchPanel>

      <ErpGridPanel
        gridId="inventory-current-v1"
        title="Current Stock"
        columns={currentStockColumns}
        loading={loading}
        isEmpty={!loading && rows.length === 0}
        onRefresh={load}
      >
        {(layout) => (
          <tbody>
            {rows.map((r, index) => (
              <tr key={r.inv_current_id} className={erpRowClass(index)}>
                {layout.orderedColumns.map((col) => {
                  switch (col.key) {
                    case 'item':
                      return <td key={col.key}>{r.item_nm}</td>
                    case 'location':
                      return (
                        <td key={col.key}>
                          <code>{r.location_cd}</code> {r.location_nm}
                        </td>
                      )
                    case 'type':
                      return <td key={col.key}>{r.itemtyp_nm}</td>
                    case 'lot':
                      return (
                        <td key={col.key}>
                          <code>{r.lot}</code>
                        </td>
                      )
                    case 'qty':
                      return <td key={col.key}>{formatQty(r.qty)}</td>
                    case 'updated':
                      return <td key={col.key}>{formatDateTime(r.updated_at)}</td>
                    case 'actions':
                      return (
                        <td key={col.key} className="erp-col-actions">
                          <Link
                            to={`/trace?lot=${encodeURIComponent(r.lot)}&location_id=${r.location_id}`}
                            className="erp-link"
                          >
                            Trace
                          </Link>
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
