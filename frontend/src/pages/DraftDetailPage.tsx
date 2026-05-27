import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { AddDraftLineForm } from '../components/AddDraftLineForm'
import { Alert } from '../components/Alert'
import { StatusBadge } from '../components/StatusBadge'
import type { DraftDetail } from '../types'
import { formatDateTime, formatQty } from '../utils/format'

export function DraftDetailPage() {
  const { id } = useParams<{ id: string }>()
  const draftId = Number(id)
  const [draft, setDraft] = useState<DraftDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    if (!draftId || Number.isNaN(draftId)) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.getDraft(draftId)
      setDraft(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [draftId])

  useEffect(() => {
    load()
  }, [load])

  async function handleApprove() {
    if (!draft || !confirm('この入荷リストを承認し、在庫へ反映しますか？')) return
    setActing(true)
    setError(null)
    setMessage(null)
    try {
      const updated = await api.approveDraft(draft.inv_receipt_draft_id)
      setDraft(updated)
      setMessage('承認しました。在庫へ反映済みです。')
    } catch (e) {
      setError(e instanceof Error ? e.message : '承認に失敗しました')
    } finally {
      setActing(false)
    }
  }

  async function handleCancel() {
    if (!draft) return
    const msg =
      draft.status === 'approved'
        ? '承認済みの入荷をキャンセルします。在庫はマイナス記録で戻されます。よろしいですか？'
        : 'この入荷ドラフトをキャンセルしますか？'
    if (!confirm(msg)) return
    setActing(true)
    setError(null)
    setMessage(null)
    try {
      const updated = await api.cancelDraft(draft.inv_receipt_draft_id)
      setDraft(updated)
      setMessage('キャンセルしました。')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'キャンセルに失敗しました')
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return <p className="muted">読み込み中…</p>
  }

  if (!draft) {
    return (
      <>
        {error && <Alert type="error" message={error} />}
        <Link to="/">一覧へ戻る</Link>
      </>
    )
  }

  const canApprove = draft.status === 'registered' && draft.lines.length > 0
  const canCancel = draft.status === 'registered' || draft.status === 'approved'

  return (
    <>
      <header className="page-header">
        <div>
          <Link to="/" className="back-link">
            ← 一覧
          </Link>
          <h1>入荷ドラフト #{draft.inv_receipt_draft_id}</h1>
          <StatusBadge status={draft.status} />
        </div>
        <div className="action-group">
          {canApprove && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={acting}
              onClick={handleApprove}
            >
              承認（在庫反映）
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={acting}
              onClick={handleCancel}
            >
              キャンセル
            </button>
          )}
        </div>
      </header>

      {error && <Alert type="error" message={error} />}
      {message && <Alert type="success" message={message} />}
      {draft.parse_message && draft.status === 'registered' && (
        <div className="card hint">
          <strong>取込メッセージ:</strong> {draft.parse_message}
        </div>
      )}

      {draft.has_attachment && (
        <div className="card">
          <h2>添付 PDF</h2>
          <p className="muted">{draft.attachment_original_name}</p>
          <a
            className="btn btn-secondary btn-sm"
            href={api.attachmentUrl(draft.inv_receipt_draft_id)}
            target="_blank"
            rel="noreferrer"
          >
            PDF を開く
          </a>
          <iframe
            className="pdf-preview"
            title="Receipt PDF"
            src={api.attachmentUrl(draft.inv_receipt_draft_id)}
          />
        </div>
      )}

      <div className="card grid-2">
        <div>
          <h2>ヘッダ</h2>
          <dl className="detail-list">
            <dt>入荷日</dt>
            <dd>{formatDateTime(draft.receipt_at)}</dd>
            <dt>参照番号</dt>
            <dd>{draft.reference_no ?? '-'}</dd>
            <dt>仕入先</dt>
            <dd>{draft.supplier_nm ?? '-'}</dd>
            <dt>備考</dt>
            <dd>{draft.notes ?? '-'}</dd>
            <dt>承認日時</dt>
            <dd>{formatDateTime(draft.approved_at)}</dd>
            <dt>キャンセル日時</dt>
            <dd>{formatDateTime(draft.cancelled_at)}</dd>
          </dl>
        </div>
        <div>
          <h2>明細（目検）</h2>
          {draft.lines.length === 0 && (
            <p className="muted">明細がありません。下のフォームから追加してください。</p>
          )}
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>品目</th>
                <th>ロット</th>
                <th>数量</th>
              </tr>
            </thead>
            <tbody>
              {draft.lines.map((line) => (
                <tr key={line.inv_receipt_draft_line_id}>
                  <td>{line.line_no}</td>
                  <td>
                    {line.item_nm ?? '-'}
                    <span className="muted small"> (ID:{line.item_id})</span>
                  </td>
                  <td>
                    <code>{line.lot}</code>
                  </td>
                  <td>{formatQty(line.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {draft.status === 'registered' && (
            <AddDraftLineForm draftId={draft.inv_receipt_draft_id} onAdded={load} />
          )}
        </div>
      </div>

      {draft.status === 'registered' && (
        <div className="card hint">
          <strong>次の操作:</strong> 明細を目検し、問題なければ「承認（在庫反映）」を押してください。
        </div>
      )}
    </>
  )
}
