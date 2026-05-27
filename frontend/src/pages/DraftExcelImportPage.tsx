import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Alert } from '../components/Alert'
import type { Supplier } from '../types'
import { datetimeLocalToIso, toDatetimeLocalValue } from '../utils/format'

export function DraftExcelImportPage() {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [receiptAt, setReceiptAt] = useState(toDatetimeLocalValue())
  const [suppliersId, setSuppliersId] = useState<number | ''>('')
  const [referenceNo, setReferenceNo] = useState('')
  const [notes, setNotes] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .listSuppliers()
      .then(setSuppliers)
      .catch((e) => setError(e instanceof Error ? e.message : 'マスタ読み込み失敗'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!file) {
      setError('.xlsx ファイルを選択してください。')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const draft = await api.importExcel(file, {
        receipt_at: datetimeLocalToIso(receiptAt),
        suppliers_id: suppliersId === '' ? undefined : suppliersId,
        reference_no: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      navigate(`/drafts/${draft.inv_receipt_draft_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '取込に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <Link to="/" className="back-link">
            ← 一覧
          </Link>
          <h1>Excel 入荷リスト取込</h1>
          <p className="page-desc">
            テンプレートに明細を入力してアップロード。未承認ドラフトとして保存されます。
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => api.downloadTemplate()}>
          テンプレート DL
        </button>
      </header>

      {error && <Alert type="error" message={error} />}

      <div className="card hint">
        <strong>Excel 形式</strong>
        <ul className="help-list">
          <li>
            <code>lines</code> シート（または先頭シート）1行目: ヘッダ
          </li>
          <li>必須列: <code>lot</code>（ロット）, <code>qty</code>（数量）</li>
          <li>
            品目: <code>item_id</code> / <code>item_cd</code> / <code>item_nm</code> のいずれか
          </li>
          <li>
            任意: <code>header</code> シートで入荷日・参照番号（画面入力が優先）
          </li>
        </ul>
      </div>

      {loading ? (
        <p className="muted">読み込み中…</p>
      ) : (
        <form className="card" onSubmit={handleSubmit}>
          <h2>アップロード</h2>
          <div className="form-grid">
            <label className="full">
              Excel ファイル (.xlsx)
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </label>
            <label>
              入荷日時
              <input
                type="datetime-local"
                value={receiptAt}
                onChange={(e) => setReceiptAt(e.target.value)}
                required
              />
            </label>
            <label>
              参照番号
              <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
            </label>
            <label>
              仕入先
              <select
                value={suppliersId}
                onChange={(e) =>
                  setSuppliersId(e.target.value === '' ? '' : Number(e.target.value))
                }
              >
                <option value="">（未選択）</option>
                {suppliers.map((s) => (
                  <option key={s.suppliers_id} value={s.suppliers_id}>
                    {s.suppliers_nm}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              備考
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '取込中…' : '取込してドラフト作成'}
            </button>
            <Link to="/" className="btn btn-secondary">
              キャンセル
            </Link>
          </div>
        </form>
      )}
    </>
  )
}
