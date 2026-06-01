type Props = {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

/** Production List Input Item: filter inputs and narrow header grid by material usage. */
export function OrderTraceabilityToggle({ checked, disabled = false, onChange }: Props) {
  return (
    <label className="erp-tree-expand-all-toggle erp-order-traceability-toggle">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      Order Traceability
    </label>
  )
}
