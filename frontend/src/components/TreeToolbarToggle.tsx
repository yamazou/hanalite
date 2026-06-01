type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
}

/** Toolbar Tree on/off: checkbox before label (✅ Tree). */
export function TreeToolbarToggle({ checked, onChange }: Props) {
  return (
    <label className="erp-toolbar-tree-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      Tree
    </label>
  )
}
