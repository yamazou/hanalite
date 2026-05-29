import type { ItemTyp } from '../types/masters'

/** Item Type dropdown option (Items grid). */
export function itemTypDropdownLabel(t: Pick<ItemTyp, 'itemtyp_cd'>): string {
  return (t.itemtyp_cd ?? '').trim()
}

/** Tab label on Items screen. */
export function itemTypTabLabel(t: Pick<ItemTyp, 'itemtyp_nm'>): string {
  return (t.itemtyp_nm ?? '').trim()
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
