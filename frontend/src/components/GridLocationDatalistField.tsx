import { useMemo, type CSSProperties, type KeyboardEvent } from 'react'
import {
  filterLocationsForCdDatalist,
  filterLocationsForNmDatalist,
  showLocationMasterDatalist,
} from '../utils/gridPlaceholder'

export type GridLocationDatalistItem = {
  location_id: number
  location_cd: string
  location_nm: string
}

type Props = {
  mode: 'cd' | 'nm'
  locations: GridLocationDatalistItem[]
  listId: string
  value: string
  placeholder?: string
  ariaLabel?: string
  inputClassName?: string
  disabled?: boolean
  onChange: (value: string) => void
  onFocus?: () => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
}

/** Native datalist; code/name rows; substring filter while typing (same as Item Code). */
export function GridLocationDatalistField({
  mode,
  locations,
  listId,
  value,
  placeholder,
  ariaLabel,
  inputClassName = 'erp-grid-input',
  disabled = false,
  onChange,
  onFocus,
  onKeyDown,
}: Props) {
  const filtered = useMemo(() => {
    if (mode === 'cd') return filterLocationsForCdDatalist(locations, value)
    return filterLocationsForNmDatalist(locations, value)
  }, [locations, mode, value])

  return (
    <>
      <input
        className={inputClassName}
        value={value}
        list={listId}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        disabled={disabled}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onInput={(event) => onChange(event.currentTarget.value)}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onChange(event.currentTarget.value)}
      />
      <datalist id={listId}>
        {filtered.map((loc) => (
          <option
            key={loc.location_id}
            value={mode === 'nm' ? loc.location_nm : loc.location_cd}
          >
            {mode === 'nm' ? loc.location_cd : loc.location_nm}
          </option>
        ))}
      </datalist>
    </>
  )
}

export function GridLocationResolvedInput({
  value,
  placeholder,
  onChange,
  onFocus,
}: {
  value: string
  placeholder?: string
  onChange: (value: string) => void
  onFocus?: () => void
}) {
  return (
    <input
      className="erp-grid-input"
      value={value}
      placeholder={placeholder}
      autoComplete="off"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onFocus={onFocus}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => onChange(event.currentTarget.value)}
    />
  )
}

export { showLocationMasterDatalist }
