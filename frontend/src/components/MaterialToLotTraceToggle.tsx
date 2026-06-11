type Props = {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

/** Production List Input Item: material-to-lot trace across orders in the list. */
export function MaterialToLotTraceToggle({ checked, disabled = false, onChange }: Props) {
  return (
    <label className="erp-tree-expand-all-toggle erp-material-to-lot-trace-toggle">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      Material-to-Lot Trace
    </label>
  )
}
