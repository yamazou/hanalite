import { FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { ErpGridPanel, erpRowClass } from '../components/erp/ErpGridPanel'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpSearchPanel } from '../components/erp/ErpSearchPanel'
import {
  traceBalanceColumns,
  traceCurrentColumns,
  traceHistoryColumns,
} from '../components/erp/masterGridColumns'
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

  const lotTitle = result?.lot ?? lot

  return (
    <ErpScreen error={error} className="erp-screen-stacked">
      <ErpSearchPanel>
        <form onSubmit={onSubmit} className="erp-search-form">
          <label className="erp-search-field erp-search-field-reference">
            <input
              className="erp-input"
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              placeholder="Lot Number"
              aria-label="Lot Number"
              required
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
          <div className="erp-search-actions">
            <button type="submit" className="btn erp-btn erp-btn-search" disabled={loading}>
              {loading ? 'Searching…' : 'Trace'}
            </button>
          </div>
        </form>
      </ErpSearchPanel>

      {result && (
        <>
          <ErpGridPanel
            gridId="trace-current-v1"
            title={`Current Stock — ${lotTitle}`}
            columns={traceCurrentColumns}
            isEmpty={result.current.length === 0}
            emptyText="No current stock"
          >
            {(layout) => (
              <tbody>
                {result.current.map((c, index) => (
                  <tr key={`${c.item_nm}-${c.location_cd}-${index}`} className={erpRowClass(index)}>
                    {layout.orderedColumns.map((col) => {
                      switch (col.key) {
                        case 'item':
                          return <td key={col.key}>{c.item_nm}</td>
                        case 'location':
                          return (
                            <td key={col.key}>
                              <code>{c.location_cd}</code> {c.location_nm}
                            </td>
                          )
                        case 'type':
                          return <td key={col.key}>{c.itemtyp_nm}</td>
                        case 'qty':
                          return <td key={col.key}>{formatQty(c.qty)}</td>
                        case 'updated':
                          return <td key={col.key}>{formatDateTime(c.updated_at)}</td>
                        default:
                          return <td key={col.key} />
                      }
                    })}
                  </tr>
                ))}
              </tbody>
            )}
          </ErpGridPanel>

          <ErpGridPanel
            gridId="trace-history-v1"
            title="Movement History"
            columns={traceHistoryColumns}
            isEmpty={result.history.length === 0}
            emptyText="No history"
          >
            {(layout) => (
              <tbody>
                {result.history.map((h, index) => (
                  <tr key={h.inv_grgi_id} className={erpRowClass(index)}>
                    {layout.orderedColumns.map((col) => {
                      switch (col.key) {
                        case 'id':
                          return <td key={col.key}>{h.inv_grgi_id}</td>
                        case 'item':
                          return <td key={col.key}>{h.item_nm}</td>
                        case 'location':
                          return (
                            <td key={col.key}>
                              <code>{h.location_cd}</code> {h.location_nm}
                            </td>
                          )
                        case 'type':
                          return <td key={col.key}>{h.movetyps_nm}</td>
                        case 'move_qty':
                          return <td key={col.key}>{formatQty(h.move_qty)}</td>
                        case 'qty':
                          return <td key={col.key}>{formatQty(h.qty)}</td>
                        case 'actual_at':
                          return <td key={col.key}>{formatDateTime(h.actual_at)}</td>
                        default:
                          return <td key={col.key} />
                      }
                    })}
                  </tr>
                ))}
              </tbody>
            )}
          </ErpGridPanel>

          <ErpGridPanel
            gridId="trace-balances-v1"
            title="Monthly Balance Snapshots"
            columns={traceBalanceColumns}
            isEmpty={result.balances.length === 0}
            emptyText="No balance data"
          >
            {(layout) => (
              <tbody>
                {result.balances.map((b, index) => (
                  <tr key={`${b.period_year_month}-${b.item_nm}-${index}`} className={erpRowClass(index)}>
                    {layout.orderedColumns.map((col) => {
                      switch (col.key) {
                        case 'period':
                          return <td key={col.key}>{b.period_year_month}</td>
                        case 'item':
                          return <td key={col.key}>{b.item_nm}</td>
                        case 'location':
                          return (
                            <td key={col.key}>
                              <code>{b.location_cd}</code> {b.location_nm}
                            </td>
                          )
                        case 'beg_qty':
                          return <td key={col.key}>{formatQty(b.beg_qty)}</td>
                        case 'qty':
                          return <td key={col.key}>{formatQty(b.qty)}</td>
                        case 'beg_at':
                          return <td key={col.key}>{formatDateTime(b.beg_at)}</td>
                        default:
                          return <td key={col.key} />
                      }
                    })}
                  </tr>
                ))}
              </tbody>
            )}
          </ErpGridPanel>
        </>
      )}
    </ErpScreen>
  )
}
