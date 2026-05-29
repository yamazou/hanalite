import { FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { ErpSuggestInput } from '../components/ErpSuggestInput'
import { ErpGridPanel, erpRowClass } from '../components/erp/ErpGridPanel'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpSearchPanel } from '../components/erp/ErpSearchPanel'
import {
  traceBalanceColumns,
  traceCurrentColumns,
  traceHistoryColumns,
} from '../components/erp/masterGridColumns'
import type { LotTraceResult } from '../types/inventory'
import { formatDateTime, formatQty } from '../utils/format'
import { resolveLocationIdFromText, suggestCurrentLots, suggestLocations } from '../utils/searchSuggest'

export function LotTracePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [lot, setLot] = useState(() => searchParams.get('lot') ?? '')
  const [locationText, setLocationText] = useState('')
  const [result, setResult] = useState<LotTraceResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runTrace = async (value: string, locationLabel: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Enter a lot number.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const locId = locationLabel.trim()
        ? await resolveLocationIdFromText(locationLabel)
        : undefined
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
    void runTrace(lot, locationText)
  }

  useEffect(() => {
    const q = searchParams.get('lot')?.trim()
    const locId = searchParams.get('location_id')?.trim()
    if (!q) return
    const init = async () => {
      let locLabel = ''
      if (locId) {
        const locations = await api.listLocationsMaster()
        const loc = locations.find((l) => String(l.location_id) === locId)
        if (loc) {
          locLabel = `${loc.location_cd} / ${loc.location_nm}`
          setLocationText(locLabel)
        }
      }
      setLot(q)
      await runTrace(q, locLabel)
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial URL only
  }, [])

  const lotTitle = result?.lot ?? lot

  return (
    <ErpScreen error={error} className="erp-screen-stacked">
      <ErpSearchPanel>
        <form onSubmit={onSubmit} className="erp-search-form erp-search-form-suggest">
          <ErpSuggestInput
            value={lot}
            onChange={setLot}
            placeholder="Lot Number"
            ariaLabel="Lot Number"
            fieldClassName="erp-search-field-reference"
            fetchSuggestions={suggestCurrentLots}
          />
          <ErpSuggestInput
            value={locationText}
            onChange={setLocationText}
            placeholder="Location"
            ariaLabel="Location"
            fieldClassName="erp-search-field-supplier"
            fetchSuggestions={suggestLocations}
          />
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
            title={`Current Stock — Lot ${lotTitle}`}
            columns={traceCurrentColumns}
            isEmpty={result.current.length === 0}
            emptyText="No current stock for this lot"
          >
            {(layout) => (
              <tbody>
                {result.current.map((r, index) => (
                  <tr key={`${r.location_id}-${r.item_id}`} className={erpRowClass(index)}>
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
                        case 'qty':
                          return <td key={col.key}>{formatQty(r.qty)}</td>
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
            title="GR/GI History"
            columns={traceHistoryColumns}
            isEmpty={result.history.length === 0}
            emptyText="No movements"
          >
            {(layout) => (
              <tbody>
                {result.history.map((h, index) => (
                  <tr key={h.inv_grgi_id} className={erpRowClass(index)}>
                    {layout.orderedColumns.map((col) => {
                      switch (col.key) {
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
            gridId="trace-balance-v1"
            title="Period Balances"
            columns={traceBalanceColumns}
            isEmpty={result.balances.length === 0}
            emptyText="No balance snapshots"
          >
            {(layout) => (
              <tbody>
                {result.balances.map((b, index) => (
                  <tr key={b.inv_balance_id} className={erpRowClass(index)}>
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
