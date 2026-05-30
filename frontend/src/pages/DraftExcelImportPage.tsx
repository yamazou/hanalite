import { FormEvent, useState } from 'react'
import { AppLink, useAppNavigate } from '../context/AppNavigateContext'
import { api } from '../api/client'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpSearchPanel } from '../components/erp/ErpSearchPanel'
import { getDraftPageCopy, type DraftVariant } from '../config/draftPages'
import { useMasterCatalog } from '../context/MasterCatalogContext'
import { dateInputToIso, toDateInputValue } from '../utils/format'

type Props = {
  variant?: DraftVariant
}

export function DraftExcelImportPage({ variant = 'receipt' }: Props) {
  const copy = getDraftPageCopy(variant)
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
      setError(copy.selectExcel)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const draft = await api.importExcel(file, {
        receipt_at: dateInputToIso(receiptAt),
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
    <ErpScreen error={error} title={copy.excelTitle}>
      <ErpSearchPanel>
        <div className="erp-search-form">
          <AppLink to={copy.listPath} className="btn erp-btn erp-btn-clear">
            {copy.backToList}
          </AppLink>
          <div className="erp-search-actions">
            <button
              type="button"
              className="btn erp-btn erp-btn-clear"
              onClick={() => api.downloadTemplate(variant)}
            >
              {copy.templateBtn}
            </button>
          </div>
        </div>
      </ErpSearchPanel>

      <div className="erp-panel erp-panel-hint">
        <div className="erp-panel-title">{copy.excelFormatTitle}</div>
        <div className="erp-panel-body">
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
      </div>

      {loading ? (
        <p className="muted erp-grid-empty">{copy.loadingText}</p>
      ) : (
        <ErpSearchPanel>
          <form onSubmit={handleSubmit} className="erp-search-form erp-search-form-production-import">
            <label className="erp-search-field erp-search-field-grow">
              <input
                type="file"
                className="erp-input"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                aria-label={copy.excelFileLabel}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </label>
            <label className="erp-search-field erp-search-field-date">
              <input
                type="date"
                className="erp-input erp-input-date"
                value={receiptAt}
                aria-label={copy.dateTimeLabel}
                onChange={(e) => setReceiptAt(e.target.value)}
                required
              />
            </label>
            <label className="erp-search-field erp-search-field-reference">
              <input
                className="erp-input"
                value={referenceNo}
                placeholder={copy.referenceCol}
                aria-label={copy.referenceCol}
                onChange={(e) => setReferenceNo(e.target.value)}
              />
            </label>
            <label className="erp-search-field erp-search-field-supplier">
              <select
                className={`erp-input${suppliersId === '' ? ' erp-input-empty' : ''}`}
                value={suppliersId}
                aria-label={copy.supplierLabel}
                onChange={(e) =>
                  setSuppliersId(e.target.value === '' ? '' : Number(e.target.value))
                }
              >
                <option value="">{copy.supplierLabel}</option>
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
                placeholder={copy.notesLabel}
                aria-label={copy.notesLabel}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <div className="erp-search-actions">
              <button type="submit" className="btn erp-btn erp-btn-search" disabled={submitting}>
                {submitting ? copy.submittingImport : copy.submitImport}
              </button>
              <AppLink to={copy.listPath} className="btn erp-btn erp-btn-clear">
                {copy.cancelBtn}
              </AppLink>
            </div>
          </form>
        </ErpSearchPanel>
      )}
    </ErpScreen>
  )
}
