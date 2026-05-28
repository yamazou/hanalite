import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { ErpGridPanel, erpRowClass } from '../components/erp/ErpGridPanel'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpSearchPanel } from '../components/erp/ErpSearchPanel'
import { grgiHistoryColumns } from '../components/erp/masterGridColumns'
import type { Item } from '../types'
import type { LocationMaster } from '../types/masters'
import type { GrgiHistory, MoveTyp } from '../types/inventory'
import { datetimeLocalToIso, formatDateTime, formatItemLabel, formatQty, toDatetimeLocalValue } from '../utils/format'

export function GrgiPage() {
  const [history, setHistory] = useState<GrgiHistory[]>([])
  const [movetyps, setMovetyps] = useState<MoveTyp[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [locations, setLocations] = useState<LocationMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [itemId, setItemId] = useState('')
  const [lot, setLot] = useState('')
  const [moveQty, setMoveQty] = useState('')
  const [movetypsId, setMovetypsId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [fromLocationId, setFromLocationId] = useState('')
  const [toLocationId, setToLocationId] = useState('')
  const [moveLot, setMoveLot] = useState('')
  const [moveQtyMv, setMoveQtyMv] = useState('')
  const [actualAt, setActualAt] = useState(toDatetimeLocalValue())
  const [submitting, setSubmitting] = useState(false)
  const grgiMovetyps = movetyps.filter((m) => m.movetyps_nm === 'GR' || m.movetyps_nm === 'GI')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [h, m, i, locs] = await Promise.all([
        api.listGrgiHistory(80, locationId ? Number(locationId) : undefined),
        api.listMovetyps(),
        api.listItems(),
        api.listLocationsMaster(),
      ])
      setHistory(h)
      setMovetyps(m)
      setItems(i)
      setLocations(locs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [locationId])

  useEffect(() => {
    if (grgiMovetyps.length && !movetypsId) {
      setMovetypsId(String(grgiMovetyps[0].movetyps_id))
    }
  }, [grgiMovetyps, movetypsId])

  useEffect(() => {
    load()
  }, [load])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      await api.createGrgi({
        item_id: Number(itemId),
        location_id: Number(locationId),
        lot: lot.trim(),
        move_qty: Number(moveQty),
        movetyps_id: Number(movetypsId),
        actual_at: datetimeLocalToIso(actualAt),
      })
      setSuccess('Movement posted.')
      setLot('')
      setMoveQty('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post movement')
    } finally {
      setSubmitting(false)
    }
  }

  const onMove = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      await api.createLocationMove({
        item_id: Number(itemId),
        from_location_id: Number(fromLocationId),
        to_location_id: Number(toLocationId),
        lot: moveLot.trim(),
        qty: Number(moveQtyMv),
        actual_at: datetimeLocalToIso(actualAt),
      })
      setSuccess('Location transfer (MV) posted.')
      setMoveLot('')
      setMoveQtyMv('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post location transfer')
    } finally {
      setSubmitting(false)
    }
  }

  const renderItemSelect = (form: 'grgi' | 'mv') => (
    <label className="erp-search-field erp-search-field-item" key={form}>
      <select
        className={`erp-input${itemId === '' ? ' erp-input-empty' : ''}`}
        value={itemId}
        aria-label="Item"
        onChange={(e) => setItemId(e.target.value)}
        required
      >
        <option value="">Item</option>
        {items.map((i) => (
          <option key={i.item_id} value={i.item_id}>
            {formatItemLabel(i)}
          </option>
        ))}
      </select>
    </label>
  )

  const renderActualAtInput = (form: 'grgi' | 'mv') => (
    <label className="erp-search-field erp-search-field-date" key={form}>
      <input
        type="datetime-local"
        className="erp-input erp-input-date"
        value={actualAt}
        aria-label="Actual Date/Time"
        onChange={(e) => setActualAt(e.target.value)}
        required
      />
    </label>
  )

  return (
    <ErpScreen error={error} success={success} className="erp-screen-stacked">
      <ErpSearchPanel>
        <form onSubmit={onSubmit} className="erp-search-form">
          <span className="erp-search-section-label">GR/GI</span>
          {renderItemSelect('grgi')}
          <label className="erp-search-field erp-search-field-supplier">
            <select
              className={`erp-input${locationId === '' ? ' erp-input-empty' : ''}`}
              value={locationId}
              aria-label="Location"
              onChange={(e) => setLocationId(e.target.value)}
              required
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
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              placeholder="Lot"
              aria-label="Lot"
              required
            />
          </label>
          <label className="erp-search-field">
            <select
              className="erp-input"
              value={movetypsId}
              aria-label="Move Type"
              onChange={(e) => setMovetypsId(e.target.value)}
              required
            >
              {grgiMovetyps.map((m) => (
                <option key={m.movetyps_id} value={m.movetyps_id}>
                  {m.movetyps_nm}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-search-field erp-search-field-qty">
            <input
              type="number"
              className="erp-input"
              step="0.001"
              min="0.001"
              value={moveQty}
              onChange={(e) => setMoveQty(e.target.value)}
              placeholder="Qty"
              aria-label="Qty"
              required
            />
          </label>
          {renderActualAtInput('grgi')}
          <div className="erp-search-actions">
            <button type="submit" className="btn erp-btn erp-btn-search" disabled={submitting}>
              {submitting ? 'Saving…' : 'Post GR/GI'}
            </button>
          </div>
        </form>
      </ErpSearchPanel>

      <ErpSearchPanel>
        <form onSubmit={onMove} className="erp-search-form">
          <span className="erp-search-section-label">MV</span>
          {renderItemSelect('mv')}
          <label className="erp-search-field erp-search-field-supplier">
            <select
              className={`erp-input${fromLocationId === '' ? ' erp-input-empty' : ''}`}
              value={fromLocationId}
              aria-label="From Location"
              onChange={(e) => setFromLocationId(e.target.value)}
              required
            >
              <option value="">From</option>
              {locations.map((l) => (
                <option key={l.location_id} value={l.location_id}>
                  {l.location_cd} / {l.location_nm}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-search-field erp-search-field-supplier">
            <select
              className={`erp-input${toLocationId === '' ? ' erp-input-empty' : ''}`}
              value={toLocationId}
              aria-label="To Location"
              onChange={(e) => setToLocationId(e.target.value)}
              required
            >
              <option value="">To</option>
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
              value={moveLot}
              onChange={(e) => setMoveLot(e.target.value)}
              placeholder="Lot"
              aria-label="Lot"
              required
            />
          </label>
          <label className="erp-search-field erp-search-field-qty">
            <input
              type="number"
              className="erp-input"
              step="0.001"
              min="0.001"
              value={moveQtyMv}
              onChange={(e) => setMoveQtyMv(e.target.value)}
              placeholder="Qty"
              aria-label="Qty"
              required
            />
          </label>
          {renderActualAtInput('mv')}
          <div className="erp-search-actions">
            <button type="submit" className="btn erp-btn erp-btn-search" disabled={submitting}>
              {submitting ? 'Saving…' : 'Post Transfer'}
            </button>
          </div>
        </form>
      </ErpSearchPanel>

      <ErpGridPanel
        gridId="inventory-grgi-history-v1"
        title="History"
        columns={grgiHistoryColumns}
        loading={loading}
        isEmpty={!loading && history.length === 0}
        emptyText="No history"
        onRefresh={load}
        panelClassName="erp-panel-grow-main"
      >
        {(layout) => (
          <tbody>
            {history.map((h, index) => (
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
                    case 'lot':
                      return (
                        <td key={col.key}>
                          <code>{h.lot}</code>
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
    </ErpScreen>
  )
}
