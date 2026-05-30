import { ToolbarFeedback } from './ToolbarFeedback'

type Props = {
  addRowLabel?: string
  rowError?: string | null
  rowErrorMessage?: string
  statusMessage?: string | null
  saveLabel?: string
  saving?: boolean
  onAddRow?: () => void
  onSave?: () => void
}

export function ProductionGridToolbar({
  addRowLabel,
  rowError,
  rowErrorMessage,
  statusMessage,
  saveLabel = 'Save',
  saving = false,
  onAddRow,
  onSave,
}: Props) {
  return (
    <div className="erp-detail-toolbar">
      {onAddRow && addRowLabel && (
        <button type="button" className="btn erp-btn erp-btn-new btn-sm" onClick={onAddRow}>
          {addRowLabel}
        </button>
      )}
      {(onSave || statusMessage || (rowError && rowErrorMessage)) && (
        <div className="erp-detail-toolbar-actions">
          {onSave && (
            <button
              type="button"
              className="btn erp-btn erp-btn-search btn-sm"
              disabled={saving}
              onClick={onSave}
            >
              {saving ? 'Updating…' : saveLabel}
            </button>
          )}
          <ToolbarFeedback message={statusMessage} type="success" />
          <ToolbarFeedback
            message={rowError && rowErrorMessage ? rowErrorMessage : null}
            type="error"
          />
        </div>
      )}
    </div>
  )
}
