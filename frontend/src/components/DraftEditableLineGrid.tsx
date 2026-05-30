import { useEffect, useMemo, useRef, useState } from 'react'
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
import { gridCellPlaceholder } from '../utils/gridPlaceholder'
import { GRID_SELECT_COLUMN } from './erp/masterGridColumns'
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

  const lineColumns = useMemo((): GridColumnDef[] => {
    const cols: GridColumnDef[] = [GRID_ROWNUM_COLUMN]
    if (canEdit && allowRowDelete) {
      cols.push(GRID_SELECT_COLUMN)
    }
    cols.push(
      { key: 'item_cd', label: copy.itemCdLabel, defaultWidth: 110 },
      { key: 'item_nm', label: copy.itemNmLabel, defaultWidth: 160 },
      { key: 'lot', label: copy.lotLabel, defaultWidth: 100 },
      { key: 'location', label: copy.locationLabel, defaultWidth: 140 },
      { key: 'qty', label: copy.qtyLabel, defaultWidth: 72, className: 'erp-col-num' }
    )
    return cols
  }, [canEdit, allowRowDelete, copy])

  const lineGridId = `${variant}-${scope}-lines-v6`

  const linesSorted = useMemo(
    () => [...lines].sort((a, b) => a.line_no - b.line_no),
    [lines],
  )

  useEffect(() => {
    if (!canEdit) {
      setSelectedRowKeys(new Set())
      return
    }
    const valid = new Set(lines.map((row) => row.key))
    setSelectedRowKeys((prev) => {
      const next = new Set([...prev].filter((key) => valid.has(key)))
      return next.size === prev.size ? prev : next
    })
  }, [canEdit, lines])

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

  const renderCell = (colKey: string, row: EditLineRow) => {
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
            <input
              className="erp-grid-input"
              style={itemTextColorStyle(
                colorForItemRef({
                  itemtypId: row.itemtyp_id === '' ? null : row.itemtyp_id,
                  itemId: row.item_id === '' ? null : row.item_id,
                  itemCd: row.item_cd,
                })
              )}
              value={row.item_cd}
              list={`${datalistPrefix}-item-cd-${row.key}`}
              placeholder={gridCellPlaceholder(copy.itemCdLabel, blank)}
              onChange={(e) => onUpdateLine(row.key, itemCdFieldPatch(items, e.target.value))}
            />
            <datalist id={`${datalistPrefix}-item-cd-${row.key}`}>
              {items.map((item) => (
                <option key={item.item_id} value={item.item_cd}>
                  {item.item_nm}
                </option>
              ))}
            </datalist>
          </td>
        )
      case 'item_nm':
        return (
          <td key={colKey} className="erp-grid-cell-edit">
            <input
              className="erp-grid-input"
              style={itemTextColorStyle(
                colorForItemRef({
                  itemtypId: row.itemtyp_id === '' ? null : row.itemtyp_id,
                  itemId: row.item_id === '' ? null : row.item_id,
                  itemCd: row.item_cd,
                })
              )}
              value={row.item_nm}
              list={`${datalistPrefix}-item-nm-${row.key}`}
              placeholder={gridCellPlaceholder(copy.itemNmLabel, blank)}
              onChange={(e) => onUpdateLine(row.key, itemNmFieldPatch(items, e.target.value))}
            />
            <datalist id={`${datalistPrefix}-item-nm-${row.key}`}>
              {items.map((item) => (
                <option key={item.item_id} value={item.item_nm}>
                  {item.item_cd}
                </option>
              ))}
            </datalist>
          </td>
        )
      case 'location':
        return (
          <td key={colKey} className="erp-grid-cell-edit">
            <select
              className="erp-grid-input"
              value={row.location_id}
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
          {({ layout, displayRows }) => (
            <tbody>
              {displayRows.map((row, index) => (
                <tr
                  key={row.key}
                  className={`erp-grid-row-editing${index % 2 === 1 ? ' row-alt' : ''}${
                    isBlankDraftLine(row) ? ' erp-grid-row-sentinel' : ''
                  }`}
                >
                  {layout.orderedColumns.map((col) =>
                    col.key === 'rownum' ? (
                      <GridRowNumCell key={col.key} index={index} />
                    ) : (
                      renderCell(col.key, row)
                    )
                  )}
                </tr>
              ))}
            </tbody>
          )}
        </ExcelLikeGridTable>
      )}
    </>
  )
}
