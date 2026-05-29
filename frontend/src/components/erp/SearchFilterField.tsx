import type { ReactNode } from 'react'

type SearchFilterFieldProps = {
  className: string
  showApply?: boolean
  applyLabel?: string
  onApply?: () => void
  showClear: boolean
  clearLabel?: string
  onClear: () => void
  children: ReactNode
}

export function SearchFilterField({
  className,
  showApply = false,
  applyLabel = 'Apply',
  onApply,
  showClear,
  clearLabel = 'Clear',
  onClear,
  children,
}: SearchFilterFieldProps) {
  return (
    <span className={`erp-search-field erp-search-field-with-clear ${className}`}>
      {children}
      {showApply ? (
        <button
          type="button"
          className="btn erp-btn erp-btn-search erp-search-field-apply erp-search-clear-reveal"
          onClick={onApply}
          aria-label={applyLabel}
        >
          {applyLabel}
        </button>
      ) : null}
      {showClear ? (
        <button
          type="button"
          className="btn erp-btn erp-btn-clear erp-search-field-clear erp-search-clear-reveal"
          onClick={onClear}
          aria-label={clearLabel}
        >
          {clearLabel}
        </button>
      ) : null}
    </span>
  )
}

export function SearchDateInput({
  value,
  placeholder,
  onChange,
  className,
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <span className={`erp-input-wrap${value ? '' : ' is-empty'}`}>
      <input
        type="date"
        className={className}
        value={value}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {!value && <span className="erp-input-ghost">{placeholder}</span>}
    </span>
  )
}
