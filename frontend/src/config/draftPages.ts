export type DraftVariant = 'receipt' | 'delivery'

export type DraftPageCopy = {
  listPath: string
  newPath: string
  importPath: string
  pdfImportPath?: string
  detailPath: (id: number) => string
  listTitle: string
  listDesc: string
  newBtn: string
  excelBtn: string
  pdfBtn?: string
  detailLink: string
  detailPanelHint: string
  listPathWithId: (id: number) => string
  documentTitle: string
  entryNewTitle: string
  entryEditTitle: (id: number) => string
  entryReadOnlyMsg: string
  saveSuccessMsg: string
  detailSaveBtn: string
  /** Receipt List: save lines only (header edited on Entry). */
  detailSaveLinesBtn: string
  listLinesEditHint: string
  searchPanelTitle: string
  headerGridTitle: string
  dateColumn: string
  createTitle: string
  createDesc: string
  backToList: string
  dateTimeLabel: string
  referenceLabel: string
  referencePlaceholder: string
  supplierLabel: string
  notesLabel: string
  linesTitle: string
  itemLabel: string
  itemCdLabel: string
  itemNmLabel: string
  locationLabel: string
  lotLabel: string
  lotPlaceholder: string
  qtyLabel: string
  addLineBtn: string
  addRowBtn: string
  deleteRowBtn: string
  checkAllRowsTitle: string
  uncheckAllRowsTitle: string
  saveRowBtn: string
  removeRowBtn: string
  removeLineBtn: string
  submitCreate: string
  submittingCreate: string
  cancelBtn: string
  excelTitle: string
  excelDesc: string
  templateBtn: string
  excelFormatTitle: string
  uploadTitle: string
  excelFileLabel: string
  submitImport: string
  submittingImport: string
  detailTitle: (id: number) => string
  approveConfirm: string
  cancelApprovedConfirm: string
  cancelDraftConfirm: string
  approveBtn: string
  cancelActionBtn: string
  approvedMsg: string
  cancelledMsg: string
  revertedToRegisteredMsg: string
  parseMsgLabel: string
  attachmentTitle?: string
  openPdfBtn?: string
  headerTitle: string
  linesReviewTitle: string
  noLinesMsg: string
  nextStepHint: string
  approveFail: string
  cancelFail: string
  restoreBtn: string
  restoreConfirm: string
  restoredMsg: string
  restoreFail: string
  deleteBtn: string
  deleteConfirm: string
  deletedMsg: string
  deleteFail: string
  loadFail: string
  masterLoadFail: string
  createFail: string
  importFail: string
  selectExcel: string
  lineValidation: string
  showPdfImport: boolean
  filterAll: string
  filterPending: string
  filterApproved: string
  filterCancelled: string
  filterDateFrom: string
  filterDateTo: string
  filterDateFromPh: string
  filterDateToPh: string
  filterReferencePh: string
  filterLotPh: string
  filterApply: string
  filterClear: string
  filterDateRangeError: string
  exportExcelLabel: string
  exportHeaderSheet: string
  exportLinesSheet: string
  refreshBtn: string
  saveGridBtn: string
  saveGridSuccessMsg: string
  loadingText: string
  noDataText: string
  sourceCol: string
  statusCol: string
  referenceCol: string
  supplierCol: string
  linesCol: string
  createdCol: string
  idCol: string
  noneOption: string
  selectOption: string
  loadingMasterText: string
  approvedAtLabel: string
  cancelledAtLabel: string
  addLineFormTitle: string
  addLineSubmitBtn: string
  addLineValidation: string
  addLineFail: string
}

