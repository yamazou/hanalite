import { FormEvent, useState } from 'react'
import { AppLink, useAppNavigate } from '../context/AppNavigateContext'
import { api } from '../api/client'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpSearchPanel } from '../components/erp/ErpSearchPanel'

export function ProductionExcelImportPage() {
  const navigate = useAppNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Please select an .xlsx file.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.importProductionExcel(file)
      navigate('/production/orders')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import production header')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ErpScreen error={error}>
      <ErpSearchPanel>
        <div className="erp-search-form">
          <AppLink to="/production/orders" className="btn erp-btn erp-btn-clear">
            Back to list
          </AppLink>
          <span className="erp-search-section-label">Production Excel Import</span>
        </div>
      </ErpSearchPanel>
      <div className="erp-panel erp-panel-hint">
        <div className="erp-panel-title">Excel Import</div>
        <div className="erp-panel-body">
          <p className="muted">
            Header only. Row1: headers / Row2: values (production_date, reference_no,
            parent_item_id or parent_item_cd, planned_qty, lot, notes).
          </p>
        </div>
      </div>
      <ErpSearchPanel>
        <form onSubmit={onSubmit} className="erp-search-form erp-search-form-production-import">
          <label className="erp-search-field erp-search-field-grow">
            <input
              type="file"
              className="erp-input"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </label>
          <div className="erp-search-actions">
            <button type="submit" className="btn erp-btn erp-btn-search" disabled={submitting}>
              {submitting ? 'Importing…' : 'Import'}
            </button>
            <AppLink to="/production/orders" className="btn erp-btn erp-btn-clear">
              Cancel
            </AppLink>
          </div>
        </form>
      </ErpSearchPanel>
    </ErpScreen>
  )
}
