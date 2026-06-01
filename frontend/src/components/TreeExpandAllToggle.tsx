type Props = {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

/** Tree panel title bar: checkbox before label (✅ Expand All). */
export function TreeExpandAllToggle({ checked, disabled = false, onChange }: Props) {
  return (
    <label className="erp-tree-expand-all-toggle">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      Expand All
    </label>
  )
}
