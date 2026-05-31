/** Blank placeholder on trailing grid rows; labels only on filled rows. */
export function gridCellPlaceholder(text: string, isBlankRow: boolean): string {
  return isBlankRow ? '' : text
}

/** Item Code/Name datalist: only while the row has no resolved item_id. */
export function showItemMasterDatalist(itemId: number | '' | null | undefined): boolean {
  return itemId == null || itemId === ''
}

/** Location Code datalist: only while the row has no resolved location_id. */
export function showLocationMasterDatalist(locationId: number | '' | null | undefined): boolean {
  return locationId == null || locationId === ''
}

/** Location Code combobox: empty → all; otherwise substring match (case-insensitive). */
export function filterLocationsForCdDatalist<T extends { location_cd: string }>(
  locations: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return locations
  return locations.filter((loc) => loc.location_cd.toLowerCase().includes(q))
}

/** Location Name combobox: empty → all; otherwise substring match (case-insensitive). */
export function filterLocationsForNmDatalist<T extends { location_nm: string }>(
  locations: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return locations
  return locations.filter((loc) => (loc.location_nm ?? '').toLowerCase().includes(q))
}

export function gridItemDatalistListId(
  itemId: number | '' | null | undefined,
  listId: string
): string | undefined {
  return showItemMasterDatalist(itemId) ? listId : undefined
}

/** Item Code combobox: empty → all; otherwise substring match (case-insensitive). */
export function filterItemsForItemCdDatalist<T extends { item_cd: string }>(
  items: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => item.item_cd.toLowerCase().includes(q))
}

/** Item Name combobox: empty → all; otherwise substring match (case-insensitive). */
export function filterItemsForItemNmDatalist<T extends { item_nm: string }>(
  items: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => (item.item_nm ?? '').toLowerCase().includes(q))
}

/** Search filter: match item code or name (case-insensitive substring). */
export function filterItemsForItemAnyDatalist<
  T extends { item_cd: string; item_nm: string },
>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter(
    (item) =>
      item.item_cd.toLowerCase().includes(q) ||
      (item.item_nm ?? '').toLowerCase().includes(q)
  )
}
