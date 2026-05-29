import { useCallback, useEffect, useState } from 'react'
import type { ItemSearchRow } from '../types/masters'
import { formatItemLabel } from '../utils/format'
import { findItemByLabel, suggestItems } from '../utils/searchSuggest'
import { ErpSuggestInput } from './ErpSuggestInput'

type ItemSearchPickerProps = {
  label: string
  value: ItemSearchRow | null
  onChange: (item: ItemSearchRow | null) => void
  required?: boolean
  showInlineClear?: boolean
  hideLabel?: boolean
  fieldClassName?: string
}

export function ItemSearchPicker({
  label,
  value,
  onChange,
  required,
  showInlineClear = true,
  hideLabel = false,
  fieldClassName,
}: ItemSearchPickerProps) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    setQuery(value ? formatItemLabel(value) : '')
  }, [value])

  const fetchSuggestions = useCallback((q: string) => suggestItems(q), [])

  const pickItem = async (labelText: string) => {
    const item = await findItemByLabel(labelText)
    if (item) {
      onChange(item)
      setQuery(formatItemLabel(item))
      return
    }
    onChange(null)
    setQuery(labelText)
  }

  const clear = () => {
    onChange(null)
    setQuery('')
  }

  const input = (
    <ErpSuggestInput
      value={query}
      onChange={(text) => {
        setQuery(text)
        if (value && text !== formatItemLabel(value)) {
          onChange(null)
        }
      }}
      placeholder={hideLabel ? label : 'Type to search by code or name'}
      ariaLabel={label}
      fieldClassName={fieldClassName ?? ''}
      variant="inline"
      fetchSuggestions={fetchSuggestions}
      onPickOption={(option) => void pickItem(option.value)}
    />
  )

  if (hideLabel) {
    return (
      <span className="item-search-picker item-search-picker-inline">
        {input}
        {showInlineClear && value && (
          <button type="button" className="btn erp-btn erp-btn-clear" onClick={clear}>
            Clear
          </button>
        )}
      </span>
    )
  }

  return (
    <label className="full item-search-picker">
      {label}
      <div className="item-search-row">
        {input}
        {showInlineClear && value && (
          <button type="button" className="btn erp-btn erp-btn-clear" onClick={clear}>
            Clear
          </button>
        )}
      </div>
    </label>
  )
}
