import { emptyEditItemTypRow, type EditItemTypRow } from './itemTypMasterEdit'
import { itemTypColorToDisplay } from './itemTypColor'

/** Merge Excel rows into item-type grid: match by Item Type Code, else append. */
export function mergeItemTypImportRows(
  parsed: Record<string, string>[],
  existing: EditItemTypRow[]
): { rows: EditItemTypRow[]; updated: number; added: number } {
  const byCode = new Map<string, EditItemTypRow>()
  for (const row of existing) {
    const code = row.itemtyp_cd.trim().toLowerCase()
    if (code) byCode.set(code, row)
  }

  const result = [...existing]
  let updated = 0
  let added = 0

  for (const cells of parsed) {
    const code = (cells.code ?? '').trim()
    const name = (cells.name ?? '').trim()
    const color = itemTypColorToDisplay(cells.color)
    if (!code && !name && !color) continue

    const codeKey = code.toLowerCase()
    const match = code ? byCode.get(codeKey) : undefined
    if (match) {
      const index = result.findIndex((r) => r.key === match.key)
      if (index >= 0) {
        result[index] = {
          ...match,
          itemtyp_cd: code || match.itemtyp_cd,
          itemtyp_nm: name || match.itemtyp_nm,
          itemtyp_color: color || match.itemtyp_color,
        }
        updated += 1
      }
    } else if (code) {
      const row = emptyEditItemTypRow()
      row.itemtyp_cd = code
      row.itemtyp_nm = name
      row.itemtyp_color = color
      result.push(row)
      byCode.set(codeKey, row)
      added += 1
    }
  }

  return { rows: result, updated, added }
}
