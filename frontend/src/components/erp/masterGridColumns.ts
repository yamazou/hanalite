import type { GridColumnDef } from '../ResizableGridTable'

export const masterIdNameColumns: GridColumnDef[] = [
  { key: 'id', label: 'ID', defaultWidth: 52, className: 'erp-col-num' },
  { key: 'name', label: 'Name', defaultWidth: 160 },
  { key: 'created', label: 'Created', defaultWidth: 128 },
  { key: 'actions', label: '', defaultWidth: 80, className: 'erp-col-actions' },
]

export const masterLocationColumns: GridColumnDef[] = [
  { key: 'id', label: 'ID', defaultWidth: 52, className: 'erp-col-num' },
  { key: 'code', label: 'Code', defaultWidth: 96 },
  { key: 'name', label: 'Name', defaultWidth: 160 },
  { key: 'actions', label: '', defaultWidth: 80, className: 'erp-col-actions' },
]

export const masterItemColumns: GridColumnDef[] = [
  { key: 'id', label: 'ID', defaultWidth: 52, className: 'erp-col-num' },
  { key: 'code', label: 'Code', defaultWidth: 96 },
  { key: 'name', label: 'Name', defaultWidth: 160 },
  { key: 'type', label: 'Type', defaultWidth: 72 },
  { key: 'supplier', label: 'Main Supplier', defaultWidth: 120 },
  { key: 'actions', label: '', defaultWidth: 120, className: 'erp-col-actions' },
]

export const masterBomColumns: GridColumnDef[] = [
  { key: 'parent', label: 'Parent', defaultWidth: 160 },
  { key: 'child', label: 'Child', defaultWidth: 160 },
  { key: 'qty', label: 'Req Qty', defaultWidth: 80, className: 'erp-col-num' },
  { key: 'actions', label: '', defaultWidth: 120, className: 'erp-col-actions' },
]

export const currentStockColumns: GridColumnDef[] = [
  { key: 'item', label: 'Item', defaultWidth: 140 },
  { key: 'location', label: 'Location', defaultWidth: 140 },
  { key: 'type', label: 'Type', defaultWidth: 72 },
  { key: 'lot', label: 'Lot', defaultWidth: 100 },
  { key: 'qty', label: 'Qty', defaultWidth: 72, className: 'erp-col-num' },
  { key: 'updated', label: 'Updated', defaultWidth: 128 },
  { key: 'actions', label: '', defaultWidth: 64, className: 'erp-col-actions' },
]

export const balanceColumns: GridColumnDef[] = [
  { key: 'period', label: 'Period', defaultWidth: 72 },
  { key: 'item', label: 'Item', defaultWidth: 140 },
  { key: 'location', label: 'Location', defaultWidth: 140 },
  { key: 'lot', label: 'Lot', defaultWidth: 100 },
  { key: 'beg_qty', label: 'Opening Qty', defaultWidth: 88, className: 'erp-col-num' },
  { key: 'qty', label: 'Closing Qty', defaultWidth: 88, className: 'erp-col-num' },
  { key: 'beg_at', label: 'Opening Date/Time', defaultWidth: 128 },
]

export const grgiHistoryColumns: GridColumnDef[] = [
  { key: 'id', label: 'ID', defaultWidth: 52, className: 'erp-col-num' },
  { key: 'item', label: 'Item', defaultWidth: 140 },
  { key: 'location', label: 'Location', defaultWidth: 120 },
  { key: 'lot', label: 'Lot', defaultWidth: 100 },
  { key: 'type', label: 'Type', defaultWidth: 56 },
  { key: 'move_qty', label: 'Move Qty', defaultWidth: 80, className: 'erp-col-num' },
  { key: 'qty', label: 'Balance Qty', defaultWidth: 88, className: 'erp-col-num' },
  { key: 'actual_at', label: 'Actual Date/Time', defaultWidth: 128 },
]

export const traceCurrentColumns: GridColumnDef[] = [
  { key: 'item', label: 'Item', defaultWidth: 140 },
  { key: 'location', label: 'Location', defaultWidth: 140 },
  { key: 'type', label: 'Type', defaultWidth: 72 },
  { key: 'qty', label: 'Qty', defaultWidth: 72, className: 'erp-col-num' },
  { key: 'updated', label: 'Updated', defaultWidth: 128 },
]

export const traceHistoryColumns: GridColumnDef[] = [
  { key: 'id', label: 'ID', defaultWidth: 52, className: 'erp-col-num' },
  { key: 'item', label: 'Item', defaultWidth: 140 },
  { key: 'location', label: 'Location', defaultWidth: 120 },
  { key: 'type', label: 'Type', defaultWidth: 56 },
  { key: 'move_qty', label: 'Move Qty', defaultWidth: 80, className: 'erp-col-num' },
  { key: 'qty', label: 'Balance Qty', defaultWidth: 88, className: 'erp-col-num' },
  { key: 'actual_at', label: 'Actual Date/Time', defaultWidth: 128 },
]

export const traceBalanceColumns: GridColumnDef[] = [
  { key: 'period', label: 'Period', defaultWidth: 72 },
  { key: 'item', label: 'Item', defaultWidth: 140 },
  { key: 'location', label: 'Location', defaultWidth: 140 },
  { key: 'beg_qty', label: 'Opening Qty', defaultWidth: 88, className: 'erp-col-num' },
  { key: 'qty', label: 'Closing Qty', defaultWidth: 88, className: 'erp-col-num' },
  { key: 'beg_at', label: 'Opening Date/Time', defaultWidth: 128 },
]
