import { FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Alert } from '../components/Alert'
import type { LotTraceResult } from '../types/inventory'
import type { LocationMaster } from '../types/masters'
import { formatDateTime, formatQty } from '../utils/format'

export function LotTracePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [lot, setLot] = useState(() => searchParams.get('lot') ?? '')
  const [locationId, setLocationId] = useState(() => searchParams.get('location_id') ?? '')
  const [locations, setLocations] = useState<LocationMaster[]>([])
  const [result, setResult] = useState<LotTraceResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runTrace = async (value: string, locId?: number) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Enter a lot number.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await api.traceLot(trimmed, locId)
      setResult(data)
      const qp: Record<string, string> = { lot: trimmed }
      if (locId != null) qp.location_id = String(locId)
      setSearchParams(qp)
    } catch (e) {
      setResult(null)
      setError(e instanceof Error ? e.message : 'Trace failed')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void runTrace(lot, locationId ? Number(locationId) : undefined)
  }

  useEffect(() => {
    api.listLocationsMaster().then(setLocations).catch(() => {})
    const q = searchParams.get('lot')?.trim()
    const loc = searchParams.get('location_id')?.trim()
    if (loc) setLocationId(loc)
    if (q) {
      setLot(q)
      void runTrace(q, loc ? Number(loc) : undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial URL lot only
  }, [])

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Lot Trace</h1>
          <p className="page-desc">Current stock, movement history, and monthly balances by lot</p>
        </div>
      </header>

      <div className="card">
        <form className="filter-form" onSubmit={onSubmit}>
          <label>
            Lot Number
            <input
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              placeholder="e.g. LOT-2024-001"
              required
            />
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
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Searching…' : 'Trace'}
          </button>
        </form>
      </div>

      {error && <Alert type="error" message={error} />}

      {result && (
        <>
          <section className="card">
            <h2>Current Stock — {result.lot}</h2>
            {result.current.length === 0 ? (
              <p className="muted">No current stock</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Location</th>
                    <th>Type</th>
                    <th className="num">Qty</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {result.current.map((c, i) => (
                    <tr key={i}>
                      <td>{c.item_nm}</td>
                      <td>
                        <code>{c.location_cd}</code> {c.location_nm}
                      </td>
                      <td>{c.itemtyp_nm}</td>
                      <td className="num">{formatQty(c.qty)}</td>
                      <td>{formatDateTime(c.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <h2>Movement History</h2>
            {result.history.length === 0 ? (
              <p className="muted">No history</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Item</th>
                    <th>Location</th>
                    <th>Type</th>
                    <th className="num">Move Qty</th>
                    <th className="num">Balance Qty</th>
                    <th>Actual Date/Time</th>
                  </tr>
                </thead>
                <tbody>
                  {result.history.map((h) => (
                    <tr key={h.inv_grgi_id}>
                      <td>{h.inv_grgi_id}</td>
                      <td>{h.item_nm}</td>
                      <td>
                        <code>{h.location_cd}</code> {h.location_nm}
                      </td>
                      <td>{h.movetyps_nm}</td>
                      <td className="num">{formatQty(h.move_qty)}</td>
                      <td className="num">{formatQty(h.qty)}</td>
                      <td>{formatDateTime(h.actual_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <h2>Monthly Balance Snapshots</h2>
            {result.balances.length === 0 ? (
              <p className="muted">No balance data</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Item</th>
                    <th>Location</th>
                    <th className="num">Opening Qty</th>
                    <th className="num">Closing Qty</th>
                    <th>Opening Date/Time</th>
                  </tr>
                </thead>
                <tbody>
                  {result.balances.map((b, i) => (
                    <tr key={i}>
                      <td>{b.period_year_month}</td>
                      <td>{b.item_nm}</td>
                      <td>
                        <code>{b.location_cd}</code> {b.location_nm}
                      </td>
                      <td className="num">{formatQty(b.beg_qty)}</td>
                      <td className="num">{formatQty(b.qty)}</td>
                      <td>{formatDateTime(b.beg_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </>
  )
}
