import type { GridColumnDef } from '../ResizableGridTable'
import { GRID_ROWNUM_COLUMN } from '../GridRowNumCell'
import { MASTER_CREATED_UPDATED_COLUMNS } from '../../utils/masterGridDates'

/** Bulk-select column (after rownum); header hosts check-all / clear-all controls. */
export const GRID_SELECT_COLUMN: GridColumnDef = {
  key: 'select',
  label: '',
  defaultWidth: 28,
  minWidth: 26,
  className: 'erp-col-check',
}

export const masterNameEditColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  GRID_SELECT_COLUMN,
  { key: 'name', label: 'Name', defaultWidth: 200 },
]

export const masterSupplierEditColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  GRID_SELECT_COLUMN,
  { key: 'code', label: 'Supplier Code', defaultWidth: 120 },
  { key: 'name', label: 'Supplier Name', defaultWidth: 200 },
  ...MASTER_CREATED_UPDATED_COLUMNS,
]

export const masterCustomerEditColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  GRID_SELECT_COLUMN,
  { key: 'code', label: 'Customer Code', defaultWidth: 120 },
  { key: 'name', label: 'Customer Name', defaultWidth: 200 },
  ...MASTER_CREATED_UPDATED_COLUMNS,
]

export const masterCompanyEditColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  GRID_SELECT_COLUMN,
  { key: 'code', label: 'Company Code', defaultWidth: 120 },
  { key: 'name', label: 'Company Name', defaultWidth: 220 },
  ...MASTER_CREATED_UPDATED_COLUMNS,
]

export const masterUserEditColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  GRID_SELECT_COLUMN,
  { key: 'company', label: 'Company Code', defaultWidth: 120 },
  { key: 'code', label: 'User ID', defaultWidth: 120 },
  { key: 'name', label: 'User Name', defaultWidth: 160 },
  { key: 'password', label: 'Password', defaultWidth: 140 },
  { key: 'active', label: 'Active', defaultWidth: 72 },
  ...MASTER_CREATED_UPDATED_COLUMNS,
]

export const masterMoveTypEditColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  GRID_SELECT_COLUMN,
  { key: 'code', label: 'Move Type Code', defaultWidth: 120 },
  { key: 'name', label: 'Move Type Name', defaultWidth: 200 },
  ...MASTER_CREATED_UPDATED_COLUMNS,
]

export const masterLocationTypEditColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  GRID_SELECT_COLUMN,
  { key: 'code', label: 'Location Type Code', defaultWidth: 120 },
  { key: 'name', label: 'Location Type Name', defaultWidth: 200 },
  ...MASTER_CREATED_UPDATED_COLUMNS,
]

export const masterLocationEditColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  GRID_SELECT_COLUMN,
  { key: 'code', label: 'Location Code', defaultWidth: 96, headerRequired: true },
  { key: 'name', label: 'Location Name', defaultWidth: 160 },
  { key: 'type', label: 'Location Type', defaultWidth: 100, headerRequired: true },
  ...MASTER_CREATED_UPDATED_COLUMNS,
]

export const masterItemColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  { key: 'code', label: 'Code', defaultWidth: 96 },
  { key: 'name', label: 'Name', defaultWidth: 160 },
  { key: 'type', label: 'Type', defaultWidth: 72 },
  { key: 'supplier', label: 'Main Supplier', defaultWidth: 120 },
  { key: 'actions', label: '', defaultWidth: 120, className: 'erp-col-actions' },
]

export const masterItemTypEditColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  GRID_SELECT_COLUMN,
  { key: 'code', label: 'Item Type Code', defaultWidth: 120 },
  { key: 'name', label: 'Item Type Name', defaultWidth: 200 },
  {
    key: 'locationtyp',
    label: 'Location Type',
    defaultWidth: 140,
    headerRequired: true,
  },
  { key: 'color', label: 'Color', defaultWidth: 120, className: 'erp-col-color' },
  ...MASTER_CREATED_UPDATED_COLUMNS,
]

