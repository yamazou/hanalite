import { useCallback, useState } from 'react'
import {
  useRegisterToolbarHintClear,
  useToolbarHintContext,
} from '../../context/ToolbarHintContext'
import { ToolbarFeedback } from '../ToolbarFeedback'

const DEFAULT_SUCCESS = 'Grid layout saved.'
const DEFAULT_NO_CHANGES = 'No layout changes.'

type Props = {
  onSave: () => void
  /** When set, save only runs (and shows success) if dirty; otherwise shows no-changes hint. */
  isDirty?: boolean
  disabled?: boolean
  label?: string
  successMessage?: string
  noChangesMessage?: string
}

export function SaveGridButton({
  onSave,
  isDirty,
  disabled = false,
  label = 'Save Grid',
  successMessage = DEFAULT_SUCCESS,
  noChangesMessage = DEFAULT_NO_CHANGES,
}: Props) {
  const ctx = useToolbarHintContext()
  const [hint, setHint] = useState<string | null>(null)
  const clearHint = useCallback(() => setHint(null), [])
  useRegisterToolbarHintClear(clearHint)

  const handleClick = () => {
    ctx?.clearToolbarHints()
    if (isDirty === false) {
      setHint(noChangesMessage)
      return
    }
    onSave()
    setHint(successMessage)
  }

  return (
    <span className="erp-save-grid-group">
      <button
        type="button"
        className="btn erp-btn erp-btn-search"
        disabled={disabled}
        onClick={handleClick}
      >
        {label}
      </button>
      <ToolbarFeedback message={hint} type="success" />
    </span>
  )
}
