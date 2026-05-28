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
  gridStorageKey,
  layoutsEqual,
  loadGridLayout,
  persistGridLayout,
  type StoredGridLayout,
} from '../utils/gridLayoutStorage'

export const GRID_MIN_COL_WIDTH = 16

type Options = {
  onLayoutChange?: () => void
}

function columnKeys(columns: GridColumnDef[]): string[] {
  return columns.map((col) => col.key)
}

export function useGridColumnLayout(
  gridId: string,
  columns: GridColumnDef[],
  options?: Options
) {
  const storageKey = gridStorageKey(gridId)
  const minWidths = useMemo(() => columns.map((col) => col.minWidth ?? GRID_MIN_COL_WIDTH), [columns])
  const keysSignature = columnKeys(columns).join('|')
  const onLayoutChange = options?.onLayoutChange

  const initial = useMemo(
    () => loadGridLayout(storageKey, columns, minWidths),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per gridId + column set
    [storageKey, keysSignature]
  )

  const [order, setOrder] = useState<string[]>(initial.order)
  const [widthsByKey, setWidthsByKey] = useState<Record<string, number>>(initial.widths)
  const savedSnapshotRef = useRef<StoredGridLayout>(initial)

  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const dragFromRef = useRef<number | null>(null)
  const dropIndexRef = useRef<number | null>(null)

  const currentLayout = useMemo(
    (): StoredGridLayout => ({ order, widths: widthsByKey }),
    [order, widthsByKey]
  )

  const isDirty = useMemo(
    () => !layoutsEqual(currentLayout, savedSnapshotRef.current),
    [currentLayout]
  )

  useEffect(() => {
    const loaded = loadGridLayout(storageKey, columns, minWidths)
    savedSnapshotRef.current = loaded
    setOrder(loaded.order)
    setWidthsByKey(loaded.widths)
  }, [storageKey, keysSignature, columns, minWidths])

  useEffect(() => {
    const keys = columnKeys(columns)
    setOrder((prev) => {
      const merged = mergeOrderInHook(prev, keys)
      return merged
    })
    setWidthsByKey((prev) => mergeWidthsInHook(columns, minWidths, prev))
  }, [keysSignature, columns, minWidths])

  const notifyChange = useCallback(() => {
    onLayoutChange?.()
  }, [onLayoutChange])

  const saveLayout = useCallback(() => {
    const payload: StoredGridLayout = { order, widths: widthsByKey }
    persistGridLayout(storageKey, payload)
    savedSnapshotRef.current = payload
    notifyChange()
  }, [order, widthsByKey, storageKey, notifyChange])

  const orderedColumns = useMemo(() => {
    const byKey = new Map(columns.map((col) => [col.key, col]))
    return order.map((key) => byKey.get(key)).filter((col): col is GridColumnDef => col != null)
  }, [order, columns])

  const widths = useMemo(
    () => orderedColumns.map((col) => widthsByKey[col.key] ?? col.defaultWidth),
    [orderedColumns, widthsByKey]
  )

  const widthsRef = useRef(widths)
  widthsRef.current = widths

  const handleResizeStart = useCallback(
    (columnIndex: number, startX: number) => {
      const col = orderedColumns[columnIndex]
      if (!col) return
      const startWidth = widthsRef.current[columnIndex] ?? col.defaultWidth
      const minWidth = minWidths[columns.findIndex((c) => c.key === col.key)] ?? GRID_MIN_COL_WIDTH

      const onMove = (event: MouseEvent) => {
        const nextWidth = Math.max(minWidth, startWidth + event.clientX - startX)
        setWidthsByKey((prev) => ({ ...prev, [col.key]: nextWidth }))
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.classList.remove('erp-col-resizing')
        notifyChange()
      }

      document.body.classList.add('erp-col-resizing')
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [orderedColumns, columns, minWidths, notifyChange]
  )

  const reorderColumn = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return
      setOrder((prev) => {
        const next = [...prev]
        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)
        return next
      })
      notifyChange()
    },
    [notifyChange]
  )

  const resolveDropIndex = useCallback((clientX: number, clientY: number): number | null => {
    const el = document.elementFromPoint(clientX, clientY)
    const th = el?.closest<HTMLElement>('th[data-col-index]')
    if (!th) return null
    const index = Number(th.dataset.colIndex)
    return Number.isNaN(index) ? null : index
  }, [])

  const endColumnDrag = useCallback(() => {
    dragFromRef.current = null
    dropIndexRef.current = null
    setDragIndex(null)
    setDropIndex(null)
    document.body.classList.remove('erp-col-dragging')
  }, [])

  const handleColumnDragStart = useCallback(
    (fromIndex: number, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      dragFromRef.current = fromIndex
      dropIndexRef.current = fromIndex
      setDragIndex(fromIndex)
      setDropIndex(fromIndex)
      document.body.classList.add('erp-col-dragging')

      const onMove = (e: PointerEvent) => {
        const toIndex = resolveDropIndex(e.clientX, e.clientY)
        if (toIndex != null) {
          dropIndexRef.current = toIndex
          setDropIndex(toIndex)
        }
      }

      const onUp = (e: PointerEvent) => {
        const from = dragFromRef.current
        const toIndex = resolveDropIndex(e.clientX, e.clientY) ?? dropIndexRef.current
        if (from != null && toIndex != null) reorderColumn(from, toIndex)
        endColumnDrag()
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
      }

      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
    },
    [endColumnDrag, reorderColumn, resolveDropIndex]
  )

  return {
    orderedColumns,
    widths,
    dragIndex,
    dropIndex,
    isDirty,
    saveLayout,
    handleResizeStart,
    handleColumnDragStart,
  }
}

function mergeOrderInHook(saved: string[], keys: string[]): string[] {
  if (!saved.length) return keys
  const keySet = new Set(keys)
  const next = saved.filter((key) => keySet.has(key))
  for (const key of keys) {
    if (!next.includes(key)) next.push(key)
  }
  return next
}

function mergeWidthsInHook(
  columns: GridColumnDef[],
  minWidths: number[],
  saved: Record<string, number>
): Record<string, number> {
  const result: Record<string, number> = {}
  columns.forEach((col, index) => {
    const min = minWidths[index] ?? GRID_MIN_COL_WIDTH
    const raw = saved[col.key] ?? col.defaultWidth
    result[col.key] = Math.max(min, raw)
  })
  return result
}

export type GridColumnLayout = ReturnType<typeof useGridColumnLayout>
