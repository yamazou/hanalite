import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { GridColumnDef } from '../components/ResizableGridTable'
import {
  dedupeColumnOrder,
  gridStorageKey,
  layoutsEqual,
  loadGridLayout,
  persistGridLayout,
  pinKeysFirst,
  type StoredGridLayout,
} from '../utils/gridLayoutStorage'
import {
  GRID_ABS_MIN_COL_WIDTH,
  GRID_ROWNUM_COLUMN_KEY,
  resolveColumnMinWidth,
  rowNumColumnWidthForRowCount,
} from '../utils/gridColumnWidth'
import type { GridColumnLayoutOptions } from './useGridColumnLayoutOptions'
import { useGridLayoutScope } from '../context/AuthContext'

export { GRID_ABS_MIN_COL_WIDTH as GRID_MIN_COL_WIDTH } from '../utils/gridColumnWidth'
export type { GridColumnLayoutOptions } from './useGridColumnLayoutOptions'

function columnKeys(columns: GridColumnDef[]): string[] {
  return columns.map((col) => col.key)
}

export function useGridColumnLayout(
  gridId: string,
  columns: GridColumnDef[],
  options?: GridColumnLayoutOptions
) {
  const layoutScope = useGridLayoutScope()
  const storageKey = gridStorageKey(gridId, layoutScope)
  const keysSignature = columnKeys(columns).join('|')
  const onLayoutChange = options?.onLayoutChange
  const pinFirst = options?.pinFirst
  const rowCount = options?.rowCount
  const pinFirstSignature = pinFirst?.join('|') ?? ''
  const isColumnHeaderFilterable = options?.isColumnHeaderFilterable
  const headerFilterableDefault = options?.headerFilterable !== false

  const isHeaderFilterable = useCallback(
    (columnKey: string) => {
      if (isColumnHeaderFilterable) return isColumnHeaderFilterable(columnKey)
      return headerFilterableDefault
    },
    [isColumnHeaderFilterable, headerFilterableDefault]
  )

  const minWidths = useMemo(
    () => columns.map((col) => resolveColumnMinWidth(col, isHeaderFilterable(col.key))),
    [columns, isHeaderFilterable]
  )

  const initial = useMemo(
    () => loadGridLayout(storageKey, columns, minWidths, pinFirst),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per gridId + column set
    [storageKey, keysSignature, pinFirstSignature]
  )

  const [order, setOrder] = useState<string[]>(initial.order)
  const [widthsByKey, setWidthsByKey] = useState<Record<string, number>>(initial.widths)
  const [savedSnapshot, setSavedSnapshot] = useState<StoredGridLayout>(initial)

  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [resizeIndex, setResizeIndex] = useState<number | null>(null)
  const dragFromRef = useRef<number | null>(null)
  const dropIndexRef = useRef<number | null>(null)
  const dragTableRef = useRef<HTMLTableElement | null>(null)

  const resolveDropIndex = useCallback((clientX: number, clientY: number): number | null => {
    const el = document.elementFromPoint(clientX, clientY)
    const thFromPoint = el?.closest<HTMLElement>('th[data-col-index]')
    if (thFromPoint) {
      const index = Number(thFromPoint.dataset.colIndex)
      if (!Number.isNaN(index)) return index
    }

    const table = dragTableRef.current
    if (!table) return null

    const headers = table.querySelectorAll<HTMLElement>('thead th[data-col-index]')
    for (const th of headers) {
      const rect = th.getBoundingClientRect()
      if (clientX >= rect.left && clientX < rect.right) {
        const index = Number(th.dataset.colIndex)
        if (!Number.isNaN(index)) return index
      }
    }

    if (headers.length === 0) return null
    const first = headers[0].getBoundingClientRect()
    const last = headers[headers.length - 1].getBoundingClientRect()
    if (clientX < first.left) {
      return Number(headers[0].dataset.colIndex)
    }
    if (clientX >= last.right) {
      return Number(headers[headers.length - 1].dataset.colIndex)
    }
    return null
  }, [])

  const currentLayout = useMemo(
    (): StoredGridLayout => ({ order, widths: widthsByKey }),
    [order, widthsByKey]
  )

  const isDirty = useMemo(
    () => !layoutsEqual(currentLayout, savedSnapshot),
    [currentLayout, savedSnapshot]
  )

  const layoutIdentityRef = useRef<string | null>(null)

  useEffect(() => {
    const identity = `${storageKey}|${keysSignature}|${pinFirstSignature}`
    if (layoutIdentityRef.current === identity) return
    layoutIdentityRef.current = identity

    const loaded = loadGridLayout(storageKey, columns, minWidths, pinFirst)
    setSavedSnapshot(loaded)
    setOrder(loaded.order)
    setWidthsByKey(loaded.widths)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, keysSignature, pinFirstSignature])

  useEffect(() => {
    const keys = columnKeys(columns)
    setOrder((prev) => mergeOrderInHook(prev, keys, pinFirst))
    setWidthsByKey((prev) => mergeWidthsInHook(columns, minWidths, prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysSignature, pinFirstSignature])

  useEffect(() => {
    if (rowCount == null) return
    const w = rowNumColumnWidthForRowCount(rowCount)
    setWidthsByKey((prev) => (prev[GRID_ROWNUM_COLUMN_KEY] === w ? prev : { ...prev, rownum: w }))
  }, [rowCount])

  const notifyChange = useCallback(() => {
    onLayoutChange?.()
  }, [onLayoutChange])

  const saveLayout = useCallback(() => {
    const pinnedOrder = pinFirst?.length ? pinKeysFirst(order, pinFirst) : order
    const payload: StoredGridLayout = { order: pinnedOrder, widths: widthsByKey }
    persistGridLayout(storageKey, payload)
    setSavedSnapshot(payload)
    notifyChange()
  }, [order, widthsByKey, storageKey, notifyChange, pinFirstSignature])

  const orderedColumns = useMemo(() => {
    const byKey = new Map(columns.map((col) => [col.key, col]))
    const rawKeys = pinFirst?.length ? pinKeysFirst(order, pinFirst) : order
    const keys = dedupeColumnOrder(rawKeys)
    return keys.map((key) => byKey.get(key)).filter((col): col is GridColumnDef => col != null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pinFirstSignature tracks pinFirst content
  }, [order, columns, pinFirstSignature])

  const widths = useMemo(
    () => orderedColumns.map((col) => widthsByKey[col.key] ?? col.defaultWidth),
    [orderedColumns, widthsByKey]
  )

  const widthsRef = useRef(widths)
  widthsRef.current = widths

  const handleResizeStart = useCallback(
    (columnIndex: number, startX: number) => {
      const col = orderedColumns[columnIndex]
      if (!col || col.key === GRID_ROWNUM_COLUMN_KEY) return
      const startWidth = widthsRef.current[columnIndex] ?? col.defaultWidth
      const minWidth = minWidths[columns.findIndex((c) => c.key === col.key)] ?? GRID_ABS_MIN_COL_WIDTH

      const onMove = (event: MouseEvent) => {
        const nextWidth = Math.max(minWidth, startWidth + event.clientX - startX)
        setWidthsByKey((prev) => ({ ...prev, [col.key]: nextWidth }))
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.classList.remove('erp-col-resizing')
        setResizeIndex(null)
        notifyChange()
      }

      setResizeIndex(columnIndex)
      document.body.classList.add('erp-col-resizing')
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [orderedColumns, columns, minWidths, notifyChange]
  )

  const reorderColumn = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return
      const pinSet = new Set(pinFirst ?? [])
      setOrder((prev) => {
        const keys = pinFirst?.length ? pinKeysFirst([...prev], pinFirst) : [...prev]
        const movedKey = keys[fromIndex]
        if (!movedKey || pinSet.has(movedKey)) return prev
        const next = [...keys]
        const [moved] = next.splice(fromIndex, 1)
        if (!moved) return prev
        let insertAt = toIndex
        if (fromIndex < toIndex) insertAt -= 1
        if (pinFirst?.length) {
          insertAt = Math.max(insertAt, pinFirst.length)
        }
        next.splice(insertAt, 0, moved)
        return pinFirst?.length ? pinKeysFirst(next, pinFirst) : next
      })
      notifyChange()
    },
    [notifyChange, pinFirstSignature]
  )

  const endColumnDrag = useCallback(() => {
    dragFromRef.current = null
    dropIndexRef.current = null
    dragTableRef.current = null
    setDragIndex(null)
    setDropIndex(null)
    document.body.classList.remove('erp-col-dragging')
  }, [])

  const handleColumnDragStart = useCallback(
    (fromIndex: number, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      dragTableRef.current = event.currentTarget.closest('table')
      dragFromRef.current = fromIndex
      dropIndexRef.current = fromIndex
      setDragIndex(fromIndex)
      setDropIndex(fromIndex)
      document.body.classList.add('erp-col-dragging')

      const onMove = (clientX: number, clientY: number) => {
        const toIndex = resolveDropIndex(clientX, clientY)
        if (toIndex != null) {
          dropIndexRef.current = toIndex
          setDropIndex(toIndex)
        }
      }

      const finish = (clientX: number, clientY: number) => {
        const from = dragFromRef.current
        const toIndex = resolveDropIndex(clientX, clientY) ?? dropIndexRef.current
        if (from != null && toIndex != null) reorderColumn(from, toIndex)
        endColumnDrag()
        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerup', onPointerUp)
        document.removeEventListener('pointercancel', onPointerUp)
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      const onPointerMove = (e: PointerEvent) => onMove(e.clientX, e.clientY)
      const onPointerUp = (e: PointerEvent) => finish(e.clientX, e.clientY)
      const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY)
      const onMouseUp = (e: MouseEvent) => finish(e.clientX, e.clientY)

      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', onPointerUp)
      document.addEventListener('pointercancel', onPointerUp)
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [endColumnDrag, reorderColumn, resolveDropIndex]
  )

  return {
    orderedColumns,
    widths,
    dragIndex,
    dropIndex,
    resizeIndex,
    isDirty,
    saveLayout,
    handleResizeStart,
    handleColumnDragStart,
  }
}

function mergeOrderInHook(saved: string[], keys: string[], pinFirst?: string[]): string[] {
  let next: string[]
  if (!saved.length) {
    next = keys
  } else {
    const keySet = new Set(keys)
    next = dedupeColumnOrder(saved.filter((key) => keySet.has(key)))
    for (const key of keys) {
      if (!next.includes(key)) next.push(key)
    }
  }
  return pinFirst?.length ? pinKeysFirst(dedupeColumnOrder(next), pinFirst) : next
}

function mergeWidthsInHook(
  columns: GridColumnDef[],
  minWidths: number[],
  saved: Record<string, number>
): Record<string, number> {
  const result: Record<string, number> = {}
  columns.forEach((col, index) => {
    const min = minWidths[index] ?? GRID_ABS_MIN_COL_WIDTH
    const raw =
      col.key === GRID_ROWNUM_COLUMN_KEY
        ? col.defaultWidth
        : (saved[col.key] ?? col.defaultWidth)
    result[col.key] = Math.max(min, raw)
  })
  return result
}

export type GridColumnLayout = ReturnType<typeof useGridColumnLayout>
