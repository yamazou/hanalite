import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { ErpGridPanel, erpRowClass } from '../components/erp/ErpGridPanel'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpSearchPanel } from '../components/erp/ErpSearchPanel'
import { balanceColumns } from '../components/erp/masterGridColumns'
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
    <ErpScreen error={error} success={success}>
      <ErpSearchPanel>
        <form onSubmit={onCreate} className="erp-search-form">
          <label className="erp-search-field erp-search-field-reference">
            <input
              className="erp-input"
              value={createPeriod}
              onChange={(e) => setCreatePeriod(e.target.value)}
              pattern="\d{6}"
              placeholder="Period YYYYMM"
              aria-label="Target Period"
              required
            />
          </label>
          <div className="erp-search-actions">
            <button type="submit" className="btn erp-btn erp-btn-search" disabled={creating}>
              {creating ? 'Creating…' : 'Create snapshot'}
            </button>
          </div>
        </form>
      </ErpSearchPanel>

      <ErpSearchPanel>
        <form onSubmit={onFilter} className="erp-search-form">
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
          <label className="erp-search-field erp-search-field-reference">
            <input
              className="erp-input"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="Filter period YYYYMM"
              aria-label="Filter Period"
              pattern="\d{6}|"
            />
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
        gridId="inventory-balances-v1"
        title="Period Balances"
        columns={balanceColumns}
        loading={loading}
        isEmpty={!loading && rows.length === 0}
        onRefresh={load}
      >
        {(layout) => (
          <tbody>
            {rows.map((r, index) => (
              <tr key={r.inv_balance_id} className={erpRowClass(index)}>
                {layout.orderedColumns.map((col) => {
                  switch (col.key) {
                    case 'period':
                      return <td key={col.key}>{r.period_year_month}</td>
                    case 'item':
                      return <td key={col.key}>{r.item_nm}</td>
                    case 'location':
                      return (
                        <td key={col.key}>
                          <code>{r.location_cd}</code> {r.location_nm}
                        </td>
                      )
                    case 'lot':
                      return (
                        <td key={col.key}>
                          <code>{r.lot}</code>
                        </td>
                      )
                    case 'beg_qty':
                      return <td key={col.key}>{formatQty(r.beg_qty)}</td>
                    case 'qty':
                      return <td key={col.key}>{formatQty(r.qty)}</td>
                    case 'beg_at':
                      return <td key={col.key}>{formatDateTime(r.beg_at)}</td>
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
