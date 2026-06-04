import { useCallback, useState } from 'react'
import {
  useRegisterToolbarHintClear,
  useToolbarHintContext,
} from '../../context/ToolbarHintContext'
import { ToolbarFeedback } from '../ToolbarFeedback'

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
  const ctx = useToolbarHintContext()
  const [hint, setHint] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const clearHint = useCallback(() => setHint(null), [])
  useRegisterToolbarHintClear(clearHint)

  const handleClick = async () => {
    ctx?.clearToolbarHints()
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
      <ToolbarFeedback message={hint} type="success" />
    </span>
  )
}
