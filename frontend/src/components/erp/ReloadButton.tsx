import { useEffect, useState } from 'react'
import { TOOLBAR_HINT_AUTO_HIDE_MS } from '../../constants/feedbackTiming'

const DEFAULT_SUCCESS = 'Reset.'

type Props = {
  onReload: () => void | Promise<void>
  disabled?: boolean
  label?: string
  successMessage?: string
}

export function ReloadButton({
  onReload,
  disabled = false,
  label = 'Reset',
  successMessage = DEFAULT_SUCCESS,
}: Props) {
  const [hint, setHint] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!hint) return
    const t = window.setTimeout(() => setHint(null), TOOLBAR_HINT_AUTO_HIDE_MS)
    return () => window.clearTimeout(t)
  }, [hint])

  const handleClick = async () => {
    setHint(null)
    setLoading(true)
    try {
      await onReload()
      setHint(successMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="erp-save-grid-group">
      <button
        type="button"
        className="btn erp-btn erp-btn-clear"
        disabled={disabled || loading}
        onClick={() => void handleClick()}
      >
        {label}
      </button>
      {hint ? <span className="erp-save-grid-hint muted">{hint}</span> : null}
    </span>
  )
}
