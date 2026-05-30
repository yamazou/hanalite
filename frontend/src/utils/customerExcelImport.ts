import { emptyEditCustomerRow, type EditCustomerRow } from './customerMasterEdit'

/** Merge Excel rows into customer grid: match by Customer Code, else append. */
export function mergeCustomerImportRows(
  parsed: Record<string, string>[],
  existing: EditCustomerRow[]
): { rows: EditCustomerRow[]; updated: number; added: number } {
  const byCode = new Map<string, EditCustomerRow>()
  for (const row of existing) {
    const code = row.customers_cd.trim().toLowerCase()
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
          customers_cd: code || match.customers_cd,
          customers_nm: name || match.customers_nm,
        }
        updated += 1
      }
    } else if (code) {
      const row = emptyEditCustomerRow()
      row.customers_cd = code
      row.customers_nm = name
      result.push(row)
      byCode.set(codeKey, row)
      added += 1
    }
  }

  return { rows: result, updated, added }
}
