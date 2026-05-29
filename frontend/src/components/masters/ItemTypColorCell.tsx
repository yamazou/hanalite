import { useRef } from 'react'
import { itemTypColorToDisplay, normalizeItemTypColor } from '../../utils/itemTypColor'

type Props = {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
}

export function ItemTypColorCell({ value, onChange, disabled }: Props) {
  const hiddenPickerRef = useRef<HTMLInputElement>(null)
  const normalized = normalizeItemTypColor(value)
  const display = itemTypColorToDisplay(value)

  const applyPicker = (hexWithHash: string) => {
    onChange(hexWithHash.replace(/^#/, '').toUpperCase().slice(0, 6))
  }

  return (
    <div className="erp-itemtyp-color-cell">
      {normalized ? (
        <input
          type="color"
          className="erp-itemtyp-color-swatch"
          value={normalized}
          disabled={disabled}
          aria-label="Item type color"
          onChange={(e) => applyPicker(e.target.value)}
        />
      ) : (
        <button
          type="button"
          className="erp-itemtyp-color-swatch erp-itemtyp-color-swatch-empty"
          disabled={disabled}
          aria-label="Set color"
          onClick={() => hiddenPickerRef.current?.click()}
        />
      )}
      <input
        ref={hiddenPickerRef}
        type="color"
        className="erp-itemtyp-color-picker-hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => applyPicker(e.target.value)}
      />
      <input
        type="text"
        className="erp-grid-input erp-itemtyp-color-hex"
        value={display}
        placeholder=""
        disabled={disabled}
        spellCheck={false}
        maxLength={6}
        onChange={(e) => {
          const raw = e.target.value.replace(/^#/, '').toUpperCase().replace(/[^0-9A-F]/g, '')
          onChange(raw)
        }}
        onBlur={() => {
          const raw = value.trim()
          if (!raw) {
            if (display) onChange('')
            return
          }
          const next = itemTypColorToDisplay(value)
          if (next !== display) onChange(next)
        }}
      />
      {normalized ? (
        <button
          type="button"
          className="erp-itemtyp-color-clear"
          disabled={disabled}
          title="Clear color"
          onClick={() => onChange('')}
        >
          ×
        </button>
      ) : null}
    </div>
  )
}
