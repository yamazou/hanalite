import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { Alert } from '../components/Alert'
import type { Item } from '../types'
import type { CurrentStock } from '../types/inventory'
import { formatDateTime, formatItemLabel, formatQty } from '../utils/format'

export function CurrentStockPage() {
  const [items, setItems] = useState<Item[]>([])
  const [lot, setLot] = useState('')
  const [itemId, setItemId] = useState('')
  const [includeZero, setIncludeZero] = useState(false)
  const [rows, setRows] = useState<CurrentStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listItems().then(setItems).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listCurrentStock({
        lot: lot.trim() || undefined,
        item_id: itemId ? Number(itemId) : undefined,
        include_zero: includeZero,
      })
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [lot, itemId, includeZero])

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
          <h1>現在庫</h1>
          <p className="page-desc">品目×ロットの現在数量</p>
        </div>
      </header>

      {error && <Alert type="error" message={error} />}

      <div className="card">
        <form className="form-grid filter-form" onSubmit={onSearch}>
          <label>
            ロット
            <input value={lot} onChange={(e) => setLot(e.target.value)} placeholder="部分一致" />
          </label>
          <label>
            品目
            <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">すべて</option>
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
            ゼロ在庫も表示
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              検索
            </button>
            <button type="button" className="btn btn-secondary" onClick={load}>
              更新
            </button>
          </div>
        </form>

        {loading ? (
          <p className="muted">読み込み中…</p>
        ) : rows.length === 0 ? (
          <p className="muted">該当データがありません</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>品目</th>
                <th>種別</th>
                <th>ロット</th>
                <th className="num">数量</th>
                <th>更新日時</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.inv_current_id}>
                  <td>{r.item_nm}</td>
                  <td>{r.itemtyp_nm}</td>
                  <td>
                    <code>{r.lot}</code>
                  </td>
                  <td className="num">{formatQty(r.qty)}</td>
                  <td>{formatDateTime(r.updated_at)}</td>
                  <td>
                    <Link to={`/trace?lot=${encodeURIComponent(r.lot)}`} className="link">
                      トレース
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
