import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { Alert } from '../components/Alert'
import type { BalanceItem } from '../types/inventory'
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
  const [createPeriod, setCreatePeriod] = useState(currentPeriod())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listBalances(period || undefined)
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
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
      setError('期間は YYYYMM 形式で入力してください')
      return
    }
    setCreating(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await api.createPeriodBalance(p)
      setSuccess(`${res.period_year_month} の残高を ${res.rows_saved} 件保存しました`)
      setPeriod(p)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '作成に失敗しました')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>月次残高</h1>
          <p className="page-desc">現在庫から期間スナップショットを作成・参照</p>
        </div>
      </header>

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      <div className="card">
        <h2>スナップショット作成</h2>
        <form className="filter-form" onSubmit={onCreate}>
          <label>
            対象期間 (YYYYMM)
            <input
              value={createPeriod}
              onChange={(e) => setCreatePeriod(e.target.value)}
              pattern="\d{6}"
              placeholder="202605"
              required
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? '作成中…' : '現在庫から作成'}
          </button>
        </form>
      </div>

      <div className="card">
        <form className="filter-form" onSubmit={onFilter}>
          <label>
            表示期間 (YYYYMM)
            <input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="空欄ですべて"
              pattern="\d{6}|"
            />
          </label>
          <button type="submit" className="btn btn-secondary">
            検索
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
            更新
          </button>
        </form>

        {loading ? (
          <p className="muted">読み込み中…</p>
        ) : rows.length === 0 ? (
          <p className="muted">該当データがありません</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>期間</th>
                <th>品目</th>
                <th>ロット</th>
                <th className="num">期首数量</th>
                <th className="num">期末数量</th>
                <th>期首日時</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.inv_balance_id}>
                  <td>{r.period_year_month}</td>
                  <td>{r.item_nm}</td>
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
