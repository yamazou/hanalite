import { useCallback, useState } from 'react'

export type SortDir = 'asc' | 'desc'

export type GridSortState = {
  key: string
  dir: SortDir
} | null

export function useGridSort() {
  const [sort, setSort] = useState<GridSortState>(null)

  const toggleSort = useCallback((key: string, sortable = true) => {
    if (!sortable) return
    setSort((prev) => {
      if (prev?.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      }
      return { key, dir: 'asc' }
    })
  }, [])

  const sortMark = useCallback(
    (key: string) => {
      if (sort?.key !== key) return ''
      return sort.dir === 'asc' ? ' ▲' : ' ▼'
    },
    [sort]
  )

  return { sort, toggleSort, sortMark }
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === ''
}

export function compareValues(a: unknown, b: unknown, dir: SortDir): number {
  const mul = dir === 'asc' ? 1 : -1
  if (isEmpty(a) && isEmpty(b)) return 0
  if (isEmpty(a)) return 1
  if (isEmpty(b)) return -1
  if (typeof a === 'number' && typeof b === 'number') {
    return (a - b) * mul
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }) * mul
}
