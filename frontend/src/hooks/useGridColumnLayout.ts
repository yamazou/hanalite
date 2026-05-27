import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { GridColumnDef } from '../components/ResizableGridTable'

export const GRID_MIN_COL_WIDTH = 16

type StoredLayoutV2 = {
  order: string[]
  widths: Record<string, number>
}

function columnKeys(columns: GridColumnDef[]): string[] {
  return columns.map((col) => col.key)
}

function mergeOrder(saved: string[] | undefined, keys: string[]): string[] {
  if (!saved?.length) return keys
  const keySet = new Set(keys)
  const next = saved.filter((key) => keySet.has(key))
  for (const key of keys) {
    if (!next.includes(key)) next.push(key)
  }
  return next
}

function mergeWidths(
  columns: GridColumnDef[],
  minWidths: number[],
  saved: Record<string, number> | undefined
): Record<string, number> {
  const result: Record<string, number> = {}
  columns.forEach((col, index) => {
    const min = minWidths[index] ?? GRID_MIN_COL_WIDTH
    const raw = saved?.[col.key] ?? col.defaultWidth
    result[col.key] = Math.max(min, raw)
  })
  return result
}

function loadLayout(
  storageKey: string,
  columns: GridColumnDef[],
  minWidths: number[]
): StoredLayoutV2 {
  const keys = columnKeys(columns)
  const defaultWidths = mergeWidths(columns, minWidths, undefined)
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { order: keys, widths: defaultWidths }
    const parsed = JSON.parse(raw) as StoredLayoutV2 | number[]
    if (Array.isArray(parsed)) {
      const widths = { ...defaultWidths }
      parsed.forEach((width, index) => {
        const key = keys[index]
        if (!key) return
        const min = minWidths[index] ?? GRID_MIN_COL_WIDTH
        widths[key] = Math.max(min, width ?? columns[index].defaultWidth)
      })
      return { order: keys, widths }
    }
    const order = mergeOrder(parsed.order, keys)
    const widths = mergeWidths(columns, minWidths, parsed.widths)
    return { order, widths }
  } catch {
    return { order: keys, widths: defaultWidths }
  }
}

export function useGridColumnLayout(gridId: string, columns: GridColumnDef[]) {
  const storageKey = `hanalite:grid:${gridId}`
  const minWidths = useMemo(() => columns.map((col) => col.minWidth ?? GRID_MIN_COL_WIDTH), [columns])
  const keysSignature = columnKeys(columns).join('|')

  const [order, setOrder] = useState<string[]>(() => loadLayout(storageKey, columns, minWidths).order)
  const [widthsByKey, setWidthsByKey] = useState<Record<string, number>>(
    () => loadLayout(storageKey, columns, minWidths).widths
  )
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const dragFromRef = useRef<number | null>(null)
  const dropIndexRef = useRef<number | null>(null)

  useEffect(() => {
    const keys = columnKeys(columns)
    setOrder((prev) => mergeOrder(prev, keys))
    setWidthsByKey((prev) => mergeWidths(columns, minWidths, prev))
  }, [keysSignature, columns, minWidths])

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ order, widths: widthsByKey }))
  }, [order, widthsByKey, storageKey])

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
      }

      document.body.classList.add('erp-col-resizing')
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [orderedColumns, columns, minWidths]
  )

  const reorderColumn = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    setOrder((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }, [])

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
    handleResizeStart,
    handleColumnDragStart,
  }
}

export type GridColumnLayout = ReturnType<typeof useGridColumnLayout>
