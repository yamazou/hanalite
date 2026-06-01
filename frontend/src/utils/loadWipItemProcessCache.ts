import { api } from '../api/client'
import type { ItemProcessesOut } from '../types/itemprocs'
import type { ItemTyp } from '../types/masters'
import { isWipCatalogItem } from './itemProcessTree'

/** Load Item Process definitions for WIP items (includes nested WIP subprocesses). */
export async function loadWipItemProcessCache(
  seedWipIds: number[],
  items: { item_id: number; itemtyp_id?: number }[],
  itemtyps: ItemTyp[],
  existing: Map<number, ItemProcessesOut> = new Map()
): Promise<Map<number, ItemProcessesOut>> {
  const merged = new Map(existing)
  const fetched = new Set<number>()
  const queue = [...seedWipIds]

  while (queue.length > 0) {
    const itemId = queue.shift()!
    if (fetched.has(itemId)) continue
    fetched.add(itemId)
    if (merged.has(itemId)) {
      const saved = merged.get(itemId)!
      for (const proc of saved.processes) {
        for (const inp of proc.inputs) {
          if (isWipCatalogItem(items, itemtyps, inp.item_id) && !fetched.has(inp.item_id)) {
            queue.push(inp.item_id)
          }
        }
      }
      continue
    }
    try {
      const data = await api.getItemProcesses(itemId)
      merged.set(itemId, data)
      for (const proc of data.processes) {
        for (const inp of proc.inputs) {
          if (isWipCatalogItem(items, itemtyps, inp.item_id) && !fetched.has(inp.item_id)) {
            queue.push(inp.item_id)
          }
        }
      }
    } catch {
      // no subprocess definition for this WIP
    }
  }

  return merged
}
