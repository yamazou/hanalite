import { useCallback, useState } from 'react'

export type GridColumnFiltersApi = ReturnType<typeof useGridColumnFilters>

export function useGridColumnFilters() {
  const [filters, setFilters] = useState<Record<string, Set<string>>>({})

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

  return { filters, isActive, getSelected, applySelection, clearColumn, clearAll }
}
