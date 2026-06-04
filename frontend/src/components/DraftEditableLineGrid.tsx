import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import type { DraftVariant } from '../config/draftPages'
import type { GridColumnLayout } from '../hooks/useGridColumnLayout'
import { useItemTypColors } from '../context/ItemTypColorContext'
import { itemTextColorStyle } from '../utils/itemTypColor'
import type { Item } from '../types'
import type { LocationMaster } from '../types/masters'
import {
  editRowToDraftLine,
  isBlankDraftLine,
  itemCdFieldPatch,
  itemNmFieldPatch,
  type EditLineRow,
} from '../utils/draftEdit'
import { getDraftLineFilterValue } from '../utils/draftGridSort'
import { gridCellPlaceholder, showItemMasterDatalist } from '../utils/gridPlaceholder'
import { GridItemDatalistField, GridItemResolvedInput } from './GridItemDatalistField'
import { erpRowClass } from './erp/ErpGridPanel'
import { GRID_SELECT_COLUMN } from './erp/masterGridColumns'
import {
  buildGridRowNavKeys,
  findGridRowNavIndex,
  GRID_ROW_NAV_KEY_ATTR,
  gridRowKeyFromFocus,
  isFocusInReceiptDetailLineGrid,
  isHeaderListArrowKey,
  RECEIPT_DETAIL_LINE_SCROLL,
  resolveGridNavAnchorKey,
  scheduleFocusGridNavRow,
  shouldIgnoreHeaderListArrowKey,
  stepHeaderListNavIndex,
} from '../utils/headerListKeyboardNav'
import { GRID_ROWNUM_COLUMN, GridRowNumCell } from './GridRowNumCell'
import { GridRowSelectButtons } from './GridRowSelectButtons'
import { ExcelLikeGridTable } from './ExcelLikeGridTable'
import type { GridColumnDef } from './ResizableGridTable'

const PIN_LINE_COLUMNS = ['rownum', 'select'] as const

export type DraftLineGridCopy = {
  itemCdLabel: string
  itemNmLabel: string
  lotLabel: string
  lotPlaceholder: string
  locationLabel: string
  qtyLabel: string
  selectOption: string
  addRowBtn: string
  deleteRowBtn: string
  checkAllRowsTitle: string
  uncheckAllRowsTitle: string
  addLineValidation: string
  noLinesMsg: string
  saveRowBtn: string
  submittingCreate: string
}

type Props = {
  variant: DraftVariant
  scope: 'detail' | 'entry'
  /** Receipt List detail: hide location column. */
  hideLocation?: boolean
  canEdit: boolean
  lines: EditLineRow[]
  items: Item[]
  locations: LocationMaster[]
  onUpdateLine: (key: string, patch: Partial<EditLineRow>) => void
  onRemoveRows: (keys: string[]) => void
  onImportParsed?: (rows: Record<string, string>[]) => void
  rowError?: string | null
  copy: DraftLineGridCopy
  onLayoutChange?: () => void
  onLayoutApi?: (api: Pick<GridColumnLayout, 'saveLayout' | 'isDirty'>) => void
  onSaveLines?: () => void
  saving?: boolean
}