export const masterItemEditColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  GRID_SELECT_COLUMN,
  { key: 'code', label: 'Item Code', defaultWidth: 96, headerRequired: true },
  { key: 'name', label: 'Item Name', defaultWidth: 160 },
  { key: 'type', label: 'Item Type', defaultWidth: 72, headerRequired: true },
  { key: 'supplier1', label: 'Supplier 1', defaultWidth: 120 },
  { key: 'supplier2', label: 'Supplier 2', defaultWidth: 120 },
  { key: 'supplier3', label: 'Supplier 3', defaultWidth: 120 },
  { key: 'customer1', label: 'Customer 1', defaultWidth: 120 },
  { key: 'customer2', label: 'Customer 2', defaultWidth: 120 },
  ...MASTER_CREATED_UPDATED_COLUMNS,
]

export const currentStockColumns: GridColumnDef[] = [
  { key: 'item_cd', label: 'Item Code', defaultWidth: 110 },
  { key: 'item_nm', label: 'Item Name', defaultWidth: 140 },
  { key: 'location', label: 'Location', defaultWidth: 140 },
  { key: 'type', label: 'Type', defaultWidth: 72 },
  { key: 'lot', label: 'Lot', defaultWidth: 100 },
  { key: 'gr_date', label: 'GR Date', defaultWidth: 100 },
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

const productionOrderDataColumns: GridColumnDef[] = [
  { key: 'production_date', label: 'Planned Date', defaultWidth: 100 },
  { key: 'reference_no', label: 'Reference No.', defaultWidth: 120 },
  { key: 'source', label: 'Source', defaultWidth: 72 },
  { key: 'status', label: 'Status', defaultWidth: 88 },
  { key: 'item_cd', label: 'Item Code', defaultWidth: 100 },
  { key: 'item_nm', label: 'Item Name', defaultWidth: 160 },
  { key: 'lot', label: 'Lot', defaultWidth: 96 },
  { key: 'planned_qty', label: 'Planned Qty', defaultWidth: 80, className: 'erp-col-num' },
  { key: 'actual_qty', label: 'Actual Qty', defaultWidth: 80, className: 'erp-col-num' },
  { key: 'lines', label: 'Steps', defaultWidth: 72, className: 'erp-col-num' },
  { key: 'created', label: 'Created', defaultWidth: 128 },
  { key: 'id', label: 'Order', defaultWidth: 70, className: 'erp-col-num' },
  { key: 'approved', label: 'Ordered at', defaultWidth: 128 },
]

export const productionOrderListColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  GRID_SELECT_COLUMN,
  ...productionOrderDataColumns,
]

/** Production List header grid (editable trailing row). */
/** Receipt List header grid (editable trailing row). */
export const receiptDraftListEditColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  GRID_SELECT_COLUMN,
  { key: 'receipt_at', label: 'Receipt Date', defaultWidth: 128, headerRequired: true },
  { key: 'reference_no', label: 'Reference No.', defaultWidth: 96 },
  { key: 'source', label: 'Source', defaultWidth: 72 },
  { key: 'status', label: 'Status', defaultWidth: 88 },
  { key: 'supplier', label: 'Supplier', defaultWidth: 120 },
  { key: 'notes', label: 'Notes', defaultWidth: 120 },
  { key: 'lines', label: 'Rows', defaultWidth: 52, className: 'erp-col-num' },
  { key: 'created', label: 'Created', defaultWidth: 128 },
  { key: 'approved', label: 'Approved at', defaultWidth: 128 },
  { key: 'cancelled', label: 'Cancelled at', defaultWidth: 128 },
  { key: 'pdf', label: 'PDF', defaultWidth: 80 },
]

