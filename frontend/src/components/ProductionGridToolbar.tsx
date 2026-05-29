type Props = {
  checkAllTitle: string
  uncheckAllTitle: string
  addRowLabel?: string
  rowCount: number
  rowError?: string | null
  rowErrorMessage?: string
  saveLabel?: string
  saving?: boolean
  onCheckAll: () => void
  onUncheckAll: () => void
  onAddRow?: () => void
  onSave?: () => void
}

export function ProductionGridToolbar({
  checkAllTitle,
  uncheckAllTitle,
  addRowLabel,
  rowCount,
  rowError,
  rowErrorMessage,
  saveLabel = 'Save',
  saving = false,
  onCheckAll,
  onUncheckAll,
  onAddRow,
  onSave,
}: Props) {
  return (
    <div className="erp-detail-toolbar">
      <div className="erp-check-toggle-group">
        <button
          type="button"
          className="erp-check-toggle-btn"
          title={checkAllTitle}
          aria-label={checkAllTitle}
          disabled={rowCount === 0}
          onClick={onCheckAll}
        >
          <span className="erp-check-toggle-icon checked" aria-hidden />
        </button>
        <button
          type="button"
          className="erp-check-toggle-btn"
          title={uncheckAllTitle}
          aria-label={uncheckAllTitle}
          disabled={rowCount === 0}
          onClick={onUncheckAll}
        >
          <span className="erp-check-toggle-icon unchecked" aria-hidden />
        </button>
      </div>
      {onAddRow && addRowLabel && (
        <button type="button" className="btn erp-btn erp-btn-new btn-sm" onClick={onAddRow}>
          {addRowLabel}
        </button>
      )}
      {onSave && (
        <button
          type="button"
          className="btn erp-btn erp-btn-search btn-sm"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? 'Saving…' : saveLabel}
        </button>
      )}
      {rowError && rowErrorMessage && (
        <span className="alert-inline error">{rowErrorMessage}</span>
      )}
    </div>
  )
}
