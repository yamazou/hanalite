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
  secondaryLabel?: string
  secondaryDisabled?: boolean
  onSecondary?: () => void
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
  secondaryLabel,
  secondaryDisabled = false,
  onSecondary,
}: Props) {
  const hasAddRow = Boolean(onAddRow && addRowLabel)
  const hasActions = Boolean(
    onSave ||
      (onSecondary && secondaryLabel) ||
      statusMessage ||
      (rowError && rowErrorMessage)
  )
  if (!hasAddRow && !hasActions) return null

  return (
    <div className="erp-detail-toolbar">
      {hasAddRow && (
        <button type="button" className="btn erp-btn erp-btn-new btn-sm" onClick={onAddRow}>
          {addRowLabel}
        </button>
      )}
      {hasActions && (
        <div className="erp-detail-toolbar-actions">
          {onSecondary && secondaryLabel && (
            <button
              type="button"
              className="btn erp-btn erp-btn-clear btn-sm"
              disabled={secondaryDisabled}
              onClick={onSecondary}
            >
              {secondaryLabel}
            </button>
          )}
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
