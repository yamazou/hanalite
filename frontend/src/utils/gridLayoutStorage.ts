import type { GridColumnDef } from '../components/ResizableGridTable'
import { GRID_ABS_MIN_COL_WIDTH } from './gridColumnWidth'

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

/** Drop duplicate keys while preserving first occurrence (corrupt saved layouts). */
export function dedupeColumnOrder(order: string[]): string[] {
  const seen = new Set<string>()
  const next: string[] = []
  for (const key of order) {
    if (seen.has(key)) continue
    seen.add(key)
    next.push(key)
  }
  return next
}

export function mergeColumnOrder(saved: string[] | undefined, keys: string[]): string[] {
  if (!saved?.length) return keys
  const keySet = new Set(keys)
  const next = dedupeColumnOrder(saved.filter((key) => keySet.has(key)))
  for (const key of keys) {
    if (!next.includes(key)) next.push(key)
  }
  return next
}

/** Keep pinned keys at the start (e.g. row selection checkbox column). */
export function pinKeysFirst(order: string[], pinFirst: string[]): string[] {
  if (!pinFirst.length) return order
  const pinSet = new Set(pinFirst)
  const pinned = pinFirst.filter((key) => order.includes(key))
  const rest = order.filter((key) => !pinSet.has(key))
  return [...pinned, ...rest]
}

export function mergeColumnWidths(
  columns: GridColumnDef[],
  minWidths: number[],
  saved: Record<string, number> | undefined
): Record<string, number> {
  const result: Record<string, number> = {}
  columns.forEach((col, index) => {
    const min = minWidths[index] ?? GRID_ABS_MIN_COL_WIDTH
    const raw =
      col.key === 'rownum' ? col.defaultWidth : (saved?.[col.key] ?? col.defaultWidth)
    result[col.key] = Math.max(min, raw)
  })
  return result
}

export function loadGridLayout(
  storageKey: string,
  columns: GridColumnDef[],
  minWidths: number[],
  pinFirst?: string[]
): StoredGridLayout {
  const keys = columnKeys(columns)
  const defaultOrder = pinFirst?.length ? pinKeysFirst(keys, pinFirst) : keys
  const defaultWidths = mergeColumnWidths(columns, minWidths, undefined)
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { order: defaultOrder, widths: defaultWidths }
    const parsed = JSON.parse(raw) as StoredGridLayout | number[]
    if (Array.isArray(parsed)) {
      const widths = { ...defaultWidths }
      parsed.forEach((width, index) => {
        const key = keys[index]
        if (!key) return
        const min = minWidths[index] ?? GRID_ABS_MIN_COL_WIDTH
        widths[key] = Math.max(min, width ?? columns[index].defaultWidth)
      })
      return { order: defaultOrder, widths }
    }
    let order = mergeColumnOrder(parsed.order, keys)
    if (pinFirst?.length) order = pinKeysFirst(order, pinFirst)
    const widths = mergeColumnWidths(columns, minWidths, parsed.widths)
    return { order, widths }
  } catch {
    return { order: defaultOrder, widths: defaultWidths }
  }
}

const AUTO_WIDTH_KEYS = new Set(['rownum'])

export function persistGridLayout(storageKey: string, layout: StoredGridLayout): void {
  const widths = { ...layout.widths }
  for (const key of AUTO_WIDTH_KEYS) {
    delete widths[key]
  }
  localStorage.setItem(storageKey, JSON.stringify({ order: layout.order, widths }))
}

export function layoutsEqual(a: StoredGridLayout, b: StoredGridLayout): boolean {
  if (a.order.length !== b.order.length) return false
  for (let i = 0; i < a.order.length; i += 1) {
    if (a.order[i] !== b.order[i]) return false
  }
  const keys = new Set([...Object.keys(a.widths), ...Object.keys(b.widths)])
  for (const key of keys) {
    if (AUTO_WIDTH_KEYS.has(key)) continue
    if (a.widths[key] !== b.widths[key]) return false
  }
  return true
}
