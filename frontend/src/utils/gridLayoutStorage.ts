import type { GridColumnDef } from '../components/ResizableGridTable'

const GRID_MIN_COL_WIDTH = 16

export type StoredGridLayout = {
  order: string[]
  widths: Record<string, number>
}

export function gridStorageKey(gridId: string): string {
  return `hanalite:grid:${gridId}`
}

function columnKeys(columns: GridColumnDef[]): string[] {
  return columns.map((col) => col.key)
}

export function mergeColumnOrder(saved: string[] | undefined, keys: string[]): string[] {
  if (!saved?.length) return keys
  const keySet = new Set(keys)
  const next = saved.filter((key) => keySet.has(key))
  for (const key of keys) {
    if (!next.includes(key)) next.push(key)
  }
  return next
}

export function mergeColumnWidths(
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

export function loadGridLayout(
  storageKey: string,
  columns: GridColumnDef[],
  minWidths: number[]
): StoredGridLayout {
  const keys = columnKeys(columns)
  const defaultWidths = mergeColumnWidths(columns, minWidths, undefined)
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { order: keys, widths: defaultWidths }
    const parsed = JSON.parse(raw) as StoredGridLayout | number[]
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
    const order = mergeColumnOrder(parsed.order, keys)
    const widths = mergeColumnWidths(columns, minWidths, parsed.widths)
    return { order, widths }
  } catch {
    return { order: keys, widths: defaultWidths }
  }
}

export function persistGridLayout(storageKey: string, layout: StoredGridLayout): void {
  localStorage.setItem(storageKey, JSON.stringify(layout))
}

export function layoutsEqual(a: StoredGridLayout, b: StoredGridLayout): boolean {
  if (a.order.length !== b.order.length) return false
  for (let i = 0; i < a.order.length; i += 1) {
    if (a.order[i] !== b.order[i]) return false
  }
  const keys = new Set([...Object.keys(a.widths), ...Object.keys(b.widths)])
  for (const key of keys) {
    if (a.widths[key] !== b.widths[key]) return false
  }
  return true
}
