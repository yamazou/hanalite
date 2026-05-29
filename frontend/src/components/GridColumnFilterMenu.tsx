import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  columnLabel: string
  options: string[]
  selected: Set<string>
  onApply: (selected: Set<string>) => void
  onClear: () => void
  onClose: () => void
  anchorRect: DOMRect
  searchPlaceholder?: string
  selectAllLabel?: string
}

export function GridColumnFilterMenu({
  columnLabel,
  options,
  selected,
  onApply,
  onClose,
  anchorRect,
  searchPlaceholder = 'Search',
  selectAllLabel = '(Select All)',
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Set<string>>(() => new Set(selected))

  useEffect(() => {
    setDraft(new Set(selected))
    setSearch('')
  }, [columnLabel, selected])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      if ((target as HTMLElement).closest?.('.erp-th-filter-btn')) return
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const visibleOptions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) => opt.toLowerCase().includes(q))
  }, [options, search])

  const visibleSelectedCount = useMemo(
    () => visibleOptions.filter((opt) => draft.has(opt)).length,
    [visibleOptions, draft]
  )

  const allVisibleSelected =
    visibleOptions.length > 0 && visibleSelectedCount === visibleOptions.length
  const someVisibleSelected =
    visibleSelectedCount > 0 && visibleSelectedCount < visibleOptions.length

  useEffect(() => {
    const el = selectAllRef.current
    if (el) el.indeterminate = someVisibleSelected
  }, [someVisibleSelected, visibleOptions, draft])

  const toggleValue = (value: string) => {
    setDraft((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const toggleVisibleAll = () => {
    setDraft((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        for (const opt of visibleOptions) next.delete(opt)
      } else {
        for (const opt of visibleOptions) next.add(opt)
      }
      return next
    })
  }

  const style = useMemo(() => {
    const width = 260
    let left = anchorRect.left
    let top = anchorRect.bottom + 2
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8)
    }
    const maxHeight = 300
    if (top + maxHeight > window.innerHeight - 8) {
      top = Math.max(8, anchorRect.top - maxHeight - 2)
    }
    return { left, top, width, maxHeight }
  }, [anchorRect])

  const listMaxHeight = style.maxHeight - 108

  return createPortal(
    <div
      ref={panelRef}
      className="erp-col-filter-menu"
      style={{ left: style.left, top: style.top, width: style.width }}
      role="dialog"
      aria-label={`Filter ${columnLabel}`}
    >
      <input
        type="text"
        className="erp-input erp-col-filter-search"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="erp-col-filter-list" style={{ maxHeight: listMaxHeight }}>
        {visibleOptions.length === 0 ? (
          <p className="muted erp-col-filter-empty">No matches</p>
        ) : (
          <>
            <label className="erp-col-filter-item erp-col-filter-item-select-all">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleVisibleAll}
              />
              <span>{selectAllLabel}</span>
            </label>
            {visibleOptions.map((opt) => (
              <label key={opt} className="erp-col-filter-item">
                <input
                  type="checkbox"
                  checked={draft.has(opt)}
                  onChange={() => toggleValue(opt)}
                />
                <span title={opt}>{opt}</span>
              </label>
            ))}
          </>
        )}
      </div>
      <div className="erp-col-filter-footer">
        <button type="button" className="erp-col-filter-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="erp-col-filter-btn erp-col-filter-btn-ok"
          onClick={() => {
            onApply(new Set(draft))
            onClose()
          }}
        >
          OK
        </button>
      </div>
    </div>,
    document.body
  )
}
