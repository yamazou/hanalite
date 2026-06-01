import { useEffect, useState } from 'react'
import { TOOLBAR_HINT_AUTO_HIDE_MS } from '../../constants/feedbackTiming'

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
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    if (!hint) return
    const t = window.setTimeout(() => setHint(null), TOOLBAR_HINT_AUTO_HIDE_MS)
    return () => window.clearTimeout(t)
  }, [hint])

  const handleClick = () => {
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
      {hint ? <span className="erp-save-grid-hint muted">{hint}</span> : null}
    </span>
  )
}
