import type { ItemTyp } from '../types/masters'

/** Item Type dropdown option (Items grid). */
export function itemTypDropdownLabel(t: Pick<ItemTyp, 'itemtyp_cd'>): string {
  return (t.itemtyp_cd ?? '').trim()
}

/** Tab label on Items screen. */
export function itemTypTabLabel(t: Pick<ItemTyp, 'itemtyp_nm'>): string {
  return (t.itemtyp_nm ?? '').trim()
}

export type OutputItemTypFilter = 'ALL' | 'WIP' | 'FG'

/** Item Process Output Item datalist (FG + WIP only). */
export const ITEM_PROCESS_OUTPUT_ITEMTYP_CDS = ['FG', 'WIP'] as const

/** Production Order Entry header item (FG + WIP only). */
export const PRODUCTION_ORDER_PARENT_ITEMTYP_CDS = ITEM_PROCESS_OUTPUT_ITEMTYP_CDS

/** Item Process Input Item datalist (RM + PARTS + WIP only). */
export const ITEM_PROCESS_INPUT_ITEMTYP_CDS = ['RM', 'PARTS', 'WIP'] as const

export function isItemtypCdAllowed(
  itemtypCd: string,
  allowedCds: readonly string[]
): boolean {
  const upper = itemtypCd.trim().toUpperCase()
  return allowedCds.some((cd) => cd.toUpperCase() === upper)
}

export function allowedItemtypIds(
  itemtyps: ItemTyp[],
  allowedCds: readonly string[]
): Set<number> {
  return new Set(
    itemtyps
      .filter((t) => isItemtypCdAllowed(t.itemtyp_cd, allowedCds))
      .map((t) => t.itemtyp_id)
  )
}

export function filterItemListRowsByItemtypIds<T extends { itemtyp_id: number }>(
  rows: T[],
  allowedIds: Set<number>
): T[] {
  if (allowedIds.size === 0) return []
  return rows.filter((row) => allowedIds.has(row.itemtyp_id))
}

export function findItemtypByKind(itemtyps: ItemTyp[], kind: 'WIP' | 'FG'): ItemTyp | undefined {
  return itemtyps.find((t) => {
    const cd = t.itemtyp_cd.trim().toUpperCase()
    const nm = t.itemtyp_nm.trim().toLowerCase()
    if (kind === 'WIP') return cd === 'WIP' || nm.includes('work in process')
    return cd === 'FG' || nm.includes('finished good')
  })
}

/** Resolve Item Type from Excel import: match Item Type Code, then Name. */
export function resolveItemtypId(
  label: string | undefined,
  itemtyps: ItemTyp[]
): number | '' {
  const raw = (label ?? '').trim()
  if (!raw) return ''
  const lower = raw.toLowerCase()
  const byCode = itemtyps.find((t) => t.itemtyp_cd.trim().toLowerCase() === lower)
  if (byCode) return byCode.itemtyp_id
  const byName = itemtyps.find((t) => t.itemtyp_nm.trim().toLowerCase() === lower)
  return byName?.itemtyp_id ?? ''
}
