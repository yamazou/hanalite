import type { ItemTyp } from '../types/masters'
import { emptyEditItemRow, type EditItemRow } from './itemMasterEdit'
import { resolveItemtypId } from './itemTypDisplay'

/** Merge Excel rows into item grid: match by Item Code, else append. */
export function mergeItemImportRows(
  parsed: Record<string, string>[],
  existing: EditItemRow[],
  itemtyps: ItemTyp[],
  defaultItemtypId: number | ''
): { rows: EditItemRow[]; updated: number; added: number } {
  const byCode = new Map<string, EditItemRow>()
  for (const row of existing) {
    const code = row.item_cd.trim().toLowerCase()
    if (code) byCode.set(code, row)
  }

  const result = [...existing]
  let updated = 0
  let added = 0

  for (const cells of parsed) {
    const code = (cells.code ?? '').trim()
    const name = (cells.name ?? '').trim()
    if (!code && !name) continue

    const itemtyp_id = resolveItemtypId(cells.type, itemtyps) || defaultItemtypId
    const codeKey = code.toLowerCase()

    const match = code ? byCode.get(codeKey) : undefined
    if (match) {
      const index = result.findIndex((r) => r.key === match.key)
      if (index >= 0) {
        result[index] = {
          ...match,
          item_cd: code || match.item_cd,
          item_nm: name || match.item_nm,
          itemtyp_id: itemtyp_id !== '' ? itemtyp_id : match.itemtyp_id,
          supplier_ids: ['', '', ''],
        }
        updated += 1
      }
    } else {
      const row = emptyEditItemRow(itemtyp_id)
      row.item_cd = code
      row.item_nm = name
      result.push(row)
      if (code) byCode.set(codeKey, row)
      added += 1
    }
  }

  return { rows: result, updated, added }
}
