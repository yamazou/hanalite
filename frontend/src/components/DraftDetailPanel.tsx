import { useEffect, useMemo, useState } from 'react'
import { Alert } from './Alert'
import { ResizableGridTable, type GridColumnDef } from './ResizableGridTable'
import { useGridColumnLayout, type GridColumnLayout } from '../hooks/useGridColumnLayout'
import { useGridSort } from '../hooks/useGridSort'
import { GridColumnFilterMenu } from './GridColumnFilterMenu'
import { GridContextMenu, type GridContextMenuState } from './GridContextMenu'
import { downloadExcelSheet, exportFilename } from '../utils/exportExcel'
import { useGridColumnFilters } from '../hooks/useGridColumnFilters'
import { applyColumnFilters, collectUniqueFilterValues } from '../utils/gridColumnFilter'
import { compareDraftLines, getDraftLineFilterValue } from '../utils/draftGridSort'
import type { useDraftEdit } from '../hooks/useDraftEdit'
import { getDraftPageCopy, type DraftVariant } from '../config/draftPages'
import type { DraftLine } from '../types'
import {
  editRowToDraftLine,
  itemCdFieldPatch,
  itemNmFieldPatch,
  type EditLineRow,
} from '../utils/draftEdit'
import { formatQty } from '../utils/format'

type DraftEdit = ReturnType<typeof useDraftEdit>

export type LineGridLayoutApi = Pick<GridColumnLayout, 'saveLayout' | 'isDirty'>

type Props = {
  draftId: number | null
  variant?: DraftVariant
  edit: DraftEdit
  onSaved?: () => void
  onLineGridLayout?: (api: LineGridLayoutApi) => void
  onLineGridLayoutChange?: () => void
}

