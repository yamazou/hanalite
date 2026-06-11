import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { createPortal } from 'react-dom'

import type {
  FilterMenuPointerAtOpen,
  GridFilterAnchorRect,
} from '../utils/gridFilterAnchor'

import {

  activateGridColumnFilter,

  deactivateGridColumnFilter,

} from '../utils/gridFilterCoordinator'

import {

  computeFilterMenuOpenBelowAnchor,

  FILTER_MENU_CHROME_HEIGHT,

  FILTER_MENU_LIST_MAX_HEIGHT,

  resolveFilterMenuPlacementRect,

  type FilterMenuComputedStyle,

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

  /** Snapshot at click; used only when the live anchor node is disconnected. */

  anchorRectAtOpen: GridFilterAnchorRect | null

  /** Pointer at click; stabilizes placement when sticky headers skew button rects. */

  pointerAtOpen?: FilterMenuPointerAtOpen | null

  searchPlaceholder?: string

  selectAllLabel?: string

}



export function GridColumnFilterMenu({

  columnLabel,

  filterColumnKey: _filterColumnKey,

  filterGridRoot: _filterGridRoot,

  options,

  selected,

  onApply,

  onClose,

  anchorEl,

  anchorRectAtOpen,

  pointerAtOpen,

  searchPlaceholder = 'Search',

  selectAllLabel = '(Select All)',

}: Props) {

  const panelRef = useRef<HTMLDivElement>(null)

  const selectAllRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')

  const [draft, setDraft] = useState<Set<string>>(() => new Set(selected))

  const [menuStyle, setMenuStyle] = useState<FilterMenuComputedStyle | null>(null)

  const placementRectRef = useRef<ReturnType<typeof resolveFilterMenuPlacementRect>>(null)



  const selectedSignature = useMemo(

    () => [...selected].sort().join('\0'),

    [selected]

  )



  const applyFrozenPlacement = useCallback(() => {
    const rect = placementRectRef.current
    if (!rect) {
      setMenuStyle(null)
      return
    }
    setMenuStyle(computeFilterMenuOpenBelowAnchor(rect))
  }, [])

  useLayoutEffect(() => {
    placementRectRef.current = resolveFilterMenuPlacementRect(
      anchorRectAtOpen,
      pointerAtOpen
    )
    applyFrozenPlacement()
    const onResize = () => applyFrozenPlacement()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [applyFrozenPlacement, anchorRectAtOpen, pointerAtOpen])



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



  const optionsSignature = options.join('\0')



  const visibleOptions = useMemo(() => {

    const q = search.trim().toLowerCase()

    if (!q) return options

    return options.filter((opt) => opt.toLowerCase().includes(q))

  }, [options, search, optionsSignature])



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



  const listMaxHeight = menuStyle?.listMaxHeight ?? FILTER_MENU_LIST_MAX_HEIGHT

  const menuHeight = listMaxHeight + FILTER_MENU_CHROME_HEIGHT



  if (!menuStyle) return null

  return createPortal(

    <div

      ref={panelRef}

      className="erp-col-filter-menu"

      style={{

        position: menuStyle.position,

        left: menuStyle.left,

        top: menuStyle.top,

        width: menuStyle.width,

        height: menuHeight,
        maxHeight: menuHeight,

        zIndex: 10000,

      }}

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


