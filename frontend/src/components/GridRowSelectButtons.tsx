type Props = {
  rowCount: number
  selectedCount: number
  onSelectAll: () => void
  onClearSelection: () => void
  className?: string
  selectAllTitle?: string
  clearTitle?: string
}

/**
 * Single header control: unchecked → select all rows; checked (all selected) → clear selection.
 */
export function GridRowSelectButtons({
  rowCount,
  selectedCount,
  onSelectAll,
  onClearSelection,
  className,
  selectAllTitle = 'Select all rows',
  clearTitle = 'Clear selection',
}: Props) {
  const allSelected = rowCount > 0 && selectedCount >= rowCount
  const title = allSelected ? clearTitle : selectAllTitle

  const handleClick = () => {
    if (allSelected) onClearSelection()
    else onSelectAll()
  }

  return (
    <div className={`erp-check-toggle-group${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="erp-check-toggle-btn"
        title={title}
        aria-label={title}
        aria-pressed={allSelected}
        disabled={rowCount === 0}
        onClick={handleClick}
      >
        <span
          className={`erp-check-toggle-icon${allSelected ? ' checked' : ' unchecked'}`}
          aria-hidden
        />
      </button>
    </div>
  )
}