export function DraftDetailPanel({
  draftId,
  variant = 'receipt',
  edit,
  onSaved,
  onLineGridLayout,
  onLineGridLayoutChange,
}: Props) {
  const copy = getDraftPageCopy(variant)
  const {
    draft,
    loading,
    error,
    rowError,
    message,
    canEdit,
    editLines,
    updateLine,
    addRow,
    removeRow,
    items,
    locations,
  } = edit

  const [lineGridMenu, setLineGridMenu] = useState<GridContextMenuState>(null)

  const lineColumns = useMemo((): GridColumnDef[] => {
    const cols: GridColumnDef[] = [
      { key: 'item_cd', label: copy.itemCdLabel, defaultWidth: 110 },
      { key: 'item_nm', label: copy.itemNmLabel, defaultWidth: 160 },
      { key: 'lot', label: copy.lotLabel, defaultWidth: 100 },
      { key: 'location', label: copy.locationLabel, defaultWidth: 140 },
      { key: 'qty', label: copy.qtyLabel, defaultWidth: 72, className: 'erp-col-num' },
    ]
    if (canEdit) {
      cols.push({ key: 'actions', label: '', defaultWidth: 72, className: 'erp-col-actions' })
    }
    return cols
  }, [canEdit, copy.itemCdLabel, copy.itemNmLabel, copy.locationLabel, copy.lotLabel, copy.qtyLabel])

  const lineGridId = `${variant}-lines-v3`
  const lineLayout = useGridColumnLayout(lineGridId, lineColumns, {
    onLayoutChange: onLineGridLayoutChange,
  })

  useEffect(() => {
    onLineGridLayout?.({
      saveLayout: lineLayout.saveLayout,
      isDirty: lineLayout.isDirty,
    })
  }, [lineLayout.saveLayout, lineLayout.isDirty, onLineGridLayout])
  const lineSort = useGridSort()
  const lineFilters = useGridColumnFilters()
  const [lineFilterMenu, setLineFilterMenu] = useState<{
    key: string
    label: string
    rect: DOMRect
  } | null>(null)

  const displayLines: DraftLine[] = useMemo(() => {
    if (canEdit) return editLines.map(editRowToDraftLine)
    return draft?.lines ?? []
  }, [canEdit, editLines, draft?.lines])

  const lineFilterOptions = useMemo(() => {
    if (!lineFilterMenu || displayLines.length === 0) return []
    return collectUniqueFilterValues(displayLines, lineFilterMenu.key, getDraftLineFilterValue)
  }, [lineFilterMenu, displayLines])

  const filteredLines = useMemo(() => {
    return applyColumnFilters(displayLines, lineFilters.filters, getDraftLineFilterValue)
  }, [displayLines, lineFilters.filters])

  const sortedLines = useMemo(() => {
    if (!lineSort.sort) return filteredLines
    const { key, dir } = lineSort.sort
    return [...filteredLines].sort((a, b) => compareDraftLines(a, b, key, dir))
  }, [filteredLines, lineSort.sort])

  const editLinesSorted = useMemo(
    () => [...editLines].sort((a, b) => a.line_no - b.line_no),
    [editLines]
  )

  const isLineColumnSortable = (key: string) => key !== 'actions' && !canEdit
  const isLineColumnFilterable = isLineColumnSortable

  const lineFilterColumnLabel =
    lineColumns.find((c) => c.key === lineFilterMenu?.key)?.label ?? lineFilterMenu?.label ?? ''

  const exportLinesGridToExcel = () => {
    const columns = lineLayout.orderedColumns.filter((col) => col.key !== 'actions')
    const headers = columns.map((col) => col.label)
    const rows = sortedLines.map((line) =>
      columns.map((col) => getDraftLineFilterValue(line, col.key))
    )
    const prefix =
      variant === 'delivery'
        ? `delivery_draft_${draftId ?? 'rows'}_lines`
        : `receipt_draft_${draftId ?? 'rows'}_lines`
    downloadExcelSheet(copy.exportLinesSheet, headers, rows, exportFilename(prefix))
  }

  const renderReadOnlyLineCell = (colKey: string, line: DraftLine) => {
    switch (colKey) {
      case 'item_cd':
        return (
          <td key={colKey} title={line.item_cd ?? ''}>
            <code>{line.item_cd ?? '-'}</code>
          </td>
        )
      case 'item_nm':
        return (
          <td key={colKey} title={line.item_nm ?? ''}>
            <span className="erp-item-name">{line.item_nm ?? '-'}</span>
            {line.item_id != null && (
              <span className="muted small"> (ID:{line.item_id})</span>
            )}
          </td>
        )
      case 'location':
        return (
          <td
            key={colKey}
            title={`${line.location_cd ?? '-'} ${line.location_nm ?? ''}`.trim()}
          >
            <code>{line.location_cd ?? '-'}</code>
            {line.location_nm ? ` ${line.location_nm}` : ''}
          </td>
        )
      case 'lot':
        return (
          <td key={colKey} title={line.lot}>
            <code>{line.lot}</code>
          </td>
        )
      case 'qty':
        return (
          <td key={colKey} className="erp-col-num">
            {formatQty(line.qty)}
          </td>
        )
      default:
        return null
    }
  }

  const renderEditLineCell = (colKey: string, row: EditLineRow) => {
    switch (colKey) {
      case 'item_cd':
        return (
          <td key={colKey} className="erp-grid-cell-edit">
            <input
              className="erp-grid-input"
              value={row.item_cd}
              list={`draft-item-cd-${row.key}`}
              placeholder={copy.itemCdLabel}
              onChange={(e) => updateLine(row.key, itemCdFieldPatch(items, e.target.value))}
            />
            <datalist id={`draft-item-cd-${row.key}`}>
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
              list={`draft-item-nm-${row.key}`}
              placeholder={copy.itemNmLabel}
              onChange={(e) => updateLine(row.key, itemNmFieldPatch(items, e.target.value))}
            />
            <datalist id={`draft-item-nm-${row.key}`}>
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
                updateLine(row.key, {
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
              onChange={(e) => updateLine(row.key, { lot: e.target.value })}
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
              onChange={(e) => updateLine(row.key, { qty: e.target.value })}
            />
          </td>
        )
      case 'actions':
        return (
          <td key={colKey} className="erp-col-actions">
            <button
              type="button"
              className="btn erp-btn erp-btn-clear btn-sm"
              onClick={() => removeRow(row.key)}
            >
              {copy.removeRowBtn}
            </button>
          </td>
        )
      default:
        return null
    }
  }

  if (!draftId) {
    return <p className="muted erp-grid-empty">{copy.detailPanelHint}</p>
  }

  if (loading) {
    return <p className="muted erp-grid-empty">{copy.loadingText}</p>
  }

  if (!draft) {
    return (
      <>
        {error && <Alert type="error" message={error} />}
        {!error && <p className="muted erp-grid-empty">{copy.loadFail}</p>}
      </>
    )
  }

  const showEmptyHint = canEdit && editLines.length === 0

  return (
    <div className="erp-detail-content">
      <GridContextMenu
        menu={lineGridMenu}
        excelLabel={copy.exportExcelLabel}
        onExcel={exportLinesGridToExcel}
        onClose={() => setLineGridMenu(null)}
      />
      {lineFilterMenu && (
        <GridColumnFilterMenu
          columnLabel={lineFilterColumnLabel}
          options={lineFilterOptions}
          selected={lineFilters.getSelected(lineFilterMenu.key, lineFilterOptions)}
          anchorRect={lineFilterMenu.rect}
          onApply={(selected) =>
            lineFilters.applySelection(lineFilterMenu.key, selected, lineFilterOptions)
          }
          onClear={() => lineFilters.clearColumn(lineFilterMenu.key)}
          onClose={() => setLineFilterMenu(null)}
        />
      )}
      {error && <Alert type="error" message={error} />}
      {message && <Alert type="success" message={message} />}

      {canEdit && (
        <div className="erp-detail-toolbar">
          <button type="button" className="btn erp-btn erp-btn-new btn-sm" onClick={addRow}>
            {copy.addRowBtn}
          </button>
          {rowError && (
            <span className="alert-inline error">
              {rowError === 'line_validation' ? copy.addLineValidation : rowError}
            </span>
          )}
        </div>
      )}

      {showEmptyHint && <p className="muted erp-grid-empty">{copy.noLinesMsg}</p>}

      {(displayLines.length > 0 || canEdit) && (
        <div
          className="erp-grid-wrap erp-grid-wrap-detail"
          onContextMenu={(event) => {
            event.preventDefault()
            setLineGridMenu({ x: event.clientX, y: event.clientY })
          }}
        >
          <ResizableGridTable
            layout={lineLayout}
            sortMark={lineSort.sortMark}
            onHeaderDoubleClick={(key) => lineSort.toggleSort(key, isLineColumnSortable(key))}
            isColumnSortable={isLineColumnSortable}
            isColumnFilterable={isLineColumnFilterable}
            isColumnFilterActive={lineFilters.isActive}
            onFilterClick={(key, anchor) => {
              const col = lineColumns.find((c) => c.key === key)
              setLineFilterMenu({
                key,
                label: col?.label ?? key,
                rect: anchor.getBoundingClientRect(),
              })
            }}
          >
            <tbody>
              {canEdit
                ? editLinesSorted.map((row, index) => (
                    <tr
                      key={row.key}
                      className={`erp-grid-row-editing ${index % 2 === 1 ? 'row-alt' : ''}`}
                    >
                      {lineLayout.orderedColumns.map((col) => renderEditLineCell(col.key, row))}
                    </tr>
                  ))
                : sortedLines.map((line, index) => (
                    <tr
                      key={line.inv_receipt_draft_line_id}
                      className={index % 2 === 1 ? 'row-alt' : undefined}
                    >
                      {lineLayout.orderedColumns.map((col) =>
                        renderReadOnlyLineCell(col.key, line)
                      )}
                    </tr>
                  ))}
            </tbody>
          </ResizableGridTable>
        </div>
      )}

      {canEdit && draft.lines.length > 0 && (
        <p className="muted erp-detail-hint">{copy.nextStepHint}</p>
      )}
    </div>
  )
}
