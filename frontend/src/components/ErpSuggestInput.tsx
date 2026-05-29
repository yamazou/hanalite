import { useCallback, useEffect, useRef, useState } from 'react'
import type { SuggestOption } from '../utils/searchSuggest'

type ErpSuggestInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel: string
  fieldClassName?: string
  variant?: 'field' | 'inline'
  fetchSuggestions: (query: string) => Promise<SuggestOption[]>
  onPickOption?: (option: SuggestOption) => void
}

export function ErpSuggestInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  fieldClassName = 'erp-search-field-item',
  variant = 'field',
  fetchSuggestions,
  onPickOption,
}: ErpSuggestInputProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestOption[]>([])
  const rootRef = useRef<HTMLSpanElement>(null)

  const loadSuggestions = useCallback(
    async (query: string) => {
      setLoading(true)
      try {
        const rows = await fetchSuggestions(query)
        setSuggestions(rows)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    },
    [fetchSuggestions]
  )

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      void loadSuggestions(value)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [value, open, loadSuggestions])

  const closeDropdown = useCallback(() => {
    setOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open, closeDropdown])

  const onFocus = () => {
    setOpen(true)
    void loadSuggestions(value)
  }

  const pick = (option: SuggestOption) => {
    onChange(option.value)
    onPickOption?.(option)
    setOpen(false)
  }

  return (
    <span
      ref={rootRef}
      className={
        variant === 'field'
          ? `erp-search-field erp-suggest-field ${fieldClassName}`
          : `erp-suggest-field erp-suggest-inline ${fieldClassName}`
      }
    >
      <input
        type="text"
        className="erp-input"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={onFocus}
        onKeyDown={(e) => {
          if (e.key === 'Escape') closeDropdown()
        }}
      />
      {open && (
        <div className="item-search-results erp-suggest-results" role="listbox">
          {loading && <p className="muted item-search-hint">Loading…</p>}
          {!loading && suggestions.length === 0 && (
            <p className="muted item-search-hint">No matches</p>
          )}
          {!loading &&
            suggestions.map((option) => (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                className="item-search-option"
                role="option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(option)}
              >
                {option.label}
              </button>
            ))}
        </div>
      )}
    </span>
  )
}
