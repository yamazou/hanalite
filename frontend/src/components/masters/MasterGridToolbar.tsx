import type { ReactNode } from 'react'
import { ToolbarFeedback } from '../ToolbarFeedback'

type ActionsProps = {
  submitting: boolean
  rowError: string | null
  statusMessage?: string | null
  selectedCount?: number
  saveLabel?: string
  onSave?: () => void
  onDelete?: () => void
}

/** Update / Delete actions for ErpGridPanel toolbarRight. */
export function MasterGridToolbarActions({
  submitting,
  rowError,
  statusMessage,
  selectedCount = 0,
  saveLabel = 'Update',
  onSave,
  onDelete,
}: ActionsProps) {
  return (
    <div className="erp-detail-toolbar-actions">
      {onSave ? (
        <button
          type="button"
          className="btn erp-btn erp-btn-search btn-sm"
          disabled={submitting}
          onClick={onSave}
        >
          {submitting ? (saveLabel === 'Create' ? 'Creating…' : 'Updating…') : saveLabel}
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          className="btn erp-btn erp-btn-clear btn-sm"
          disabled={submitting || selectedCount === 0}
          onClick={onDelete}
        >
          Delete
        </button>
      ) : null}
      <ToolbarFeedback message={statusMessage} type="success" />
      <ToolbarFeedback message={rowError} type="error" />
    </div>
  )
}

type Props = ActionsProps & {
  extraLeft?: ReactNode
}

/** Optional left extras (tabs, filters) with actions on the right inside one toolbar row. */
export function MasterGridToolbar({ extraLeft, ...actions }: Props) {
  const hasActions = Boolean(
    actions.onSave || actions.onDelete || actions.rowError || actions.statusMessage
  )
  return (
    <div className="erp-detail-toolbar">
      {extraLeft ? <div className="erp-toolbar-left">{extraLeft}</div> : null}
      {hasActions ? <MasterGridToolbarActions {...actions} /> : null}
    </div>
  )
}
