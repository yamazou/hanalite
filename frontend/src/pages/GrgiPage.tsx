import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { Alert } from '../components/Alert'
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

  return (
    <>
      <header className="page-header">
        <div>
          <h1>GR/GI Movements</h1>
          <p className="page-desc">Post manual receipts and issues</p>
        </div>
      </header>

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      <div className="card">
        <h2>New GR/GI Entry</h2>
        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            Item *
            <select value={itemId} onChange={(e) => setItemId(e.target.value)} required>
              <option value="">Select</option>
              {items.map((i) => (
                <option key={i.item_id} value={i.item_id}>
                  {formatItemLabel(i)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Location *
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} required>
              <option value="">Select</option>
              {locations.map((l) => (
                <option key={l.location_id} value={l.location_id}>
                  {l.location_cd} / {l.location_nm}
                </option>
              ))}
            </select>
          </label>
          <label>
            Lot *
            <input value={lot} onChange={(e) => setLot(e.target.value)} required />
          </label>
          <label>
            Move Type *
            <select value={movetypsId} onChange={(e) => setMovetypsId(e.target.value)} required>
              {grgiMovetyps.map((m) => (
                <option key={m.movetyps_id} value={m.movetyps_id}>
                  {m.movetyps_nm}
                </option>
              ))}
            </select>
          </label>
          <label>
            Qty *
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={moveQty}
              onChange={(e) => setMoveQty(e.target.value)}
              required
            />
          </label>
          <label>
            Actual Date/Time *
            <input
              type="datetime-local"
              value={actualAt}
              onChange={(e) => setActualAt(e.target.value)}
              required
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Location Transfer (MV)</h2>
        <form className="form-grid" onSubmit={onMove}>
          <label>
            Item *
            <select value={itemId} onChange={(e) => setItemId(e.target.value)} required>
              <option value="">Select</option>
              {items.map((i) => (
                <option key={i.item_id} value={i.item_id}>
                  {formatItemLabel(i)}
                </option>
              ))}
            </select>
          </label>
          <label>
            From Location *
            <select value={fromLocationId} onChange={(e) => setFromLocationId(e.target.value)} required>
              <option value="">Select</option>
              {locations.map((l) => (
                <option key={l.location_id} value={l.location_id}>
                  {l.location_cd} / {l.location_nm}
                </option>
              ))}
            </select>
          </label>
          <label>
            To Location *
            <select value={toLocationId} onChange={(e) => setToLocationId(e.target.value)} required>
              <option value="">Select</option>
              {locations.map((l) => (
                <option key={l.location_id} value={l.location_id}>
                  {l.location_cd} / {l.location_nm}
                </option>
              ))}
            </select>
          </label>
          <label>
            Lot *
            <input value={moveLot} onChange={(e) => setMoveLot(e.target.value)} required />
          </label>
          <label>
            Qty *
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={moveQtyMv}
              onChange={(e) => setMoveQtyMv(e.target.value)}
              required
            />
          </label>
          <label>
            Actual Date/Time *
            <input
              type="datetime-local"
              value={actualAt}
              onChange={(e) => setActualAt(e.target.value)}
              required
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Post Transfer'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header-row">
          <h2>History</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : history.length === 0 ? (
          <p className="muted">No history</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Item</th>
                <th>Location</th>
                <th>Lot</th>
                <th>Type</th>
                <th className="num">Move Qty</th>
                <th className="num">Balance Qty</th>
                <th>Actual Date/Time</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.inv_grgi_id}>
                  <td>{h.inv_grgi_id}</td>
                  <td>{h.item_nm}</td>
                  <td>
                    <code>{h.location_cd}</code> {h.location_nm}
                  </td>
                  <td>
                    <code>{h.lot}</code>
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
      </div>
    </>
  )
}
