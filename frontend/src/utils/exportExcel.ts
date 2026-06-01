import * as XLSX from 'xlsx'
import XLSXStyle from 'xlsx-js-style'

const RED_FONT = { color: { rgb: 'FF0000' } }

export function downloadExcelSheet(
  sheetName: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  const data = [headers, ...rows]
  const worksheet = XLSX.utils.aoa_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31))
  const safeName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  XLSX.writeFile(workbook, safeName)
}

/** Header + data cells at the given column indices use red font. */
export function downloadExcelSheetWithRedColumns(
  sheetName: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  redColumnIndices: number[]
) {
  const redColumns = new Set(redColumnIndices)
  const data = [headers, ...rows]
  const worksheet = XLSX.utils.aoa_to_sheet(data)
  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
      if (!redColumns.has(colIndex)) continue
      const ref = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })
      const cell = worksheet[ref]
      if (!cell) continue
      cell.s = { font: RED_FONT }
    }
  }
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31))
  const safeName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  XLSXStyle.writeFile(workbook, safeName)
}

export function exportFilename(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return `${prefix}_${stamp}.xlsx`
}
