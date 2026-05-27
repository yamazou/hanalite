import { FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Alert } from '../components/Alert'
import type { LotTraceResult } from '../types/inventory'
import { formatDateTime, formatQty } from '../utils/format'

export function LotTracePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [lot, setLot] = useState(() => searchParams.get('lot') ?? '')
  const [result, setResult] = useState<LotTraceResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runTrace = async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('ロット番号を入力してください')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await api.traceLot(trimmed)
      setResult(data)
      setSearchParams({ lot: trimmed })
    } catch (e) {
      setResult(null)
      setError(e instanceof Error ? e.message : 'トレースに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void runTrace(lot)
  }

  useEffect(() => {
    const q = searchParams.get('lot')?.trim()
    if (q) {
      setLot(q)
      void runTrace(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial URL lot only
  }, [])

  return (
    <>
      <header className="page-header">
        <div>
          <h1>ロットトレース</h1>
          <p className="page-desc">ロット単位の現在庫・入出庫履歴・月次残高</p>
        </div>
      </header>

      <div className="card">
        <form className="filter-form" onSubmit={onSubmit}>
          <label>
            ロット番号
            <input
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              placeholder="例: LOT-2024-001"
              required
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '検索中…' : 'トレース'}
          </button>
        </form>
      </div>

      {error && <Alert type="error" message={error} />}

      {result && (
        <>
          <section className="card">
            <h2>現在庫 — {result.lot}</h2>
            {result.current.length === 0 ? (
              <p className="muted">現在庫なし</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>品目</th>
                    <th>種別</th>
                    <th className="num">数量</th>
                    <th>更新日時</th>
                  </tr>
                </thead>
                <tbody>
                  {result.current.map((c, i) => (
                    <tr key={i}>
                      <td>{c.item_nm}</td>
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
            <h2>入出庫履歴</h2>
            {result.history.length === 0 ? (
              <p className="muted">履歴なし</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>品目</th>
                    <th>区分</th>
                    <th className="num">移動量</th>
                    <th className="num">残数量</th>
                    <th>実績日時</th>
                  </tr>
                </thead>
                <tbody>
                  {result.history.map((h) => (
                    <tr key={h.inv_grgi_id}>
                      <td>{h.inv_grgi_id}</td>
                      <td>{h.item_nm}</td>
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
            <h2>月次残高スナップショット</h2>
            {result.balances.length === 0 ? (
              <p className="muted">残高データなし</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>期間</th>
                    <th>品目</th>
                    <th className="num">期首数量</th>
                    <th className="num">期末数量</th>
                    <th>期首日時</th>
                  </tr>
                </thead>
                <tbody>
                  {result.balances.map((b, i) => (
                    <tr key={i}>
                      <td>{b.period_year_month}</td>
                      <td>{b.item_nm}</td>
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
