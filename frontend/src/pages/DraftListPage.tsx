import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { Alert } from '../components/Alert'
import { StatusBadge } from '../components/StatusBadge'
import type { DraftListItem, DraftStatus } from '../types'
import { formatDateTime } from '../utils/format'

const sourceLabel: Record<string, string> = {
  manual: '手入力',
  excel: 'Excel',
  pdf: 'PDF',
}

const filters: { value: '' | DraftStatus; label: string }[] = [
  { value: '', label: 'すべて' },
  { value: 'registered', label: '未承認' },
  { value: 'approved', label: '承認済' },
  { value: 'cancelled', label: 'キャンセル' },
]

export function DraftListPage() {
  const [status, setStatus] = useState<'' | DraftStatus>('')
  const [drafts, setDrafts] = useState<DraftListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listDrafts(status || undefined)
      setDrafts(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <header className="page-header">
        <div>
          <h1>入荷ドラフト一覧</h1>
          <p className="page-desc">目検後に承認すると在庫へ反映されます</p>
        </div>
        <div className="action-group">
          <Link to="/drafts/new" className="btn btn-primary">
            新規入荷登録
          </Link>
          <Link to="/drafts/import" className="btn btn-secondary">
            Excel 取込
          </Link>
          <Link to="/drafts/import-pdf" className="btn btn-secondary">
            PDF 取込
          </Link>
        </div>
      </header>

      {error && <Alert type="error" message={error} />}

      <div className="card">
        <div className="filter-bar">
          {filters.map((f) => (
            <button
              key={f.value || 'all'}
              type="button"
              className={`filter-btn ${status === f.value ? 'active' : ''}`}
              onClick={() => setStatus(f.value)}
            >
              {f.label}
            </button>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
            更新
          </button>
        </div>

        {loading ? (
          <p className="muted">読み込み中…</p>
        ) : drafts.length === 0 ? (
          <p className="muted">データがありません</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>取込</th>
                <th>ステータス</th>
                <th>入荷日</th>
                <th>参照番号</th>
                <th>仕入先</th>
                <th>明細数</th>
                <th>登録日時</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr key={d.inv_receipt_draft_id}>
                  <td>{d.inv_receipt_draft_id}</td>
                  <td>{sourceLabel[d.source_type] ?? d.source_type}</td>
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                  <td>{formatDateTime(d.receipt_at)}</td>
                  <td>{d.reference_no ?? '-'}</td>
                  <td>{d.supplier_nm ?? '-'}</td>
                  <td>{d.line_count}</td>
                  <td>{formatDateTime(d.created_at)}</td>
                  <td>
                    <Link
                      to={`/drafts/${d.inv_receipt_draft_id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      詳細
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