const receiptCopy: DraftPageCopy = {
  listPath: '/',
  newPath: '/drafts/new',
  importPath: '/drafts/import',
  pdfImportPath: '/drafts/import-pdf',
  detailPath: (id) => `/drafts/${id}`,
  listTitle: 'Receipt List',
  listDesc: 'Review and approve receipts to post inventory movements.',
  newBtn: 'Receipt Entry',
  excelBtn: 'Excel Import',
  pdfBtn: 'PDF Import',
  detailLink: 'Detail',
  detailPanelHint: 'Select a row above to view header and line details.',
  listPathWithId: (id) => `/?id=${id}`,
  documentTitle: 'Receipt Draft',
  entryNewTitle: 'Receipt Entry',
  entryEditTitle: (id) => `Receipt Entry #${id}`,
  entryReadOnlyMsg: 'This draft cannot be edited (not Registered).',
  saveSuccessMsg: 'Saved.',
  detailSaveBtn: 'Save Data',
  detailSaveLinesBtn: 'Save lines',
  listLinesEditHint:
    'Edit lines below, then Save. Double-click a row above to change receipt date, supplier, reference, or notes.',
  searchPanelTitle: 'Search Conditions',
  headerGridTitle: 'Header',
  dateColumn: 'Receipt Date',
  createTitle: 'Receipt Entry',
  createDesc: 'Enter header and rows, then save as Registered.',
  backToList: '← Back to list',
  dateTimeLabel: 'Receipt Date',
  referenceLabel: 'Reference No. (Receipt Note)',
  referencePlaceholder: 'PO-2026-001',
  supplierLabel: 'Supplier',
  notesLabel: 'Notes',
  linesTitle: 'Rows',
  itemLabel: 'Item',
  itemCdLabel: 'Item Code',
  itemNmLabel: 'Item Name',
  locationLabel: 'Location',
  lotLabel: 'Lot',
  lotPlaceholder: 'LOT-001',
  qtyLabel: 'Qty',
  addLineBtn: 'Add line',
  addRowBtn: 'Add row',
  deleteRowBtn: 'Delete row',
  checkAllRowsTitle: 'Check all',
  uncheckAllRowsTitle: 'Uncheck all',
  saveRowBtn: 'Save',
  removeRowBtn: 'Remove',
  removeLineBtn: 'Remove',
  submitCreate: 'Save',
  submittingCreate: 'Saving…',
  cancelBtn: 'Cancel',
  excelTitle: 'Excel Receipt Import',
  excelDesc: 'Upload a filled template. A pending receipt draft will be created.',
  templateBtn: 'Download template',
  excelFormatTitle: 'Excel format',
  uploadTitle: 'Upload',
  excelFileLabel: 'Excel file (.xlsx)',
  submitImport: 'Import and create draft',
  submittingImport: 'Importing…',
  detailTitle: (id) => `Receipt Draft #${id}`,
  approveConfirm: 'Approve this receipt and post to inventory?',
  cancelApprovedConfirm:
    'Revert this approved receipt to Registered? Inventory movements will be reversed.',
  cancelDraftConfirm: 'Cancel this receipt draft? It will move to Cancelled.',
  approveBtn: 'Approve',
  cancelActionBtn: 'Cancel',
  approvedMsg: 'Approved and posted to inventory.',
  cancelledMsg: 'Cancelled.',
  revertedToRegisteredMsg: 'Reverted to Registered. Inventory reversal posted.',
  parseMsgLabel: 'Import message:',
  attachmentTitle: 'Attached PDF',
  openPdfBtn: 'Open PDF',
  headerTitle: 'Header',
  linesReviewTitle: 'Rows (review)',
  noLinesMsg: 'No lines yet. Click Add row to enter a line.',
  nextStepHint:
    'Save lines, then Approve to post to inventory. Double-click a row in the list to change header fields on Entry.',
  approveFail: 'Approval failed',
  cancelFail: 'Cancel failed',
  restoreBtn: 'Restore',
  restoreConfirm: 'Restore this cancelled receipt to Registered?',
  restoredMsg: 'Restored to Registered.',
  restoreFail: 'Restore failed',
  deleteBtn: 'Delete',
  deleteConfirm: 'Permanently delete this cancelled receipt?',
  deletedMsg: 'Receipt deleted.',
  deleteFail: 'Delete failed',
  loadFail: 'Failed to load',
  masterLoadFail: 'Failed to load master data',
  createFail: 'Save failed',
  importFail: 'Import failed',
  selectExcel: 'Please select an .xlsx file.',
  lineValidation: 'Enter at least one line with item code or name, location, lot, and quantity.',
  showPdfImport: true,
  filterAll: 'All',
  filterPending: 'Registered',
  filterApproved: 'Approved',
  filterCancelled: 'Cancelled',
  filterDateFrom: 'Receipt Date From',
  filterDateTo: 'Receipt Date To',
  filterDateFromPh: 'From',
  filterDateToPh: 'To',
  filterReferencePh: 'Reference No',
  filterLotPh: 'Lot',
  filterApply: 'Apply',
  filterClear: 'Clear',
  filterDateRangeError: 'Receipt Date From must be on or before Receipt Date To.',
  exportExcelLabel: 'Excel',
  exportHeaderSheet: 'Receipt List',
  exportLinesSheet: 'Rows',
  refreshBtn: 'Refresh',
  saveGridBtn: 'Save Grid',
  saveGridSuccessMsg: 'Grid layout saved.',
  loadingText: 'Loading…',
  noDataText: 'No data',
  sourceCol: 'Source',
  statusCol: 'Status',
  referenceCol: 'Reference No.',
  supplierCol: 'Supplier',
  linesCol: 'Rows',
  createdCol: 'Created',
  idCol: 'ID',
  noneOption: '(none)',
  selectOption: 'Select',
  loadingMasterText: 'Loading master data…',
  approvedAtLabel: 'Approved at',
  cancelledAtLabel: 'Cancelled at',
  addLineFormTitle: 'Add line',
  addLineSubmitBtn: 'Add',
  addLineValidation: 'Enter item code or name, location, lot, and quantity.',
  addLineFail: 'Failed to add line',
}

