import type { Item } from '../types'
import type { LocationMaster } from '../types/masters'
import { emptyEditLine, findItemByCd, findItemByNm, type EditLineRow } from './draftEdit'

function resolveLocation(
  locationText: string | undefined,
  locations: LocationMaster[]
): Pick<EditLineRow, 'location_id'> {
  const raw = (locationText ?? '').trim()
  if (!raw || raw === '-') return { location_id: '' }
  const codePart = raw.split(/\s+/)[0]?.trim() ?? raw
  const lowerCode = codePart.toLowerCase()
  const byCode = locations.find((l) => l.location_cd.toLowerCase() === lowerCode)
  if (byCode) return { location_id: byCode.location_id }
  const lowerFull = raw.toLowerCase()
  const byLabel = locations.find(
    (l) => `${l.location_cd} ${l.location_nm}`.trim().toLowerCase() === lowerFull
  )
  if (byLabel) return { location_id: byLabel.location_id }
  return { location_id: '' }
}

/** Append imported draft lines (does not remove existing rows). */
export function mergeDraftLineImportRows(
  parsed: Record<string, string>[],
  existing: EditLineRow[],
  items: Item[],
  locations: LocationMaster[]
): { rows: EditLineRow[]; added: number } {
  const next = [...existing]
  let lineNo =
    existing.length > 0 ? Math.max(...existing.map((r) => r.line_no), 0) : 0
  let added = 0

  for (const cells of parsed) {
    const itemCd = (cells.item_cd ?? '').trim()
    const itemNm = (cells.item_nm ?? '').trim()
    const lot = (cells.lot ?? '').trim()
    const qtyRaw = (cells.qty ?? '').trim().replace(/,/g, '')
    if (!itemCd && !itemNm && !lot && !qtyRaw) continue

    lineNo += 1
    const row = emptyEditLine(lineNo)
    const byCd = itemCd ? findItemByCd(items, itemCd) : undefined
    const byNm = !byCd && itemNm ? findItemByNm(items, itemNm) : undefined
    const item = byCd ?? byNm
    if (item) {
      row.item_id = item.item_id
      row.itemtyp_id = item.itemtyp_id
      row.item_cd = item.item_cd
      row.item_nm = item.item_nm
    } else {
      row.item_cd = itemCd
      row.item_nm = itemNm
    }
    row.lot = lot
    row.qty = qtyRaw
    Object.assign(row, resolveLocation(cells.location, locations))
    next.push(row)
    added += 1
  }

  return { rows: next, added }
}
