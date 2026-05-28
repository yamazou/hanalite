import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpSearchPanel } from '../components/erp/ErpSearchPanel'
import { getDraftPageCopy } from '../config/draftPages'
import type { Supplier } from '../types'
import { datetimeLocalToIso, toDatetimeLocalValue } from '../utils/format'

export function DraftPdfImportPage() {
  const copy = getDraftPageCopy('receipt')
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
      setError('.pdf ファイルを選択してください。')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const draft = await api.importPdf(file, {
        receipt_at: datetimeLocalToIso(receiptAt),
        suppliers_id: suppliersId === '' ? undefined : suppliersId,
        reference_no: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      navigate(copy.listPathWithId(draft.inv_receipt_draft_id))
    } catch (err) {
      setError(err instanceof Error ? err.message : '取込に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ErpScreen error={error}>
      <ErpSearchPanel>
        <div className="erp-search-form">
          <Link to="/" className="erp-link">
            ← 一覧
          </Link>
          <span className="erp-search-section-label">PDF 入荷リスト取込</span>
        </div>
      </ErpSearchPanel>

      <div className="erp-panel erp-panel-hint">
        <div className="erp-panel-title">PDF 取込について</div>
        <div className="erp-panel-body">
          <ul className="help-list">
            <li>取引先ごとにレイアウトが異なる場合、自動抽出できないことがあります</li>
            <li>その場合も PDF はドラフトに添付され、目検後に明細を手入力できます</li>
            <li>表形式（品目・ロット・数量の列）がある PDF で精度が上がります</li>
          </ul>
        </div>
      </div>

      {loading ? (
        <p className="muted erp-grid-empty">読み込み中…</p>
      ) : (
        <ErpSearchPanel>
          <form onSubmit={handleSubmit} className="erp-search-form">
            <label className="erp-search-field erp-search-field-grow">
              <input
                type="file"
                className="erp-input"
                accept=".pdf,application/pdf"
                aria-label="PDF ファイル"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </label>
            <label className="erp-search-field erp-search-field-date">
              <input
                type="datetime-local"
                className="erp-input erp-input-date"
                value={receiptAt}
                aria-label="入荷日時"
                onChange={(e) => setReceiptAt(e.target.value)}
                required
              />
            </label>
            <label className="erp-search-field erp-search-field-reference">
              <input
                className="erp-input"
                value={referenceNo}
                placeholder="参照番号"
                aria-label="参照番号"
                onChange={(e) => setReferenceNo(e.target.value)}
              />
            </label>
            <label className="erp-search-field erp-search-field-supplier">
              <select
                className={`erp-input${suppliersId === '' ? ' erp-input-empty' : ''}`}
                value={suppliersId}
                aria-label="仕入先"
                onChange={(e) =>
                  setSuppliersId(e.target.value === '' ? '' : Number(e.target.value))
                }
              >
                <option value="">仕入先</option>
                {suppliers.map((s) => (
                  <option key={s.suppliers_id} value={s.suppliers_id}>
                    {s.suppliers_nm}
                  </option>
                ))}
              </select>
            </label>
            <label className="erp-search-field erp-search-field-grow">
              <input
                className="erp-input"
                value={notes}
                placeholder="備考"
                aria-label="備考"
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <div className="erp-search-actions">
              <button type="submit" className="btn erp-btn erp-btn-search" disabled={submitting}>
                {submitting ? '取込中…' : '取込してドラフト作成'}
              </button>
              <Link to="/" className="btn erp-btn erp-btn-clear">
                キャンセル
              </Link>
            </div>
          </form>
        </ErpSearchPanel>
      )}
    </ErpScreen>
  )
}
