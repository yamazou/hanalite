import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { Alert } from '../components/Alert'
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
    <>
      <header className="page-header">
        <div>
          <h1>Current Stock</h1>
          <p className="page-desc">Current quantity by item, location, and lot</p>
        </div>
      </header>

      {error && <Alert type="error" message={error} />}

      <div className="card">
        <form className="form-grid filter-form" onSubmit={onSearch}>
          <label>
            Lot
            <input value={lot} onChange={(e) => setLot(e.target.value)} placeholder="Contains match" />
          </label>
          <label>
            Location
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">All</option>
              {locations.map((l) => (
                <option key={l.location_id} value={l.location_id}>
                  {l.location_cd} / {l.location_nm}
                </option>
              ))}
            </select>
          </label>
          <label>
            Item
            <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">All</option>
              {items.map((i) => (
                <option key={i.item_id} value={i.item_id}>
                  {formatItemLabel(i)}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeZero}
              onChange={(e) => setIncludeZero(e.target.checked)}
            />
            Include zero stock
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Search
            </button>
            <button type="button" className="btn btn-secondary" onClick={load}>
              Refresh
            </button>
          </div>
        </form>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="muted">No data</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Location</th>
                <th>Type</th>
                <th>Lot</th>
                <th className="num">Qty</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.inv_current_id}>
                  <td>{r.item_nm}</td>
                  <td>
                    <code>{r.location_cd}</code> {r.location_nm}
                  </td>
                  <td>{r.itemtyp_nm}</td>
                  <td>
                    <code>{r.lot}</code>
                  </td>
                  <td className="num">{formatQty(r.qty)}</td>
                  <td>{formatDateTime(r.updated_at)}</td>
                  <td>
                    <Link
                      to={`/trace?lot=${encodeURIComponent(r.lot)}&location_id=${r.location_id}`}
                      className="link"
                    >
                      Trace
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