const deliveryCopy: DraftPageCopy = {
  listPath: '/delivery',
  newPath: '/delivery/new',
  importPath: '/delivery/import',
  detailPath: (id) => `/delivery/${id}`,
  listTitle: 'Delivery List',
  listDesc: 'Review and approve deliveries to post inventory movements.',
  newBtn: 'Delivery Entry',
  excelBtn: 'Excel Import',
  detailLink: 'Detail',
  detailPanelHint: 'Select a row above to view header and line details.',
  listPathWithId: (id) => `/delivery?id=${id}`,
  documentTitle: 'Delivery Draft',
  entryNewTitle: 'Delivery Entry',
  entryEditTitle: (id) => `Delivery Entry #${id}`,
  entryReadOnlyMsg: 'This draft cannot be edited (not Registered).',
  saveSuccessMsg: 'Saved.',
  detailSaveBtn: 'Save Data',
  detailSaveLinesBtn: 'Save lines',
  listLinesEditHint:
    'Edit lines below, then Save. Double-click a row above to change delivery date, customer, reference, or notes.',
  searchPanelTitle: 'Search Conditions',
  headerGridTitle: 'Header',
  dateColumn: 'Delivery Date',
  createTitle: 'Delivery Entry',
  createDesc: 'Enter header and rows, then save as Registered.',
  backToList: '← Back to list',
  dateTimeLabel: 'Delivery Date',
  referenceLabel: 'Reference No. (Delivery Note)',
  referencePlaceholder: 'DN-2026-001',
  supplierLabel: 'Customer',
  notesLabel: 'Notes',
  linesTitle: 'Rows',
  itemLabel: 'Item',
  itemCdLabel: 'Item Code',
  itemNmLabel: 'Item Name',
  locationLabel: 'Location',
  lotLabel: 'Lot',
  lotPlaceholder: 'LOT-001',
  qtyLabel: 'Qty',
  addLineBtn: 'Add line',
  addRowBtn: 'Add row',
  deleteRowBtn: 'Delete row',
  checkAllRowsTitle: 'Check all',
  uncheckAllRowsTitle: 'Uncheck all',
  saveRowBtn: 'Save',
  removeRowBtn: 'Remove',
  removeLineBtn: 'Remove',
  submitCreate: 'Save',
  submittingCreate: 'Saving…',
  cancelBtn: 'Cancel',
  excelTitle: 'Excel Delivery Import',
  excelDesc: 'Upload a filled template. A pending delivery draft will be created.',
  templateBtn: 'Download template',
  excelFormatTitle: 'Excel format',
  uploadTitle: 'Upload',
  excelFileLabel: 'Excel file (.xlsx)',
  submitImport: 'Import and create draft',
  submittingImport: 'Importing…',
  detailTitle: (id) => `Delivery Draft #${id}`,
  approveConfirm: 'Approve this delivery and post to inventory?',
  cancelApprovedConfirm:
    'Revert this approved delivery to Registered? Inventory movements will be reversed.',
  cancelDraftConfirm: 'Cancel this delivery draft? It will move to Cancelled.',
  approveBtn: 'Approve',
  cancelActionBtn: 'Cancel',
  approvedMsg: 'Approved and posted to inventory.',
  cancelledMsg: 'Cancelled.',
  revertedToRegisteredMsg: 'Reverted to Registered. Inventory reversal posted.',
  parseMsgLabel: 'Import message:',
  headerTitle: 'Header',
  linesReviewTitle: 'Rows (review)',
  noLinesMsg: 'No lines yet. Click Add row to enter a line.',
  nextStepHint:
    'Save header and lines on Delivery Entry, then Approve to post to inventory.',
  approveFail: 'Approval failed',
  cancelFail: 'Cancel failed',
  restoreBtn: 'Restore',
  restoreConfirm: 'Restore this cancelled delivery to Registered?',
  restoredMsg: 'Restored to Registered.',
  restoreFail: 'Restore failed',
  deleteBtn: 'Delete',
  deleteConfirm: 'Permanently delete this cancelled delivery?',
  deletedMsg: 'Delivery deleted.',
  deleteFail: 'Delete failed',
  loadFail: 'Failed to load',
  masterLoadFail: 'Failed to load master data',
  createFail: 'Save failed',
  importFail: 'Import failed',
  selectExcel: 'Please select an .xlsx file.',
  lineValidation: 'Enter at least one line with item code or name, location, lot, and quantity.',
  showPdfImport: false,
  filterAll: 'All',
  filterPending: 'Registered',
  filterApproved: 'Approved',
  filterCancelled: 'Cancelled',
  filterDateFrom: 'Delivery Date From',
  filterDateTo: 'Delivery Date To',
  filterDateFromPh: 'From',
  filterDateToPh: 'To',
  filterReferencePh: 'Reference No',
  filterLotPh: 'Lot',
  filterApply: 'Apply',
  filterClear: 'Clear',
  filterDateRangeError: 'Delivery Date From must be on or before Delivery Date To.',
  exportExcelLabel: 'Excel',
  exportHeaderSheet: 'Delivery List',
  exportLinesSheet: 'Rows',
  refreshBtn: 'Refresh',
  saveGridBtn: 'Save Grid',
  saveGridSuccessMsg: 'Grid layout saved.',
  loadingText: 'Loading…',
  noDataText: 'No data',
  sourceCol: 'Source',
  statusCol: 'Status',
  referenceCol: 'Reference No.',
  supplierCol: 'Customer',
  linesCol: 'Rows',
  createdCol: 'Created',
  idCol: 'ID',
  noneOption: '(none)',
  selectOption: 'Select',
  loadingMasterText: 'Loading master data…',
  approvedAtLabel: 'Approved at',
  cancelledAtLabel: 'Cancelled at',
  addLineFormTitle: 'Add line',
  addLineSubmitBtn: 'Add',
  addLineValidation: 'Enter item code or name, location, lot, and quantity.',
  addLineFail: 'Failed to add line',
}

export function getDraftPageCopy(variant: DraftVariant): DraftPageCopy {
  return variant === 'delivery' ? deliveryCopy : receiptCopy
}
