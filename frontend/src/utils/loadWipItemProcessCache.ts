import { api } from '../api/client'
import type { ItemProcessesOut } from '../types/itemprocs'
import type { ItemTyp } from '../types/masters'
/**
 * Load Item Process definitions reachable from seed item ids (FG parent and/or WIP).
 * Walks every input on each loaded process and fetches nested definitions when present
 * (purchase/RM items usually have no process master — those calls are skipped via catch).
 */
export async function loadWipItemProcessCache(
  seedItemIds: number[],
  _items: { item_id: number; itemtyp_id?: number }[],
  _itemtyps: ItemTyp[],
  existing: Map<number, ItemProcessesOut> = new Map()
): Promise<Map<number, ItemProcessesOut>> {
  const merged = new Map(existing)
  let added = false
  const fetched = new Set<number>()
  const queue = [...seedItemIds]

  const enqueueInputs = (data: ItemProcessesOut) => {
    for (const proc of data.processes) {
      for (const inp of proc.inputs) {
        if (!fetched.has(inp.item_id)) {
          queue.push(inp.item_id)
        }
      }
    }
  }

  while (queue.length > 0) {
    const itemId = queue.shift()!
    if (fetched.has(itemId)) continue
    fetched.add(itemId)
    if (merged.has(itemId)) {
      enqueueInputs(merged.get(itemId)!)
      continue
    }
    try {
      const data = await api.getItemProcesses(itemId)
      if (!merged.has(itemId)) added = true
      merged.set(itemId, data)
      enqueueInputs(data)
    } catch {
      // no subprocess definition for this item (typical for RM / purchase parts)
    }
  }

  return added ? merged : existing
}
