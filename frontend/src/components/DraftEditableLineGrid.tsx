import { useEffect, useMemo, useState } from 'react'
import type { DraftVariant } from '../config/draftPages'
import { useGridColumnLayout, type GridColumnLayout } from '../hooks/useGridColumnLayout'
import type { Item } from '../types'
import type { LocationMaster } from '../types/masters'
import { itemCdFieldPatch, itemNmFieldPatch, type EditLineRow } from '../utils/draftEdit'
import { ResizableGridTable, type GridColumnDef } from './ResizableGridTable'

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
}

type Props = {
  variant: DraftVariant
  scope: 'detail' | 'entry'
  canEdit: boolean
  lines: EditLineRow[]
  items: Item[]
  locations: LocationMaster[]
  onUpdateLine: (key: string, patch: Partial<EditLineRow>) => void
  onAddRow: () => void
  onRemoveRows: (keys: string[]) => void
  rowError?: string | null
  copy: DraftLineGridCopy
  onLayoutChange?: () => void
  onLayoutApi?: (api: Pick<GridColumnLayout, 'saveLayout' | 'isDirty'>) => void
}

export function DraftEditableLineGrid({
  variant,
  scope,
  canEdit,
  lines,
  items,
  locations,
  onUpdateLine,
  onAddRow,
  onRemoveRows,
  rowError,
  copy,
  onLayoutChange,
  onLayoutApi,
}: Props) {
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(() => new Set())

  const lineColumns = useMemo((): GridColumnDef[] => {
    const cols: GridColumnDef[] = [
      { key: 'item_cd', label: copy.itemCdLabel, defaultWidth: 110 },
      { key: 'item_nm', label: copy.itemNmLabel, defaultWidth: 160 },
      { key: 'lot', label: copy.lotLabel, defaultWidth: 100 },
      { key: 'location', label: copy.locationLabel, defaultWidth: 140 },
      { key: 'qty', label: copy.qtyLabel, defaultWidth: 72, className: 'erp-col-num' },
    ]
    if (canEdit) {
      cols.unshift({ key: 'select', label: '', defaultWidth: 36, className: 'erp-col-check' })
    }
    return cols
  }, [canEdit, copy])

  const lineGridId = `${variant}-${scope}-lines-v6`
  const lineLayout = useGridColumnLayout(lineGridId, lineColumns, {
    onLayoutChange,
    pinFirst: canEdit ? ['select'] : undefined,
  })

  useEffect(() => {
    onLayoutApi?.({
      saveLayout: lineLayout.saveLayout,
      isDirty: lineLayout.isDirty,
    })
  }, [lineLayout.saveLayout, lineLayout.isDirty, onLayoutApi])

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

  const datalistPrefix = scope === 'entry' ? 'entry' : 'draft'

  const renderCell = (colKey: string, row: EditLineRow) => {
    switch (colKey) {
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
              value={row.item_cd}
              list={`${datalistPrefix}-item-cd-${row.key}`}
              placeholder={copy.itemCdLabel}
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
              value={row.item_nm}
              list={`${datalistPrefix}-item-nm-${row.key}`}
              placeholder={copy.itemNmLabel}
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
              <option value="">{copy.selectOption}</option>
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
              placeholder={copy.lotPlaceholder}
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
      {canEdit && (
        <div className="erp-detail-toolbar">
          <div className="erp-check-toggle-group">
            <button
              type="button"
              className="erp-check-toggle-btn"
              title={copy.checkAllRowsTitle}
              aria-label={copy.checkAllRowsTitle}
              disabled={lines.length === 0}
              onClick={() => setSelectedRowKeys(new Set(lines.map((row) => row.key)))}
            >
              <span className="erp-check-toggle-icon checked" aria-hidden />
            </button>
            <button
              type="button"
              className="erp-check-toggle-btn"
              title={copy.uncheckAllRowsTitle}
              aria-label={copy.uncheckAllRowsTitle}
              disabled={lines.length === 0}
              onClick={() => setSelectedRowKeys(new Set())}
            >
              <span className="erp-check-toggle-icon unchecked" aria-hidden />
            </button>
          </div>
          <button type="button" className="btn erp-btn erp-btn-new btn-sm" onClick={onAddRow}>
            {copy.addRowBtn}
          </button>
          <button
            type="button"
            className="btn erp-btn erp-btn-clear btn-sm"
            disabled={selectedRowKeys.size === 0}
            onClick={deleteSelectedRows}
          >
            {copy.deleteRowBtn}
          </button>
          {rowError && (
            <span className="alert-inline error">
              {rowError === 'line_validation' ? copy.addLineValidation : rowError}
            </span>
          )}
        </div>
      )}

      {canEdit && lines.length === 0 && (
        <p className="muted erp-grid-empty">{copy.noLinesMsg}</p>
      )}

      {(lines.length > 0 || canEdit) && (
        <div className="erp-grid-wrap erp-grid-wrap-detail">
          <ResizableGridTable layout={lineLayout} isColumnFilterable={() => false}>
            <tbody>
              {linesSorted.map((row, index) => (
                <tr
                  key={row.key}
                  className={`erp-grid-row-editing ${index % 2 === 1 ? 'row-alt' : ''}`}
                >
                  {lineLayout.orderedColumns.map((col) => renderCell(col.key, row))}
                </tr>
              ))}
            </tbody>
          </ResizableGridTable>
        </div>
      )}
    </>
  )
}
