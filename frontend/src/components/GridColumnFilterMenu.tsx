import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GridFilterAnchorRect } from '../utils/gridFilterAnchor'
import {
  activateGridColumnFilter,
  deactivateGridColumnFilter,
} from '../utils/gridFilterCoordinator'
import {
  computeFilterMenuStyle,
  getScrollableAncestors,
  isValidFilterAnchorRect,
  readAnchorRect,
  resolveFilterAnchorButton,
} from '../utils/gridFilterAnchor'

type Props = {
  columnLabel: string
  filterColumnKey?: string
  filterGridRoot?: Element | null
  options: string[]
  selected: Set<string>
  onApply: (selected: Set<string>) => void
  onClear: () => void
  onClose: () => void
  anchorEl: HTMLElement | null
  /** Position captured when the filter opened (stable after re-render). */
  anchorRectAtOpen: GridFilterAnchorRect | null
  searchPlaceholder?: string
  selectAllLabel?: string
}

export function GridColumnFilterMenu({
  columnLabel,
  filterColumnKey,
  filterGridRoot,
  options,
  selected,
  onApply,
  onClose,
  anchorEl,
  anchorRectAtOpen,
  searchPlaceholder = 'Search',
  selectAllLabel = '(Select All)',
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Set<string>>(() => new Set(selected))
  const [anchorRect, setAnchorRect] = useState<GridFilterAnchorRect | null>(
    () => anchorRectAtOpen
  )

  const selectedSignature = useMemo(
    () => [...selected].sort().join('\0'),
    [selected]
  )

  useLayoutEffect(() => {
    if (!anchorEl && !anchorRectAtOpen) {
      setAnchorRect(null)
      return
    }

    const update = () => {
      const liveBtn = resolveFilterAnchorButton(
        filterColumnKey,
        anchorEl,
        filterGridRoot ?? null
      )
      if (liveBtn) {
        setAnchorRect(readAnchorRect(liveBtn))
        return
      }
      if (anchorRectAtOpen && isValidFilterAnchorRect(anchorRectAtOpen)) {
        setAnchorRect(anchorRectAtOpen)
      } else {
        setAnchorRect(null)
      }
    }

    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    const scrollAnchor = resolveFilterAnchorButton(
      filterColumnKey,
      anchorEl,
      filterGridRoot ?? null
    )
    const scrollParents = getScrollableAncestors(scrollAnchor)
    for (const parent of scrollParents) {
      parent.addEventListener('scroll', update, { passive: true })
    }
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      for (const parent of scrollParents) {
        parent.removeEventListener('scroll', update)
      }
    }
  }, [anchorEl, anchorRectAtOpen, filterColumnKey, filterGridRoot])

  useEffect(() => {
    setDraft(new Set(selected))
    setSearch('')
  }, [columnLabel, selectedSignature])

  useEffect(() => {
    activateGridColumnFilter(onClose)
    return () => deactivateGridColumnFilter(onClose)
  }, [onClose])

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
    if (!anchorRect) return null
    return computeFilterMenuStyle(anchorRect)
  }, [anchorRect])

  const listMaxHeight = style ? style.maxHeight - 108 : 192

  if (!style) return null

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
