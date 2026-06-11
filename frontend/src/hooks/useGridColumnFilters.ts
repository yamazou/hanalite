import { useCallback, useState } from 'react'

export type GridColumnFiltersApi = ReturnType<typeof useGridColumnFilters>

export function cloneColumnFilters(
  src: Record<string, Set<string>>
): Record<string, Set<string>> {
  return Object.fromEntries(
    Object.entries(src).map(([key, values]) => [key, new Set(values)])
  )
}

export function columnFiltersEqual(
  a: Record<string, Set<string>>,
  b: Record<string, Set<string>>
): boolean {
  const aKeys = Object.keys(a).sort()
  const bKeys = Object.keys(b).sort()
  if (aKeys.length !== bKeys.length) return false
  for (let i = 0; i < aKeys.length; i++) {
    const key = aKeys[i]!
    if (key !== bKeys[i]) return false
    const sa = a[key]!
    const sb = b[key]!
    if (sa.size !== sb.size) return false
    for (const v of sa) {
      if (!sb.has(v)) return false
    }
  }
  return true
}

export function useGridColumnFilters() {
  const [filters, setFilters] = useState<Record<string, Set<string>>>({})

  const replaceFilters = useCallback((external: Record<string, Set<string>>) => {
    setFilters((prev) => {
      const next = cloneColumnFilters(external)
      if (columnFiltersEqual(prev, next)) return prev
      return next
    })
  }, [])

  const isActive = useCallback((columnKey: string) => columnKey in filters, [filters])

  const getSelected = useCallback(
    (columnKey: string, allOptions: string[]): Set<string> => {
      const current = filters[columnKey]
      if (!current) return new Set(allOptions)
      return new Set(current)
    },
    [filters]
  )

  const applySelection = useCallback((columnKey: string, selected: Set<string>, allOptions: string[]) => {
    setFilters((prev) => {
      const next = { ...prev }
      if (selected.size === 0) {
        next[columnKey] = new Set()
      } else if (selected.size >= allOptions.length) {
        delete next[columnKey]
      } else {
        next[columnKey] = new Set(selected)
      }
      return next
    })
  }, [])

  const clearColumn = useCallback((columnKey: string) => {
    setFilters((prev) => {
      const next = { ...prev }
      delete next[columnKey]
      return next
    })
  }, [])

  const clearAll = useCallback(() => setFilters({}), [])

  return {
    filters,
    isActive,
    getSelected,
    applySelection,
    clearColumn,
    clearAll,
    replaceFilters,
  }
}
