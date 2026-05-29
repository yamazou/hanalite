import { emptyEditNameMasterRow, type EditNameMasterRow } from './nameMasterEdit'

export function mergeNameMasterImportRows(
  parsed: Record<string, string>[],
  existing: EditNameMasterRow[]
): { rows: EditNameMasterRow[]; updated: number; added: number } {
  const byName = new Map<string, EditNameMasterRow>()
  for (const row of existing) {
    const name = row.name.trim().toLowerCase()
    if (name) byName.set(name, row)
  }

  const result = [...existing]
  let updated = 0
  let added = 0

  for (const cells of parsed) {
    const name = (cells.name ?? '').trim()
    if (!name) continue

    const nameKey = name.toLowerCase()
    const match = byName.get(nameKey)
    if (match) {
      const index = result.findIndex((r) => r.key === match.key)
      if (index >= 0) {
        result[index] = { ...match, name }
        updated += 1
      }
    } else {
      const row = emptyEditNameMasterRow()
      row.name = name
      result.push(row)
      byName.set(nameKey, row)
      added += 1
    }
  }

  return { rows: result, updated, added }
}
