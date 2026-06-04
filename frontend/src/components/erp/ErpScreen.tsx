import { useEffect, useState, type ReactNode } from 'react'
import { ToolbarHintProvider } from '../../context/ToolbarHintContext'
import { Alert } from '../Alert'
import { ErpPanelTitleBar } from './ErpPanelTitleBar'
import { ErpTitleBarActions } from './ErpTitleBarActions'

const FEEDBACK_AUTO_HIDE_MS = 4000

type Props = {
  children: ReactNode
  error?: string | null
  success?: string | null
  className?: string
  /** Page title shown in the top title bar (same row as Save Grid / Reload). */
  title?: string
  titleActions?: ReactNode
  /** Reload from server; discards unsaved grid edits on that screen. */
  onRefresh?: () => void | Promise<void>
  refreshLabel?: string
  refreshSuccessMessage?: string
  refreshDisabled?: boolean
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
  refreshSuccessMessage,
  refreshDisabled,
  showSaveGridButton,
  onSaveGrid,
  saveGridIsDirty,
  saveGridDisabled,
  saveGridLabel,
  saveGridSuccessMessage,
  saveGridNoChangesMessage,
}: Props) {
  const [feedbackHidden, setFeedbackHidden] = useState(false)

  useEffect(() => {
    setFeedbackHidden(false)
    if (!error && !success) return
    const timer = window.setTimeout(() => setFeedbackHidden(true), FEEDBACK_AUTO_HIDE_MS)
    return () => window.clearTimeout(timer)
  }, [error, success])

  const displayError = error && !feedbackHidden ? error : null
  const displaySuccess = success && !feedbackHidden ? success : null
  const hasMessages = Boolean(displayError || displaySuccess)
  const hasTitleBarActions = Boolean(
    titleActions || showSaveGridButton || onSaveGrid || onRefresh
  )
  const showTitleBar = Boolean(title || hasTitleBarActions)

  return (
    <ToolbarHintProvider>
      <div className={`erp-screen${className ? ` ${className}` : ''}`}>
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
                refreshSuccessMessage={refreshSuccessMessage}
                refreshDisabled={refreshDisabled}
              />
            ) : null}
          </ErpPanelTitleBar>
        ) : null}
        {hasMessages ? (
          <div className="erp-screen-messages" aria-live="polite">
            {displayError && <Alert type="error" message={displayError} />}
            {displaySuccess && <Alert type="success" message={displaySuccess} />}
          </div>
        ) : null}
        {children}
      </div>
    </ToolbarHintProvider>
  )
}
