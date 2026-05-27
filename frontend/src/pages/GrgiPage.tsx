import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { Alert } from '../components/Alert'
import type { Item } from '../types'
import type { GrgiHistory, MoveTyp } from '../types/inventory'
import { datetimeLocalToIso, formatDateTime, formatItemLabel, formatQty, toDatetimeLocalValue } from '../utils/format'

export function GrgiPage() {
  const [history, setHistory] = useState<GrgiHistory[]>([])
  const [movetyps, setMovetyps] = useState<MoveTyp[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [itemId, setItemId] = useState('')
  const [lot, setLot] = useState('')
  const [moveQty, setMoveQty] = useState('')
  const [movetypsId, setMovetypsId] = useState('')
  const [actualAt, setActualAt] = useState(toDatetimeLocalValue())
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [h, m, i] = await Promise.all([
        api.listGrgiHistory(80),
        api.listMovetyps(),
        api.listItems(),
      ])
      setHistory(h)
      setMovetyps(m)
      setItems(i)
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (movetyps.length && !movetypsId) {
      setMovetypsId(String(movetyps[0].movetyps_id))
    }
  }, [movetyps, movetypsId])

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
        lot: lot.trim(),
        move_qty: Number(moveQty),
        movetyps_id: Number(movetypsId),
        actual_at: datetimeLocalToIso(actualAt),
      })
      setSuccess('入出庫を登録しました')
      setLot('')
      setMoveQty('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>入出庫（GR/GI）</h1>
          <p className="page-desc">手動の入庫・出庫を登録します</p>
        </div>
      </header>

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      <div className="card">
        <h2>新規登録</h2>
        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            品目 *
            <select value={itemId} onChange={(e) => setItemId(e.target.value)} required>
              <option value="">選択</option>
              {items.map((i) => (
                <option key={i.item_id} value={i.item_id}>
                  {formatItemLabel(i)}
                </option>
              ))}
            </select>
          </label>
          <label>
            ロット *
            <input value={lot} onChange={(e) => setLot(e.target.value)} required />
          </label>
          <label>
            移動区分 *
            <select value={movetypsId} onChange={(e) => setMovetypsId(e.target.value)} required>
              {movetyps.map((m) => (
                <option key={m.movetyps_id} value={m.movetyps_id}>
                  {m.movetyps_nm}
                </option>
              ))}
            </select>
          </label>
          <label>
            数量 *
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
            実績日時 *
            <input
              type="datetime-local"
              value={actualAt}
              onChange={(e) => setActualAt(e.target.value)}
              required
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '登録中…' : '登録'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header-row">
          <h2>履歴</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
            更新
          </button>
        </div>
        {loading ? (
          <p className="muted">読み込み中…</p>
        ) : history.length === 0 ? (
          <p className="muted">履歴なし</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>品目</th>
                <th>ロット</th>
                <th>区分</th>
                <th className="num">移動量</th>
                <th className="num">残数量</th>
                <th>実績日時</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.inv_grgi_id}>
                  <td>{h.inv_grgi_id}</td>
                  <td>{h.item_nm}</td>
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
