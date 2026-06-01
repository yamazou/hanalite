import { FormEvent, useState } from 'react'
import { AppLink, useAppNavigate } from '../context/AppNavigateContext'
import { api } from '../api/client'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpSearchPanel } from '../components/erp/ErpSearchPanel'
import { getDraftPageCopy } from '../config/draftPages'
import { useMasterCatalog } from '../context/MasterCatalogContext'
import { dateInputToIso, toDateInputValue } from '../utils/format'

export function DraftPdfImportPage() {
  const copy = getDraftPageCopy('receipt')
  const navigate = useAppNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [receiptAt, setReceiptAt] = useState(toDateInputValue())
  const [suppliersId, setSuppliersId] = useState<number | ''>('')
  const [referenceNo, setReferenceNo] = useState('')
  const [notes, setNotes] = useState('')
  const { suppliers, ready: catalogReady } = useMasterCatalog()
  const loading = !catalogReady
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!file) {
      setError('Please select a .pdf file.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const draft = await api.importPdf(file, {
        receipt_at: dateInputToIso(receiptAt),
        suppliers_id: suppliersId === '' ? undefined : suppliersId,
        reference_no: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      navigate(copy.listPathWithId(draft.inv_receipt_draft_id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ErpScreen error={error} title="PDF Receipt Import">
      <ErpSearchPanel>
        <div className="erp-search-form">
          <AppLink to="/" className="btn erp-btn erp-btn-clear">
            ← Back to List
          </AppLink>
        </div>
      </ErpSearchPanel>

      <div className="erp-panel erp-panel-hint">
        <div className="erp-panel-title">About PDF Import</div>
        <div className="erp-panel-body">
          <ul className="help-list">
            <li>Auto extraction may fail when supplier layouts differ.</li>
            <li>Even in that case, the PDF is attached to the draft and lines can be entered manually.</li>
            <li>Accuracy improves with table-structured PDFs (item / lot / qty columns).</li>
          </ul>
        </div>
      </div>

      {loading ? (
        <p className="muted erp-grid-empty">Loading…</p>
      ) : (
        <ErpSearchPanel>
          <form onSubmit={handleSubmit} className="erp-search-form erp-search-form-production-import">
            <label className="erp-search-field erp-search-field-grow">
              <input
                type="file"
                className="erp-input"
                accept=".pdf,application/pdf"
                aria-label="PDF file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </label>
            <label className="erp-search-field erp-search-field-date">
              <input
                type="date"
                className="erp-input erp-input-date"
                value={receiptAt}
                aria-label="Receipt Date"
                onChange={(e) => setReceiptAt(e.target.value)}
                required
              />
            </label>
            <label className="erp-search-field erp-search-field-reference">
              <input
                className="erp-input"
                value={referenceNo}
                placeholder="Reference No."
                aria-label="Reference No."
                onChange={(e) => setReferenceNo(e.target.value)}
              />
            </label>
            <label className="erp-search-field erp-search-field-supplier">
              <select
                className={`erp-input${suppliersId === '' ? ' erp-input-empty' : ''}`}
                value={suppliersId}
                aria-label="Supplier"
                onChange={(e) =>
                  setSuppliersId(e.target.value === '' ? '' : Number(e.target.value))
                }
              >
                <option value="">Supplier</option>
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
                placeholder="Notes"
                aria-label="Notes"
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <div className="erp-search-actions">
              <button type="submit" className="btn erp-btn erp-btn-search" disabled={submitting}>
                {submitting ? 'Importing…' : 'Import and create draft'}
              </button>
              <AppLink to="/" className="btn erp-btn erp-btn-clear">
                Cancel
              </AppLink>
            </div>
          </form>
        </ErpSearchPanel>
      )}
    </ErpScreen>
  )
}
