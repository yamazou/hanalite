import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { ItemSearchRow } from '../types/masters'
import { formatItemLabel } from '../utils/format'

type ItemSearchPickerProps = {
  label: string
  value: ItemSearchRow | null
  onChange: (item: ItemSearchRow | null) => void
  required?: boolean
}

export function ItemSearchPicker({ label, value, onChange, required }: ItemSearchPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ItemSearchRow[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 1) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      setResults(await api.searchItems(trimmed, 15))
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      void search(query)
    }, 250)
    return () => window.clearTimeout(t)
  }, [query, open, search])

  useEffect(() => {
    if (value) {
      setQuery(formatItemLabel(value))
    }
  }, [value])

  const pick = (item: ItemSearchRow) => {
    onChange(item)
    setQuery(formatItemLabel(item))
    setOpen(false)
  }

  const clear = () => {
    onChange(null)
    setQuery('')
    setResults([])
  }

  return (
    <label className="full item-search-picker">
      {label}
      <div className="item-search-row">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            if (value && e.target.value !== formatItemLabel(value)) {
              onChange(null)
            }
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search by item code or name"
          required={required && !value}
        />
        {value && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={clear}>
            Clear
          </button>
        )}
      </div>
      {open && query.trim() && (
        <div className="item-search-results">
          {loading && <p className="muted">Searching…</p>}
          {!loading && results.length === 0 && <p className="muted">No matches</p>}
          {!loading &&
            results.map((item) => (
              <button
                key={item.item_id}
                type="button"
                className="item-search-option"
                onClick={() => pick(item)}
              >
                <code>{item.item_cd}</code> — {item.item_nm}
                <span className="muted small"> ({item.itemtyp_nm})</span>
              </button>
            ))}
        </div>
      )}
    </label>
  )
}
