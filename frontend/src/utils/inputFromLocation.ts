import type { ItemTyp, LocationMaster } from '../types/masters'

type ProcessRowLike = { line_no: number; wip_location_id: number | '' }

/** First active location for an item type's linked location type (matches backend order). */
export function locationIdForItemtypIssue(
  itemId: number | '',
  items: { item_id: number; itemtyp_id?: number }[],
  itemtyps: ItemTyp[],
  locations: LocationMaster[]
): number | '' {
  if (itemId === '') return ''
  const item = items.find((row) => row.item_id === Number(itemId))
  if (!item?.itemtyp_id) return ''
  const typ = itemtyps.find((row) => row.itemtyp_id === item.itemtyp_id)
  if (!typ?.locationtyp_id) return ''
  const matches = locations
    .filter((loc) => loc.locationtyp_id === typ.locationtyp_id)
    .sort((a, b) => a.location_id - b.location_id)
  return matches[0]?.location_id ?? ''
}

export function locationCdForItemtypIssue(
  itemId: number | '',
  items: { item_id: number; itemtyp_id?: number }[],
  itemtyps: ItemTyp[],
  locations: LocationMaster[]
): string {
  const locId = locationIdForItemtypIssue(itemId, items, itemtyps, locations)
  if (locId === '') return ''
  return locations.find((loc) => loc.location_id === locId)?.location_cd ?? ''
}

/**
 * Input issue location: first process step uses item type warehouse;
 * later steps use previous process WIP (unchanged).
 */
export function resolveInputFromLocationIdForStep(
  lineNo: number,
  inputItemId: number | '',
  processRows: ProcessRowLike[],
  locations: LocationMaster[],
  items: { item_id: number; itemtyp_id?: number }[],
  itemtyps: ItemTyp[],
  isBlankProcess: (row: ProcessRowLike) => boolean
): number | '' {
  const activeProcesses = processRows
    .filter((row) => !isBlankProcess(row))
    .sort((a, b) => a.line_no - b.line_no)
  const idx = activeProcesses.findIndex((p) => p.line_no === lineNo)
  if (idx > 0) {
    const prev = activeProcesses[idx - 1]
    return prev.wip_location_id !== '' ? prev.wip_location_id : ''
  }
  return locationIdForItemtypIssue(inputItemId, items, itemtyps, locations)
}

/** Process rows for step-index resolution from saved item-process API data. */
export function processRowsFromSavedItemProcesses(
  processes: Array<{ line_no: number; wip_location_id: number }>
): ProcessRowLike[] {
  return processes.map((proc) => ({
    line_no: proc.line_no,
    wip_location_id: proc.wip_location_id,
  }))
}

export function isBlankProcessRowLike(row: ProcessRowLike): boolean {
  return row.wip_location_id === ''
}

export function resolveInputFromLocationCdForStep(
  lineNo: number,
  inputItemId: number | '',
  processRows: ProcessRowLike[],
  locations: LocationMaster[],
  items: { item_id: number; itemtyp_id?: number }[],
  itemtyps: ItemTyp[],
  isBlankProcess: (row: ProcessRowLike) => boolean
): string {
  const locId = resolveInputFromLocationIdForStep(
    lineNo,
    inputItemId,
    processRows,
    locations,
    items,
    itemtyps,
    isBlankProcess
  )
  if (locId === '') return ''
  return locations.find((loc) => loc.location_id === locId)?.location_cd ?? ''
}
