import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from 'react'
import { erpRowClass } from '../components/erp/ErpGridPanel'
import {
  buildGridRowNavKeys,
  findGridRowNavIndex,
  GRID_ROW_NAV_KEY_ATTR,
  gridRowKeyFromFocus,
  gridRowNavScrollConfig,
  isFocusInGridRowNavWrap,
  isHeaderListArrowKey,
  resolveGridNavAnchorKey,
  scheduleFocusGridNavRow,
  shouldIgnoreHeaderListArrowKey,
  stepHeaderListNavIndex,
} from '../utils/headerListKeyboardNav'

type Options<TRow extends { key: string }> = {
  wrapId: string
  displayRows: TRow[]
  isBlankRow: (row: TRow) => boolean
  selectedKey?: string | null
  onSelectedKeyChange?: (key: string | null) => void
  onActivate?: (row: TRow) => void
}

export function useGridRowKeyboardNav<TRow extends { key: string }>({
  wrapId,
  displayRows,
  isBlankRow,
  selectedKey: controlledKey,
  onSelectedKeyChange,
  onActivate,
}: Options<TRow>) {
  const [internalKey, setInternalKey] = useState<string | null>(null)
  const activeRowKey = controlledKey !== undefined ? controlledKey : internalKey
  const setActiveRowKey = onSelectedKeyChange ?? setInternalKey
  const displayRowsRef = useRef(displayRows)
  displayRowsRef.current = displayRows
  const scrollConfig = gridRowNavScrollConfig(wrapId)

  useEffect(() => {
    const valid = new Set(displayRows.map((row) => row.key))
    if (activeRowKey != null && !valid.has(activeRowKey)) {
      setActiveRowKey(null)
    }
  }, [displayRows, activeRowKey, setActiveRowKey])

  const activateRow = useCallback(
    (key: string) => {
      const row = displayRowsRef.current.find((entry) => entry.key === key)
      if (!row || isBlankRow(row)) return
      setActiveRowKey(key)
      onActivate?.(row)
    },
    [isBlankRow, onActivate, setActiveRowKey]
  )

  const moveRowNav = useCallback(
    (delta: number, fromKey?: string | null, previousFocus?: EventTarget | null) => {
      const keys = buildGridRowNavKeys(
        displayRowsRef.current,
        (row) => !isBlankRow(row)
      )
      const anchorKey = resolveGridNavAnchorKey(
        keys,
        fromKey ?? gridRowKeyFromFocus(previousFocus ?? null),
        activeRowKey
      )
      const index = findGridRowNavIndex(keys, anchorKey)
      const nextIndex = stepHeaderListNavIndex(index, delta, keys.length)
      if (nextIndex < 0) return
      const key = keys[nextIndex]
      if (!key) return
      activateRow(key)
      scheduleFocusGridNavRow(key, scrollConfig, previousFocus)
    },
    [activateRow, activeRowKey, scrollConfig]
  )

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (!isHeaderListArrowKey(e.key)) return
      if (e.defaultPrevented) return
      if (shouldIgnoreHeaderListArrowKey(e.target)) return
      if (!isFocusInGridRowNavWrap(e.target, wrapId)) return
      e.preventDefault()
      moveRowNav(
        e.key === 'ArrowDown' ? 1 : -1,
        gridRowKeyFromFocus(e.target) ?? activeRowKey,
        e.target
      )
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [wrapId, moveRowNav, activeRowKey])

  const handleRowFocusCapture = useCallback(
    (key: string) => (e: FocusEvent<HTMLTableRowElement>) => {
      const el = e.target
      if (
        !(
          el instanceof HTMLInputElement ||
          el instanceof HTMLSelectElement ||
          el instanceof HTMLTextAreaElement
        )
      ) {
        return
      }
      activateRow(key)
    },
    [activateRow]
  )

  const handleRowKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTableRowElement>) => {
      if (!isHeaderListArrowKey(e.key)) return
      e.preventDefault()
      moveRowNav(
        e.key === 'ArrowDown' ? 1 : -1,
        gridRowKeyFromFocus(e.target) ?? activeRowKey,
        e.target
      )
    },
    [moveRowNav, activeRowKey]
  )

  const handleRowClick = useCallback(
    (row: TRow) => (e: MouseEvent<HTMLTableRowElement>) => {
      if (
        (e.target as HTMLElement).closest(
          'button, input, select, textarea, .erp-col-check'
        )
      ) {
        return
      }
      activateRow(row.key)
      e.currentTarget.focus()
    },
    [activateRow]
  )

  const getTrProps = useCallback(
    (row: TRow) => ({
      [GRID_ROW_NAV_KEY_ATTR]: row.key,
      tabIndex: -1 as const,
      onFocusCapture: handleRowFocusCapture(row.key),
      onKeyDown: handleRowKeyDown,
      onClick: handleRowClick(row),
    }),
    [handleRowFocusCapture, handleRowKeyDown, handleRowClick]
  )

  const rowHighlightClass = useCallback(
    (index: number, rowKey: string) => erpRowClass(index, activeRowKey === rowKey),
    [activeRowKey]
  )

  return {
    activeRowKey,
    activateRow,
    getTrProps,
    rowHighlightClass,
    isRowActive: (key: string) => activeRowKey === key,
  }
}