export const productionOrderListEditColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  GRID_SELECT_COLUMN,
  { key: 'production_date', label: 'Planned Date', defaultWidth: 100, headerRequired: true },
  { key: 'reference_no', label: 'Reference No.', defaultWidth: 120 },
  { key: 'source', label: 'Source', defaultWidth: 72 },
  { key: 'status', label: 'Status', defaultWidth: 88 },
  { key: 'item_cd', label: 'Item Code', defaultWidth: 100, headerRequired: true },
  { key: 'item_nm', label: 'Item Name', defaultWidth: 160 },
  { key: 'lot', label: 'Lot', defaultWidth: 96 },
  { key: 'planned_qty', label: 'Planned Qty', defaultWidth: 80, className: 'erp-col-num', headerRequired: true },
  { key: 'actual_qty', label: 'Actual Qty', defaultWidth: 80, className: 'erp-col-num' },
  { key: 'lines', label: 'Steps', defaultWidth: 72, className: 'erp-col-num' },
  { key: 'created', label: 'Created', defaultWidth: 128 },
  { key: 'id', label: 'Order', defaultWidth: 70, className: 'erp-col-num' },
  { key: 'approved', label: 'Ordered at', defaultWidth: 128 },
]

export const productionLineColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  { key: 'process', label: 'Location Code', defaultWidth: 100, headerRequired: true },
  { key: 'process_nm', label: 'Location Name', defaultWidth: 160 },
  { key: 'actions', label: '', defaultWidth: 44, className: 'erp-col-actions erp-col-row-move' },
]

export const itemProcessProcessEditColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  GRID_SELECT_COLUMN,
  { key: 'process', label: 'Location Code', defaultWidth: 120, headerRequired: true },
  { key: 'process_nm', label: 'Location Name', defaultWidth: 160 },
  { key: 'actions', label: '', defaultWidth: 44, className: 'erp-col-actions erp-col-row-move' },
]

export const itemProcessInputEditColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  GRID_SELECT_COLUMN,
  { key: 'item_cd', label: 'Item Code', defaultWidth: 110 },
  { key: 'item_nm', label: 'Item Name', defaultWidth: 160 },
  { key: 'req_qty', label: 'Req Qty', defaultWidth: 96, className: 'erp-col-num' },
]

export const itemProcessFinalItemColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  GRID_SELECT_COLUMN,
  { key: 'item_cd', label: 'Item Code', defaultWidth: 110, headerRequired: true },
  { key: 'item_nm', label: 'Item Name', defaultWidth: 160 },
  { key: 'final_item_cd', label: 'FG Item', defaultWidth: 110 },
  { key: 'itemtyp_cd', label: 'Item Type Code', defaultWidth: 100 },
  { key: 'customer_cd', label: 'Customer Code', defaultWidth: 110 },
  ...MASTER_CREATED_UPDATED_COLUMNS,
]

export const productionInputColumns: GridColumnDef[] = [
  GRID_ROWNUM_COLUMN,
  { key: 'item_cd', label: 'Item Code', defaultWidth: 100, headerRequired: true },
  { key: 'item_nm', label: 'Item Name', defaultWidth: 160 },
  { key: 'from_location', label: 'From Location', defaultWidth: 100 },
  { key: 'req_qty', label: 'Planned Input Qty', defaultWidth: 96, className: 'erp-col-num', headerRequired: true },
  { key: 'consume_qty', label: 'Actual Input Qty', defaultWidth: 104, className: 'erp-col-num' },
  { key: 'lot', label: 'Lot', defaultWidth: 96 },
]

export const productionOutputColumns: GridColumnDef[] = [
  { key: 'line_no', label: 'No', defaultWidth: 40, className: 'erp-col-num' },
  { key: 'item', label: 'WIP Item', defaultWidth: 180 },
  { key: 'qty', label: 'Output Qty', defaultWidth: 88, className: 'erp-col-num' },
  { key: 'location', label: 'Location', defaultWidth: 120 },
  { key: 'lot', label: 'Lot', defaultWidth: 96 },
]

