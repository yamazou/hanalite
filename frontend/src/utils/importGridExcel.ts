import * as XLSX from 'xlsx'
import type { GridColumnDef } from '../components/ResizableGridTable'
import { isGridDataColumn } from './excelLikeGrid'

/** Parse first worksheet; row 1 = headers matched to column labels (export format). */
export async function parseGridExcelFile(
  file: File,
  columns: GridColumnDef[]
): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('Workbook has no sheets.')
  }
  const sheet = workbook.Sheets[sheetName]
  const table = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })
  if (table.length < 2) {
    throw new Error('No data rows found (header row required).')
  }

  const dataColumns = columns.filter((col) => isGridDataColumn(col.key))
  const labelToKey = new Map<string, string>()
  for (const col of dataColumns) {
    labelToKey.set(col.label.trim().toLowerCase(), col.key)
    labelToKey.set(col.key.trim().toLowerCase(), col.key)
  }

  const headerCells = (table[0] ?? []).map((cell) => String(cell ?? '').trim())
  const columnKeysPerIndex: (string | null)[] = headerCells.map((header) => {
    if (!header) return null
    return labelToKey.get(header.toLowerCase()) ?? null
  })

  const mappedKeys = new Set(columnKeysPerIndex.filter(Boolean) as string[])
  if (mappedKeys.size === 0) {
    throw new Error('No columns matched. Export from this grid and use the same header row.')
  }

  const rows: Record<string, string>[] = []
  for (let rowIndex = 1; rowIndex < table.length; rowIndex++) {
    const line = table[rowIndex] ?? []
    const record: Record<string, string> = {}
    let hasValue = false
    columnKeysPerIndex.forEach((key, colIndex) => {
      if (!key) return
      const raw = line[colIndex]
      const value =
        raw == null || raw === ''
          ? ''
          : typeof raw === 'number'
            ? String(raw)
            : String(raw).trim()
      if (value) hasValue = true
      record[key] = value
    })
    if (hasValue) rows.push(record)
  }

  if (rows.length === 0) {
    throw new Error('No data rows found below the header.')
  }
  return rows
}
