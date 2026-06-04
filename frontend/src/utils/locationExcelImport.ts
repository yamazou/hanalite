import type { LocationTyp } from '../types/masters'
import { emptyEditLocationRow, type EditLocationRow } from './locationMasterEdit'
import { resolveLocationtypId } from './locationTypMasterEdit'

/** Merge Excel rows into location grid: match by Location Code, else append. */
export function mergeLocationImportRows(
  parsed: Record<string, string>[],
  existing: EditLocationRow[],
  locationtyps: LocationTyp[]
): { rows: EditLocationRow[]; updated: number; added: number } {
  const byCode = new Map<string, EditLocationRow>()
  for (const row of existing) {
    const code = row.location_cd.trim().toLowerCase()
    if (code) byCode.set(code, row)
  }

  const result = [...existing]
  let updated = 0
  let added = 0

  for (const cells of parsed) {
    const code = (cells.code ?? '').trim()
    const name = (cells.name ?? '').trim()
    const locationtyp_id = resolveLocationtypId(cells.type, locationtyps)
    if (!code && !name && locationtyp_id === '') continue

    const codeKey = code.toLowerCase()
    const match = code ? byCode.get(codeKey) : undefined
    if (match) {
      const index = result.findIndex((r) => r.key === match.key)
      if (index >= 0) {
        result[index] = {
          ...match,
          location_cd: code || match.location_cd,
          location_nm: name || match.location_nm,
          locationtyp_id: locationtyp_id !== '' ? locationtyp_id : match.locationtyp_id,
        }
        updated += 1
      }
    } else if (code) {
      const row = emptyEditLocationRow()
      row.location_cd = code
      row.location_nm = name
      row.locationtyp_id = locationtyp_id
      result.push(row)
      byCode.set(codeKey, row)
      added += 1
    }
  }

  return { rows: result, updated, added }
}
