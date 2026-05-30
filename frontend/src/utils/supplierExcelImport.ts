import { emptyEditSupplierRow, type EditSupplierRow } from './supplierMasterEdit'

/** Merge Excel rows into supplier grid: match by Supplier Code, else append. */
export function mergeSupplierImportRows(
  parsed: Record<string, string>[],
  existing: EditSupplierRow[]
): { rows: EditSupplierRow[]; updated: number; added: number } {
  const byCode = new Map<string, EditSupplierRow>()
  for (const row of existing) {
    const code = row.suppliers_cd.trim().toLowerCase()
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
          suppliers_cd: code || match.suppliers_cd,
          suppliers_nm: name || match.suppliers_nm,
        }
        updated += 1
      }
    } else if (code) {
      const row = emptyEditSupplierRow()
      row.suppliers_cd = code
      row.suppliers_nm = name
      result.push(row)
      byCode.set(codeKey, row)
      added += 1
    }
  }

  return { rows: result, updated, added }
}
