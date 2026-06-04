import { emptyEditLocationTypRow, type EditLocationTypRow } from './locationTypMasterEdit'

/** Merge Excel rows into location-type grid: match by Location Type Code, else append. */
export function mergeLocationTypImportRows(
  parsed: Record<string, string>[],
  existing: EditLocationTypRow[]
): { rows: EditLocationTypRow[]; updated: number; added: number } {
  const byCode = new Map<string, EditLocationTypRow>()
  for (const row of existing) {
    const code = row.locationtyp_cd.trim().toLowerCase()
    if (code) byCode.set(code, row)
  }

  const result = [...existing]
  let updated = 0
  let added = 0

  for (const cells of parsed) {
    const code = (cells.code ?? '').trim()
    const name = (cells.name ?? '').trim()
    if (!code && !name) continue

    const codeKey = code.toLowerCase()
    const match = code ? byCode.get(codeKey) : undefined
    if (match) {
      const index = result.findIndex((r) => r.key === match.key)
      if (index >= 0) {
        result[index] = {
          ...match,
          locationtyp_cd: code || match.locationtyp_cd,
          locationtyp_nm: name || match.locationtyp_nm,
        }
        updated += 1
      }
    } else if (code) {
      const row = emptyEditLocationTypRow()
      row.locationtyp_cd = code
      row.locationtyp_nm = name
      result.push(row)
      byCode.set(codeKey, row)
      added += 1
    }
  }

  return { rows: result, updated, added }
}
