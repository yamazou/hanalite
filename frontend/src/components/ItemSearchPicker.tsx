import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import type { ItemSearchRow } from '../types/masters'
import { formatItemLabel } from '../utils/format'

type ItemSearchPickerProps = {
  label: string
  value: ItemSearchRow | null
  onChange: (item: ItemSearchRow | null) => void
  required?: boolean
}

const MAX_RESULTS = 15

function matchesItem(item: ItemSearchRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = `${item.item_cd} ${item.item_nm} ${item.itemtyp_nm}`.toLowerCase()
  const tokens = q.split(/[\s\-—/]+/).filter(Boolean)
  return tokens.every((token) => hay.includes(token))
}

export function ItemSearchPicker({ label, value, onChange, required }: ItemSearchPickerProps) {
  const [query, setQuery] = useState('')
  const [catalog, setCatalog] = useState<ItemSearchRow[]>([])
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const rootRef = useRef<HTMLLabelElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadCatalog = useCallback(async () => {
    if (catalogLoaded) return
    setLoading(true)
    try {
      const rows = await api.listItemsMaster()
      setCatalog(
        rows.map((row) => ({
          item_id: row.item_id,
          item_cd: row.item_cd,
          item_nm: row.item_nm,
          itemtyp_id: row.itemtyp_id,
          itemtyp_nm: row.itemtyp_nm,
        }))
      )
      setCatalogLoaded(true)
    } catch {
      setCatalog([])
    } finally {
      setLoading(false)
    }
  }, [catalogLoaded])

  const results = useMemo(() => {
    return catalog.filter((item) => matchesItem(item, query)).slice(0, MAX_RESULTS)
  }, [catalog, query])

  useEffect(() => {
    if (value) {
      setQuery(formatItemLabel(value))
    } else if (!isEditing) {
      setQuery('')
    }
  }, [value, isEditing])

  const closeDropdown = useCallback(() => {
    setOpen(false)
    setIsEditing(false)
    if (value) {
      setQuery(formatItemLabel(value))
    } else {
      setQuery('')
    }
  }, [value])

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

  const pick = (item: ItemSearchRow) => {
    onChange(item)
    setQuery(formatItemLabel(item))
    setOpen(false)
    setIsEditing(false)
  }

  const clear = () => {
    onChange(null)
    setQuery('')
    setOpen(false)
    setIsEditing(false)
    inputRef.current?.focus()
  }

  const onFocus = () => {
    void loadCatalog().then(() => {
      setIsEditing(true)
      setOpen(true)
      requestAnimationFrame(() => inputRef.current?.select())
    })
  }

  return (
    <label ref={rootRef} className="full item-search-picker">
      {label}
      <div className="item-search-row">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsEditing(true)
            setOpen(true)
            if (value && e.target.value !== formatItemLabel(value)) {
              onChange(null)
            }
          }}
          onFocus={onFocus}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeDropdown()
          }}
          placeholder="Type to search by code or name"
          required={required && !value}
          autoComplete="off"
        />
        {value && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={clear}>
            Clear
          </button>
        )}
      </div>
      {open && isEditing && (
        <div className="item-search-results" role="listbox">
          {loading && <p className="muted item-search-hint">Loading items…</p>}
          {!loading && results.length === 0 && (
            <p className="muted item-search-hint">No matches — try a shorter code or name</p>
          )}
          {!loading &&
            results.map((item) => (
              <button
                key={item.item_id}
                type="button"
                className="item-search-option"
                role="option"
                onMouseDown={(e) => e.preventDefault()}
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
