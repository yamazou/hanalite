import { useMemo, type CSSProperties, type KeyboardEvent } from 'react'
import { useMasterCatalog } from '../context/MasterCatalogContext'
import {
  filterItemsForItemAnyDatalist,
  filterItemsForItemCdDatalist,
  filterItemsForItemNmDatalist,
  showItemMasterDatalist,
} from '../utils/gridPlaceholder'

export type GridItemDatalistItem = {
  item_id: number
  item_cd: string
  item_nm: string
}

type Props = {
  mode: 'cd' | 'nm' | 'any'
  items: GridItemDatalistItem[]
  listId: string
  value: string
  style?: CSSProperties
  placeholder?: string
  ariaLabel?: string
  inputClassName?: string
  dataCellAttr?: string
  disabled?: boolean
  onChange: (value: string) => void
  onFocus?: () => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
}

/** Same as Receipt Entry: native datalist, code/name rows, substring filter while typing. */
export function GridItemDatalistField({
  mode,
  items,
  listId,
  value,
  style,
  placeholder,
  ariaLabel,
  inputClassName = 'erp-grid-input',
  dataCellAttr,
  disabled = false,
  onChange,
  onFocus,
  onKeyDown,
}: Props) {
  const { revision } = useMasterCatalog()
  const filtered = useMemo(() => {
    if (mode === 'cd') return filterItemsForItemCdDatalist(items, value)
    if (mode === 'nm') return filterItemsForItemNmDatalist(items, value)
    return filterItemsForItemAnyDatalist(items, value)
  }, [items, mode, value])

  const commit = (next: string) => {
    onChange(next)
  }

  return (
    <>
      <input
        className={inputClassName}
        style={style}
        value={value}
        list={listId}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        disabled={disabled}
        data-bom-grid-cell={dataCellAttr}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onInput={(event) => commit(event.currentTarget.value)}
        onChange={(event) => commit(event.target.value)}
        onBlur={(event) => commit(event.currentTarget.value)}
      />
      <datalist key={revision} id={listId}>
        {filtered.map((item) => (
          <option
            key={item.item_id}
            value={mode === 'nm' ? item.item_nm : item.item_cd}
          >
            {mode === 'nm' ? item.item_cd : item.item_nm}
          </option>
        ))}
      </datalist>
    </>
  )
}

/** Plain grid input when item_id is already resolved (no suggest list). */
export function GridItemResolvedInput({
  value,
  style,
  placeholder,
  onChange,
  onFocus,
}: {
  value: string
  style?: CSSProperties
  placeholder?: string
  onChange: (value: string) => void
  onFocus?: () => void
}) {
  return (
    <input
      className="erp-grid-input"
      style={style}
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

export { showItemMasterDatalist }
