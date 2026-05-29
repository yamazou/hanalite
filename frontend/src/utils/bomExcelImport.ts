import type { LocationMaster } from '../types/masters'
import { emptyEditBomRow, type EditBomRow } from './bomMasterEdit'

function resolveLocationId(
  label: string | undefined,
  locations: LocationMaster[]
): number | '' {
  const raw = (label ?? '').trim()
  if (!raw) return ''
  const lower = raw.toLowerCase()
  const match = locations.find(
    (l) =>
      l.location_cd.trim().toLowerCase() === lower ||
      l.location_nm.trim().toLowerCase() === lower
  )
  return match?.location_id ?? ''
}

export function mergeBomImportRows(
  parsed: Record<string, string>[],
  existing: EditBomRow[],
  locations: LocationMaster[]
): { rows: EditBomRow[]; updated: number; added: number } {
  const result = [...existing]
  let updated = 0
  let added = 0

  for (const cells of parsed) {
    const pCd = (cells.parent_cd ?? cells.parent ?? '').trim()
    const cCd = (cells.child_cd ?? cells.child ?? '').trim()
    if (!pCd && !cCd) continue

    const row = emptyEditBomRow()
    row.p_item_cd = pCd
    row.c_item_cd = cCd
    row.level = (cells.level ?? '0').trim() || '0'
    row.c_req_qty = (cells.qty ?? '').trim()
    row.to_location_id = resolveLocationId(cells.to_location, locations)
    row.from_location_id = resolveLocationId(cells.from_location, locations)
    result.push(row)
    added += 1
  }

  return { rows: result, updated, added }
}
