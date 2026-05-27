import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Alert } from '../components/Alert'
import { getDraftPageCopy, type DraftVariant } from '../config/draftPages'
import type { Supplier } from '../types'
import { datetimeLocalToIso, toDatetimeLocalValue } from '../utils/format'

type Props = {
  variant?: DraftVariant
}

export function DraftExcelImportPage({ variant = 'receipt' }: Props) {
  const copy = getDraftPageCopy(variant)
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
      .catch((e) => setError(e instanceof Error ? e.message : copy.masterLoadFail))
      .finally(() => setLoading(false))
  }, [copy.masterLoadFail])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!file) {
      setError(copy.selectExcel)
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
      }, variant)
      navigate(copy.listPathWithId(draft.inv_receipt_draft_id))
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.importFail)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <Link to={copy.listPath} className="back-link">
            {copy.backToList}
          </Link>
          <h1>{copy.excelTitle}</h1>
          <p className="page-desc">{copy.excelDesc}</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => api.downloadTemplate(variant)}
        >
          {copy.templateBtn}
        </button>
      </header>

      {error && <Alert type="error" message={error} />}

      <div className="card hint">
        <strong>{copy.excelFormatTitle}</strong>
        <ul className="help-list">
          <li>
            <code>lines</code> sheet (or first sheet), row 1: headers
          </li>
          <li>
            Required: <code>lot</code>, <code>qty</code>
          </li>
          <li>
            Item: one of <code>item_id</code>, <code>item_cd</code>, <code>item_nm</code>
          </li>
          <li>
            Location: one of <code>location_id</code>, <code>location_cd</code>, <code>location_nm</code>
          </li>
          <li>
            Optional: <code>header</code> sheet for date/reference (form values take priority)
          </li>
        </ul>
      </div>

      {loading ? (
        <p className="muted">{copy.loadingText}</p>
      ) : (
        <form className="card" onSubmit={handleSubmit}>
          <h2>{copy.uploadTitle}</h2>
          <div className="form-grid">
            <label className="full">
              {copy.excelFileLabel}
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </label>
            <label>
              {copy.dateTimeLabel}
              <input
                type="datetime-local"
                value={receiptAt}
                onChange={(e) => setReceiptAt(e.target.value)}
                required
              />
            </label>
            <label>
              {copy.referenceCol}
              <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
            </label>
            <label>
              {copy.supplierLabel}
              <select
                value={suppliersId}
                onChange={(e) =>
                  setSuppliersId(e.target.value === '' ? '' : Number(e.target.value))
                }
              >
                <option value="">{copy.noneOption}</option>
                {suppliers.map((s) => (
                  <option key={s.suppliers_id} value={s.suppliers_id}>
                    {s.suppliers_nm}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              {copy.notesLabel}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? copy.submittingImport : copy.submitImport}
            </button>
            <Link to={copy.listPath} className="btn btn-secondary">
              {copy.cancelBtn}
            </Link>
          </div>
        </form>
      )}
    </>
  )
}