export function DraftEditableLineGrid({
  variant,
  scope,
  hideLocation = false,
  canEdit,
  lines,
  items,
  locations,
  onUpdateLine,
  onRemoveRows,
  onImportParsed,
  rowError,
  copy,
  onLayoutChange,
  onLayoutApi,
  onSaveLines,
  saving = false,
}: Props) {
  const { colorForItemRef } = useItemTypColors()
  /** Row delete only on Entry; List detail is edit-in-place without bulk delete. */
  const allowRowDelete = scope === 'entry'
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(() => new Set())
  const [selectedLineKey, setSelectedLineKey] = useState<string | null>(null)
  const lineNavDisplayRowsRef = useRef<EditLineRow[]>([])

  const lineColumns = useMemo((): GridColumnDef[] => {
    const cols: GridColumnDef[] = [GRID_ROWNUM_COLUMN]
    if (canEdit && allowRowDelete) {
      cols.push(GRID_SELECT_COLUMN)
    }
    cols.push(
      { key: 'item_cd', label: copy.itemCdLabel, defaultWidth: 110 },
      { key: 'item_nm', label: copy.itemNmLabel, defaultWidth: 160 },
      { key: 'lot', label: copy.lotLabel, defaultWidth: 100 }
    )
    if (!hideLocation) {
      cols.push({ key: 'location', label: copy.locationLabel, defaultWidth: 140 })
    }
    cols.push({
      key: 'qty',
      label: copy.qtyLabel,
      defaultWidth: 72,
      className: 'erp-col-num',
    })
    return cols
  }, [canEdit, allowRowDelete, copy, hideLocation])

  const lineGridId = `${variant}-${scope}-lines-v6`

  const linesSorted = useMemo(
    () => [...lines].sort((a, b) => a.line_no - b.line_no),
    [lines],
  )

  useEffect(() => {
    if (!canEdit) {
      setSelectedRowKeys(new Set())
      setSelectedLineKey(null)
      return
    }
    const valid = new Set(lines.map((row) => row.key))
    setSelectedRowKeys((prev) => {
      const next = new Set([...prev].filter((key) => valid.has(key)))
      return next.size === prev.size ? prev : next
    })
    setSelectedLineKey((prev) => (prev != null && valid.has(prev) ? prev : null))
  }, [canEdit, lines])

  const activateLineRow = useCallback((key: string) => {
    const row = lineNavDisplayRowsRef.current.find((entry) => entry.key === key)
    if (!row || isBlankDraftLine(row)) return
    setSelectedLineKey(key)
  }, [])

  const moveLineNav = useCallback(
    (delta: number, fromKey?: string | null, previousFocus?: EventTarget | null) => {
      const keys = buildGridRowNavKeys(
        lineNavDisplayRowsRef.current,
        (row) => !isBlankDraftLine(row)
      )
      const anchorKey = resolveGridNavAnchorKey(
        keys,
        fromKey ?? gridRowKeyFromFocus(previousFocus ?? null),
        selectedLineKey
      )
      const index = findGridRowNavIndex(keys, anchorKey)
      const nextIndex = stepHeaderListNavIndex(index, delta, keys.length)
      if (nextIndex < 0) return
      const key = keys[nextIndex]
      if (!key) return
      activateLineRow(key)
      scheduleFocusGridNavRow(key, RECEIPT_DETAIL_LINE_SCROLL, previousFocus)
    },
    [activateLineRow, selectedLineKey]
  )

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (!isHeaderListArrowKey(e.key)) return
      if (e.defaultPrevented) return
      if (shouldIgnoreHeaderListArrowKey(e.target)) return
      if (!isFocusInReceiptDetailLineGrid(e.target)) return
      e.preventDefault()
      moveLineNav(
        e.key === 'ArrowDown' ? 1 : -1,
        gridRowKeyFromFocus(e.target) ?? selectedLineKey,
        e.target
      )
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [moveLineNav, selectedLineKey])

  const handleLineRowFocusCapture = useCallback(
    (key: string) => (e: FocusEvent<HTMLTableRowElement>) => {
      const el = e.target
      if (
        !(
          el instanceof HTMLInputElement ||
          el instanceof HTMLSelectElement ||
          el instanceof HTMLTextAreaElement
        )
      ) {
        return
      }
      activateLineRow(key)
    },
    [activateLineRow]
  )

  const handleLineCellKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTableRowElement>) => {
      if (!isHeaderListArrowKey(e.key)) return
      e.preventDefault()
      moveLineNav(
        e.key === 'ArrowDown' ? 1 : -1,
        gridRowKeyFromFocus(e.target) ?? selectedLineKey,
        e.target
      )
    },
    [moveLineNav, selectedLineKey]
  )

  const toggleRowSelected = (key: string, checked: boolean) => {
    setSelectedRowKeys((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const deleteSelectedRows = () => {
    const keys = [...selectedRowKeys]
    if (keys.length === 0) return
    onRemoveRows(keys)
    setSelectedRowKeys(new Set())
  }

  const deleteRowsRef = useRef(deleteSelectedRows)
  deleteRowsRef.current = deleteSelectedRows

  const datalistPrefix = scope === 'entry' ? 'entry' : 'draft'

  const renderCell = (colKey: string, row: EditLineRow, selectLineRow: () => void) => {
    const blank = isBlankDraftLine(row)
    switch (colKey) {
      case 'rownum':
        return null
      case 'select':
        return (
          <td key={colKey} className="erp-col-check">
            <input
              type="checkbox"
              checked={selectedRowKeys.has(row.key)}
              aria-label={`Select row ${row.line_no}`}
              onChange={(e) => toggleRowSelected(row.key, e.target.checked)}
            />
          </td>
        )
      case 'item_cd':
        return (
          <td key={colKey} className="erp-grid-cell-edit">
            {showItemMasterDatalist(row.item_id) ? (
              <GridItemDatalistField
                mode="cd"
                items={items}
                listId={`${datalistPrefix}-item-cd-${row.key}`}
                value={row.item_cd}
                placeholder={gridCellPlaceholder(copy.itemCdLabel, blank)}
                style={itemTextColorStyle(
                  colorForItemRef({
                    itemtypId: row.itemtyp_id === '' ? null : row.itemtyp_id,
                    itemId: row.item_id === '' ? null : row.item_id,
                    itemCd: row.item_cd,
                  })
                )}
                onChange={(value) => onUpdateLine(row.key, itemCdFieldPatch(items, value))}
                onFocus={selectLineRow}
              />
            ) : (
              <GridItemResolvedInput
                value={row.item_cd}
                placeholder={gridCellPlaceholder(copy.itemCdLabel, blank)}
                style={itemTextColorStyle(
                  colorForItemRef({
                    itemtypId: row.itemtyp_id === '' ? null : row.itemtyp_id,
                    itemId: row.item_id === '' ? null : row.item_id,
                    itemCd: row.item_cd,
                  })
                )}
                onChange={(value) => onUpdateLine(row.key, itemCdFieldPatch(items, value))}
                onFocus={selectLineRow}
              />
            )}
          </td>
        )
      case 'item_nm':
        return (
          <td key={colKey} className="erp-grid-cell-edit">
            {showItemMasterDatalist(row.item_id) ? (
              <GridItemDatalistField
                mode="nm"
                items={items}
                listId={`${datalistPrefix}-item-nm-${row.key}`}
                value={row.item_nm}
                placeholder={gridCellPlaceholder(copy.itemNmLabel, blank)}
                style={itemTextColorStyle(
                  colorForItemRef({
                    itemtypId: row.itemtyp_id === '' ? null : row.itemtyp_id,
                    itemId: row.item_id === '' ? null : row.item_id,
                    itemCd: row.item_cd,
                  })
                )}
                onChange={(value) => onUpdateLine(row.key, itemNmFieldPatch(items, value))}
                onFocus={selectLineRow}
              />
            ) : (
              <GridItemResolvedInput
                value={row.item_nm}
                placeholder={gridCellPlaceholder(copy.itemNmLabel, blank)}
                style={itemTextColorStyle(
                  colorForItemRef({
                    itemtypId: row.itemtyp_id === '' ? null : row.itemtyp_id,
                    itemId: row.item_id === '' ? null : row.item_id,
                    itemCd: row.item_cd,
                  })
                )}
                onChange={(value) => onUpdateLine(row.key, itemNmFieldPatch(items, value))}
                onFocus={selectLineRow}
              />
            )}
          </td>
        )
      case 'location':
        return (
          <td key={colKey} className="erp-grid-cell-edit">
            <select
              className="erp-grid-input"
              value={row.location_id}
              onFocus={selectLineRow}
              onChange={(e) =>
                onUpdateLine(row.key, {
                  location_id: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
            >
              <option value="">{gridCellPlaceholder(copy.selectOption, blank)}</option>
              {locations.map((location) => (
                <option key={location.location_id} value={location.location_id}>
                  {location.location_cd} / {location.location_nm}
                </option>
              ))}
            </select>
          </td>
        )
      case 'lot':
        return (
          <td key={colKey} className="erp-grid-cell-edit">
            <input
              className="erp-grid-input"
              value={row.lot}
              placeholder={gridCellPlaceholder(copy.lotPlaceholder, blank)}
              onFocus={selectLineRow}
              onChange={(e) => onUpdateLine(row.key, { lot: e.target.value })}
            />
          </td>
        )
      case 'qty':
        return (
          <td key={colKey} className="erp-grid-cell-edit erp-col-num">
            <input
              className="erp-grid-input"
              type="number"
              min="0.001"
              step="0.001"
              value={row.qty}
              onFocus={selectLineRow}
              onChange={(e) => onUpdateLine(row.key, { qty: e.target.value })}
            />
          </td>
        )
      default:
        return null
    }
  }

  return (
    <>
      {canEdit && (allowRowDelete || onSaveLines || rowError) && (
        <div className="erp-detail-toolbar">
          {onSaveLines && (
            <button
              type="button"
              className="btn erp-btn erp-btn-search btn-sm"
              disabled={saving}
              onClick={onSaveLines}
            >
              {saving ? copy.submittingCreate : copy.saveRowBtn}
            </button>
          )}
          {allowRowDelete && (
            <>
              <button
                type="button"
                className="btn erp-btn erp-btn-clear btn-sm"
                disabled={selectedRowKeys.size === 0}
                onClick={deleteSelectedRows}
              >
                {copy.deleteRowBtn}
              </button>
            </>
          )}
          {rowError && (
            <span className="alert-inline error">
              {rowError === 'line_validation' ? copy.addLineValidation : rowError}
            </span>
          )}
        </div>
      )}

      {canEdit && (
        <ExcelLikeGridTable
          gridId={lineGridId}
          columns={lineColumns}
          rows={linesSorted}
          getFilterValue={(row, col) => getDraftLineFilterValue(editRowToDraftLine(row), col)}
          selectColumnHeader={
            allowRowDelete ? (
              <GridRowSelectButtons
                rowCount={lines.length}
                selectedCount={selectedRowKeys.size}
                selectAllTitle={copy.checkAllRowsTitle}
                clearTitle={copy.uncheckAllRowsTitle}
                onSelectAll={() => setSelectedRowKeys(new Set(lines.map((row) => row.key)))}
                onClearSelection={() => setSelectedRowKeys(new Set())}
              />
            ) : undefined
          }
          layoutOptions={{
            onLayoutChange,
            pinFirst: canEdit && allowRowDelete ? [...PIN_LINE_COLUMNS] : ['rownum'],
            headerFilterable: true,
          }}
          onLayoutApi={onLayoutApi}
          excelExport={{
            sheetName: `${variant}-${scope}-lines`,
            filenamePrefix: `${variant}_${scope}_lines`,
            getExportValue: (row, col) =>
              getDraftLineFilterValue(editRowToDraftLine(row), col),
          }}
          excelImport={
            canEdit && onImportParsed
              ? { applyParsedRows: onImportParsed }
              : undefined
          }
          rowDelete={
            allowRowDelete
              ? {
                  label: copy.deleteRowBtn,
                  getSelectedCount: () => selectedRowKeys.size,
                  onDelete: () => deleteRowsRef.current(),
                }
              : undefined
          }
        >
          {({ layout, displayRows }) => {
            lineNavDisplayRowsRef.current = displayRows
            return (
            <tbody>
              {displayRows.map((row, index) => {
                const selectLineRow = () => activateLineRow(row.key)
                return (
                <tr
                  key={row.key}
                  {...{ [GRID_ROW_NAV_KEY_ATTR]: row.key }}
                  className={`${erpRowClass(index, selectedLineKey === row.key) ?? ''} erp-grid-row-editing${
                    isBlankDraftLine(row) ? ' erp-grid-row-sentinel' : ''
                  }`}
                  onClick={selectLineRow}
                  onFocusCapture={handleLineRowFocusCapture(row.key)}
                  onKeyDown={handleLineCellKeyDown}
                >
                  {layout.orderedColumns.map((col) =>
                    col.key === 'rownum' ? (
                      <GridRowNumCell key={col.key} index={index} />
                    ) : (
                      renderCell(col.key, row, selectLineRow)
                    )
                  )}
                </tr>
                )
              })}
            </tbody>
            )
          }}
        </ExcelLikeGridTable>
      )}
    </>
  )
}
