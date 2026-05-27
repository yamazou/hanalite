import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { Alert } from '../components/Alert'
import type { BalanceItem } from '../types/inventory'
import type { LocationMaster } from '../types/masters'
import { formatDateTime, formatQty } from '../utils/format'

function currentPeriod(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}${m}`
}

export function BalancesPage() {
  const [period, setPeriod] = useState('')
  const [rows, setRows] = useState<BalanceItem[]>([])
  const [locations, setLocations] = useState<LocationMaster[]>([])
  const [locationId, setLocationId] = useState('')
  const [createPeriod, setCreatePeriod] = useState(currentPeriod())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listBalances(period || undefined, locationId ? Number(locationId) : undefined)
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [period, locationId])

  useEffect(() => {
    api.listLocationsMaster().then(setLocations).catch(() => {})
    load()
  }, [load])

  const onFilter = (e: FormEvent) => {
    e.preventDefault()
    load()
  }

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    const p = createPeriod.trim()
    if (!/^\d{6}$/.test(p)) {
      setError('Period must be in YYYYMM format.')
      return
    }
    setCreating(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await api.createPeriodBalance(p, locationId ? Number(locationId) : undefined)
      setSuccess(`Saved ${res.rows_saved} balance rows for ${res.period_year_month}.`)
      setPeriod(p)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create balance snapshot')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Period Balances</h1>
          <p className="page-desc">Create and browse period snapshots from current stock</p>
        </div>
      </header>

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      <div className="card">
        <h2>Create Snapshot</h2>
        <form className="filter-form" onSubmit={onCreate}>
          <label>
            Target Period (YYYYMM)
            <input
              value={createPeriod}
              onChange={(e) => setCreatePeriod(e.target.value)}
              pattern="\d{6}"
              placeholder="202605"
              required
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create from current stock'}
          </button>
        </form>
      </div>

      <div className="card">
        <form className="filter-form" onSubmit={onFilter}>
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
            Filter Period (YYYYMM)
            <input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="All when blank"
              pattern="\d{6}|"
            />
          </label>
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
            Refresh
          </button>
        </form>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="muted">No data</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Item</th>
                <th>Location</th>
                <th>Lot</th>
                <th className="num">Opening Qty</th>
                <th className="num">Closing Qty</th>
                <th>Opening Date/Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.inv_balance_id}>
                  <td>{r.period_year_month}</td>
                  <td>{r.item_nm}</td>
                  <td>
                    <code>{r.location_cd}</code> {r.location_nm}
                  </td>
                  <td>
                    <code>{r.lot}</code>
                  </td>
                  <td className="num">{formatQty(r.beg_qty)}</td>
                  <td className="num">{formatQty(r.qty)}</td>
                  <td>{formatDateTime(r.beg_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
