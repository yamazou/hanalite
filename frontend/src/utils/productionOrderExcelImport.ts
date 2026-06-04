import type { Item } from '../types'
import type {
  ProductionExcelImportPreviewRow,
  ProductionExcelImportResult,
} from '../types/production'
import { parseDateInputValue, toDateInputValue } from './format'
import {
  emptyEditProductionOrderHeaderRow,
  isBlankProductionOrderHeaderRow,
  type EditProductionOrderHeaderRow,
} from './productionOrderListEdit'

export type MergeProductionOrderImportResult = {
  registeredEdits: Map<number, EditProductionOrderHeaderRow>
  headerNewRows: EditProductionOrderHeaderRow[]
  insertedCount: number
  updatedCount: number
}

function previewRowToEditRow(
  row: ProductionExcelImportPreviewRow,
  action: 'insert' | 'update'
): EditProductionOrderHeaderRow {
  const isUpdate = action === 'update' && row.production_order_id != null
  return {
    key: isUpdate ? `order-${row.production_order_id}` : `import-new-${row.excel_row}`,
    production_order_id: isUpdate ? row.production_order_id : undefined,
    production_date: parseDateInputValue(String(row.production_date)),
    reference_no: row.reference_no?.trim() === '*' ? '' : (row.reference_no ?? '').trim(),
    parent_item_id: row.parent_item_id,
    parent_item_cd: row.parent_item_cd,
    parent_item_nm: row.parent_item_nm,
    planned_qty: String(row.planned_qty),
    lot: row.lot?.trim() === '*' ? '' : (row.lot ?? '').trim(),
    pendingExcelImport: !isUpdate,
  }
}

/** Merge Excel preview rows into header grid state (no API save). */
export function mergeProductionOrderImportPreview(
  preview: ProductionExcelImportResult,
  registeredEdits: Map<number, EditProductionOrderHeaderRow>,
  headerNewRows: EditProductionOrderHeaderRow[],
  _masterItems: Item[]
): MergeProductionOrderImportResult {
  let insertedCount = 0
  let updatedCount = 0
  const nextRegistered = new Map(registeredEdits)
  const dataNewRows = headerNewRows.filter(
    (row, index) =>
      !(index === headerNewRows.length - 1 && isBlankProductionOrderHeaderRow(row))
  )
  const trailing =
    headerNewRows.length > 0 &&
    isBlankProductionOrderHeaderRow(headerNewRows[headerNewRows.length - 1])
      ? headerNewRows[headerNewRows.length - 1]
      : emptyEditProductionOrderHeaderRow()

  const newFromImport: EditProductionOrderHeaderRow[] = []

  for (const row of preview.rows) {
    if (row.action === 'update' && row.production_order_id != null) {
      const edit = previewRowToEditRow(row, 'update')
      nextRegistered.set(row.production_order_id, edit)
      updatedCount += 1
    } else {
      newFromImport.push(previewRowToEditRow(row, 'insert'))
      insertedCount += 1
    }
  }

  const nextNewRows = [...dataNewRows, ...newFromImport, trailing]

  return {
    registeredEdits: nextRegistered,
    headerNewRows: nextNewRows,
    insertedCount,
    updatedCount,
  }
}
