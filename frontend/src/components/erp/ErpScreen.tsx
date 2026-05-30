import type { ReactNode } from 'react'
import { Alert } from '../Alert'
import { ErpPanelTitleBar } from './ErpPanelTitleBar'
import { ErpTitleBarActions } from './ErpTitleBarActions'

type Props = {
  children: ReactNode
  error?: string | null
  success?: string | null
  className?: string
  /** Page title shown in the top title bar (same row as Save Grid / Refresh). */
  title?: string
  titleActions?: ReactNode
  onRefresh?: () => void
  refreshLabel?: string
  showSaveGridButton?: boolean
  onSaveGrid?: () => void
  saveGridIsDirty?: boolean
  saveGridDisabled?: boolean
  saveGridLabel?: string
  saveGridSuccessMessage?: string
  saveGridNoChangesMessage?: string
}

export function ErpScreen({
  children,
  error,
  success,
  className,
  title,
  titleActions,
  onRefresh,
  refreshLabel,
  showSaveGridButton,
  onSaveGrid,
  saveGridIsDirty,
  saveGridDisabled,
  saveGridLabel,
  saveGridSuccessMessage,
  saveGridNoChangesMessage,
}: Props) {
  const hasMessages = Boolean(error || success)
  const hasTitleBarActions = Boolean(
    titleActions || showSaveGridButton || onSaveGrid || onRefresh
  )
  const showTitleBar = Boolean(title || hasTitleBarActions)

  return (
    <div className={`erp-screen${className ? ` ${className}` : ''}`}>
      {hasMessages && (
        <div className="erp-screen-messages" aria-live="polite">
          {error && <Alert type="error" message={error} />}
          {success && <Alert type="success" message={success} />}
        </div>
      )}
      {showTitleBar ? (
        <ErpPanelTitleBar title={title ?? ''}>
          {hasTitleBarActions ? (
            <ErpTitleBarActions
              titleActions={titleActions}
              showSaveGridButton={showSaveGridButton}
              onSaveGrid={onSaveGrid}
              saveGridIsDirty={saveGridIsDirty}
              saveGridDisabled={saveGridDisabled}
              saveGridLabel={saveGridLabel}
              saveGridSuccessMessage={saveGridSuccessMessage}
              saveGridNoChangesMessage={saveGridNoChangesMessage}
              onRefresh={onRefresh}
              refreshLabel={refreshLabel}
            />
          ) : null}
        </ErpPanelTitleBar>
      ) : null}
      {children}
    </div>
  )
}
