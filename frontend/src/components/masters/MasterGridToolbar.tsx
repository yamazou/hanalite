import type { ReactNode } from 'react'

type Props = {
  displayRowCount: number
  submitting: boolean
  rowError: string | null
  onSelectAll: () => void
  onClearSelection: () => void
  onSave: () => void
  extraLeft?: ReactNode
}

export function MasterGridToolbar({
  displayRowCount,
  submitting,
  rowError,
  onSelectAll,
  onClearSelection,
  onSave,
  extraLeft,
}: Props) {
  return (
    <div className="erp-detail-toolbar">
      {extraLeft}
      <div className="erp-detail-toolbar-actions">
      <div className="erp-check-toggle-group">
        <button
          type="button"
          className="erp-check-toggle-btn"
          title="Select all rows"
          aria-label="Select all rows"
          disabled={displayRowCount === 0}
          onClick={onSelectAll}
        >
          <span className="erp-check-toggle-icon checked" aria-hidden />
        </button>
        <button
          type="button"
          className="erp-check-toggle-btn"
          title="Clear selection"
          aria-label="Clear selection"
          disabled={displayRowCount === 0}
          onClick={onClearSelection}
        >
          <span className="erp-check-toggle-icon unchecked" aria-hidden />
        </button>
      </div>
      <button
        type="button"
        className="btn erp-btn erp-btn-search btn-sm"
        disabled={submitting}
        onClick={onSave}
      >
        {submitting ? 'Saving…' : 'Save'}
      </button>
      {rowError && <span className="alert-inline error">{rowError}</span>}
      </div>
    </div>
  )
}
