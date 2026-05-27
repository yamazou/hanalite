import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Alert } from '../components/Alert'
import type { DraftLineInput, Item, Supplier } from '../types'
import { datetimeLocalToIso, formatItemLabel, toDatetimeLocalValue } from '../utils/format'

type LineForm = DraftLineInput & { key: string }

function emptyLine(lineNo: number): LineForm {
  return { key: crypto.randomUUID(), item_id: 0, lot: '', qty: 0, line_no: lineNo }
}

export function DraftCreatePage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Item[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [receiptAt, setReceiptAt] = useState(toDatetimeLocalValue())
  const [suppliersId, setSuppliersId] = useState<number | ''>('')
  const [referenceNo, setReferenceNo] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineForm[]>([emptyLine(1)])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.listItems(), api.listSuppliers()])
      .then(([i, s]) => {
        setItems(i)
        setSuppliers(s)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'マスタ読み込み失敗'))
      .finally(() => setLoading(false))
  }, [])

  function updateLine(index: number, patch: Partial<LineForm>) {
    setLines((prev) => prev.map((ln, i) => (i === index ? { ...ln, ...patch } : ln)))
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine(prev.length + 1)])
  }

  function removeLine(index: number) {
    if (lines.length <= 1) return
    setLines((prev) =>
      prev.filter((_, i) => i !== index).map((ln, i) => ({ ...ln, line_no: i + 1 }))
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const validLines = lines.filter((l) => l.item_id > 0 && l.lot.trim() && l.qty > 0)
    if (validLines.length === 0) {
      setError('明細を1行以上、品目・ロット・数量を入力してください。')
      return
    }

    setSubmitting(true)
    try {
      const draft = await api.createDraft({
        receipt_at: datetimeLocalToIso(receiptAt),
        suppliers_id: suppliersId === '' ? null : suppliersId,
        reference_no: referenceNo.trim() || null,
        notes: notes.trim() || null,
        lines: validLines.map((l, i) => ({
          item_id: l.item_id,
          lot: l.lot.trim(),
          qty: l.qty,
          line_no: i + 1,
        })),
      })
      navigate(`/drafts/${draft.inv_receipt_draft_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="muted">マスタ読み込み中…</p>
  }

  return (
    <>
      <header className="page-header">
        <div>
          <Link to="/" className="back-link">
            ← 一覧
          </Link>
          <h1>新規入荷登録（マニュアル）</h1>
          <p className="page-desc">登録後は「未承認」状態。目検後に承認してください。</p>
        </div>
      </header>

      {error && <Alert type="error" message={error} />}

      <form className="card" onSubmit={handleSubmit}>
        <h2>ヘッダ</h2>
        <div className="form-grid">
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
            参照番号（PO / 納品書など）
            <input
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="PO-2026-001"
            />
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

        <h2>明細</h2>
        {lines.map((line, index) => (
          <div key={line.key} className="line-row">
            <span className="line-no">{index + 1}</span>
            <label>
              品目
              <select
                value={line.item_id || ''}
                onChange={(e) => updateLine(index, { item_id: Number(e.target.value) })}
                required
              >
                <option value="">選択</option>
                {items.map((item) => (
                  <option key={item.item_id} value={item.item_id}>
                    {formatItemLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ロット
              <input
                value={line.lot}
                onChange={(e) => updateLine(index, { lot: e.target.value })}
                placeholder="LOT-001"
                required
              />
            </label>
            <label>
              数量
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={line.qty || ''}
                onChange={(e) => updateLine(index, { qty: parseFloat(e.target.value) || 0 })}
                required
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => removeLine(index)}
              disabled={lines.length <= 1}
            >
              削除
            </button>
          </div>
        ))}

        <button type="button" className="btn btn-secondary" onClick={addLine}>
          明細を追加
        </button>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? '登録中…' : '登録（未承認で保存）'}
          </button>
          <Link to="/" className="btn btn-secondary">
            キャンセル
          </Link>
        </div>
      </form>
    </>
  )
}
