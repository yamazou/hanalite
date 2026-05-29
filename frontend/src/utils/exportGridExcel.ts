import type { GridColumnDef } from '../components/ResizableGridTable'
import { isGridDataColumn } from './excelLikeGrid'
import { downloadExcelSheet, exportFilename } from './exportExcel'

export function exportGridToExcel<T>(
  sheetName: string,
  orderedColumns: GridColumnDef[],
  rows: T[],
  getExportValue: (row: T, columnKey: string) => string | number,
  filenamePrefix: string
) {
  const dataColumns = orderedColumns.filter((col) => isGridDataColumn(col.key))
  const headers = dataColumns.map((col) => col.label)
  const body = rows.map((row) => dataColumns.map((col) => getExportValue(row, col.key)))
  downloadExcelSheet(sheetName, headers, body, exportFilename(filenamePrefix))
}
