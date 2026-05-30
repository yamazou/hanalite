import type { ReactNode } from 'react'
import { ToolbarFeedback } from '../ToolbarFeedback'

type Props = {
  submitting: boolean
  rowError: string | null
  statusMessage?: string | null
  onSave?: () => void
  extraLeft?: ReactNode
}

export function MasterGridToolbar({
  submitting,
  rowError,
  statusMessage,
  onSave,
  extraLeft,
}: Props) {
  const hasActions = Boolean(onSave || rowError || statusMessage)
  return (
    <div className="erp-detail-toolbar">
      {extraLeft}
      {hasActions ? (
        <div className="erp-detail-toolbar-actions">
          {onSave ? (
            <button
              type="button"
              className="btn erp-btn erp-btn-search btn-sm"
              disabled={submitting}
              onClick={onSave}
            >
              {submitting ? 'Updating…' : 'Update'}
            </button>
          ) : null}
          <ToolbarFeedback message={statusMessage} type="success" />
          <ToolbarFeedback message={rowError} type="error" />
        </div>
      ) : null}
    </div>
  )
}
