import * as XLSX from 'xlsx'

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

export function exportFilename(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return `${prefix}_${stamp}.xlsx`
}
