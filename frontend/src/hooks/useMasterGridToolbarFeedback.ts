import { useCallback, useState } from 'react'
import { useRegisterToolbarHintClear } from '../context/ToolbarHintContext'

/**
 * Toolbar success/error next to Update/Delete (same as Production Order List header).
 * Messages persist until the next user action clears them via beginToolbarAction or clearToolbarFeedback.
 */
export function useMasterGridToolbarFeedback() {
  const [success, setSuccess] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  const clearToolbarFeedback = useCallback(() => {
    setSuccess(null)
    setRowError(null)
  }, [])

  useRegisterToolbarHintClear(clearToolbarFeedback)

  /** Call at the start of Update, Delete, Import, or Refresh. */
  const beginToolbarAction = clearToolbarFeedback

  return {
    success,
    setSuccess,
    rowError,
    setRowError,
    clearToolbarFeedback,
    beginToolbarAction,
  }
}
