import { api } from '../api/client'
type DraftKind = 'receipt' | 'delivery'
import type { ItemSearchRow } from '../types/masters'
import type { LocationMaster } from '../types/masters'
import { formatItemLabel } from './format'

export type SuggestOption = {
  label: string
  value: string
}

export const MAX_SUGGESTIONS = 15

export function matchTokens(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const tokens = q.split(/[\s\-—/]+/).filter(Boolean)
  const text = haystack.toLowerCase()
  return tokens.every((token) => text.includes(token))
}

export function formatLocationLabel(loc: { location_cd: string; location_nm: string }): string {
  return `${loc.location_cd} / ${loc.location_nm}`
}

let itemCatalogPromise: Promise<ItemSearchRow[]> | null = null
let locationCatalogPromise: Promise<LocationMaster[]> | null = null
let supplierCatalogPromise: Promise<Array<{ suppliers_id: number; suppliers_nm: string }>> | null = null

async function getItemCatalog(): Promise<ItemSearchRow[]> {
  if (!itemCatalogPromise) {
    itemCatalogPromise = api.listItemsMaster().then((rows) =>
      rows.map((row) => ({
        item_id: row.item_id,
        item_cd: row.item_cd,
        item_nm: row.item_nm,
        itemtyp_id: row.itemtyp_id,
        itemtyp_nm: row.itemtyp_nm,
      }))
    )
  }
  return itemCatalogPromise
}

async function getLocationCatalog(): Promise<LocationMaster[]> {
  if (!locationCatalogPromise) {
    locationCatalogPromise = api.listLocationsMaster()
  }
  return locationCatalogPromise
}

async function getSupplierCatalog(): Promise<Array<{ suppliers_id: number; suppliers_nm: string }>> {
  if (!supplierCatalogPromise) {
    supplierCatalogPromise = api.listSuppliersMaster()
  }
  return supplierCatalogPromise
}

function toOptions(labels: string[]): SuggestOption[] {
  return labels.map((label) => ({ label, value: label }))
}

export async function suggestItemCodes(query: string, limit = MAX_SUGGESTIONS): Promise<SuggestOption[]> {
  const term = query.trim()
  const rows = term ? await api.searchItems(term, limit) : (await getItemCatalog()).slice(0, limit)
  const seen = new Set<string>()
  const options: SuggestOption[] = []
  for (const row of rows) {
    const cd = row.item_cd?.trim()
    if (!cd || seen.has(cd)) continue
    seen.add(cd)
    options.push({ label: cd, value: cd })
  }
  return options
}

export async function suggestItemNames(query: string, limit = MAX_SUGGESTIONS): Promise<SuggestOption[]> {
  const term = query.trim()
  const rows = term ? await api.searchItems(term, limit) : (await getItemCatalog()).slice(0, limit)
  const seen = new Set<string>()
  const options: SuggestOption[] = []
  for (const row of rows) {
    const nm = row.item_nm?.trim()
    if (!nm || seen.has(nm)) continue
    seen.add(nm)
    options.push({ label: nm, value: nm })
  }
  return options
}

export async function suggestItems(query: string, limit = MAX_SUGGESTIONS): Promise<SuggestOption[]> {
  const term = query.trim()
  if (term) {
    const rows = await api.searchItems(term, limit)
    return rows.map((row) => ({
      label: formatItemLabel(row),
      value: formatItemLabel(row),
    }))
  }
  const catalog = await getItemCatalog()
  return catalog.slice(0, limit).map((row) => ({
    label: formatItemLabel(row),
    value: formatItemLabel(row),
  }))
}

export async function findItemByLabel(label: string): Promise<ItemSearchRow | null> {
  const term = label.trim()
  if (!term) return null
  const catalog = await getItemCatalog()
  const exact = catalog.find((row) => formatItemLabel(row) === term)
  if (exact) return exact
  const rows = await api.searchItems(term, 5)
  return rows.find((row) => formatItemLabel(row) === term) ?? rows[0] ?? null
}

export async function suggestLocations(query: string, limit = MAX_SUGGESTIONS): Promise<SuggestOption[]> {
  const catalog = await getLocationCatalog()
  return catalog
    .filter((loc) =>
      matchTokens(`${loc.location_cd} ${loc.location_nm} ${formatLocationLabel(loc)}`, query)
    )
    .slice(0, limit)
    .map((loc) => ({
      label: formatLocationLabel(loc),
      value: formatLocationLabel(loc),
    }))
}

export function resolveLocationId(
  text: string,
  locations: LocationMaster[]
): number | undefined {
  const term = text.trim()
  if (!term) return undefined
  const exact = locations.find((loc) => formatLocationLabel(loc) === term)
  if (exact) return exact.location_id
  const partial = locations.filter((loc) =>
    matchTokens(`${loc.location_cd} ${loc.location_nm}`, term)
  )
  return partial.length === 1 ? partial[0].location_id : undefined
}

export async function resolveLocationIdFromText(text: string): Promise<number | undefined> {
  const catalog = await getLocationCatalog()
  return resolveLocationId(text, catalog)
}

export async function suggestSuppliers(query: string, limit = MAX_SUGGESTIONS): Promise<SuggestOption[]> {
  const catalog = await getSupplierCatalog()
  return catalog
    .filter((s) => matchTokens(s.suppliers_nm, query))
    .slice(0, limit)
    .map((s) => ({ label: s.suppliers_nm, value: s.suppliers_nm }))
}

export async function suggestCurrentLots(query: string, limit = MAX_SUGGESTIONS): Promise<SuggestOption[]> {
  const lots = await api.suggestCurrentStockLots(query, limit)
  return toOptions(lots)
}

export async function suggestProductionLots(query: string, limit = MAX_SUGGESTIONS): Promise<SuggestOption[]> {
  const rows = await api.suggestProductionLots(query, limit)
  return rows.map((lot) => ({ label: lot, value: lot }))
}

export async function suggestDraftLots(
  query: string,
  kind: DraftKind,
  limit = MAX_SUGGESTIONS
): Promise<SuggestOption[]> {
  const lots = await api.suggestDraftLots(query, kind, limit)
  return toOptions(lots)
}
