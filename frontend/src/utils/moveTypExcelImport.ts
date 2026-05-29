import { emptyEditMoveTypRow, type EditMoveTypRow } from './moveTypMasterEdit'

/** Merge Excel rows into move-type grid: match by Move Type Code, else append. */
export function mergeMoveTypImportRows(
  parsed: Record<string, string>[],
  existing: EditMoveTypRow[]
): { rows: EditMoveTypRow[]; updated: number; added: number } {
  const byCode = new Map<string, EditMoveTypRow>()
  for (const row of existing) {
    const code = row.movetyps_cd.trim().toLowerCase()
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
          movetyps_cd: code || match.movetyps_cd,
          movetyps_nm: name || match.movetyps_nm,
        }
        updated += 1
      }
    } else if (code) {
      const row = emptyEditMoveTypRow()
      row.movetyps_cd = code
      row.movetyps_nm = name
      result.push(row)
      byCode.set(codeKey, row)
      added += 1
    }
  }

  return { rows: result, updated, added }
}
