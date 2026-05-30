type Props = {
  message?: string | null
  type?: 'success' | 'error'
}

/** Inline status next to toolbar actions (Update / Save); does not shift grid layout. */
export function ToolbarFeedback({ message, type = 'success' }: Props) {
  if (!message) return null
  return (
    <span className={`erp-toolbar-feedback erp-toolbar-feedback--${type}`} role="status">
      {message}
    </span>
  )
}
