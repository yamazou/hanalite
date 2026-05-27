import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { Alert } from './Alert'
import { ResizableGridTable, type GridColumnDef } from './ResizableGridTable'
import { useGridColumnLayout } from '../hooks/useGridColumnLayout'
import { useGridSort } from '../hooks/useGridSort'
import { GridColumnFilterMenu } from './GridColumnFilterMenu'
import { GridContextMenu, type GridContextMenuState } from './GridContextMenu'
import { downloadExcelSheet, exportFilename } from '../utils/exportExcel'
import { useGridColumnFilters } from '../hooks/useGridColumnFilters'
import { applyColumnFilters, collectUniqueFilterValues } from '../utils/gridColumnFilter'
import { compareDraftLines, getDraftLineFilterValue } from '../utils/draftGridSort'
import type { DraftLine } from '../types'
import { getDraftPageCopy, type DraftVariant } from '../config/draftPages'
import type { DraftDetail } from '../types'
import type { Item } from '../types'
import type { LocationMaster } from '../types/masters'
import { formatItemLabel, formatQty } from '../utils/format'

type Props = {
  draftId: number | null
  variant?: DraftVariant
  refreshToken?: number
  onUpdated?: () => void
}

type PendingLineRow = {
  key: string
  item_id: number | ''
  location_id: number | ''
  lot: string
  qty: string
  saving: boolean
}

function emptyPendingRow(): PendingLineRow {
  return {
    key: crypto.randomUUID(),
    item_id: '',
    location_id: '',
    lot: '',
    qty: '',
    saving: false,
  }
}

export function DraftDetailPanel({
  draftId,
  variant = 'receipt',
  refreshToken = 0,
  onUpdated,
}: Props) {
  const copy = getDraftPageCopy(variant)
  const [draft, setDraft] = useState<DraftDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [locations, setLocations] = useState<LocationMaster[]>([])
  const [pendingRows, setPendingRows] = useState<PendingLineRow[]>([])
  const [lineGridMenu, setLineGridMenu] = useState<GridContextMenuState>(null)

  const canEdit = draft?.status === 'registered'

  const lineColumns = useMemo((): GridColumnDef[] => {
    const cols: GridColumnDef[] = [
      { key: 'item', label: copy.itemLabel, defaultWidth: 220 },
      { key: 'location', label: copy.locationLabel, defaultWidth: 140 },
      { key: 'lot', label: copy.lotLabel, defaultWidth: 100 },
      { key: 'qty', label: copy.qtyLabel, defaultWidth: 72, className: 'erp-col-num' },
    ]
    if (canEdit) {
      cols.push({ key: 'actions', label: '', defaultWidth: 88, className: 'erp-col-actions' })
    }
    return cols
  }, [canEdit, copy.itemLabel, copy.locationLabel, copy.lotLabel, copy.qtyLabel])

  const lineGridId = `${variant}-lines${canEdit ? '-edit' : ''}`
  const lineLayout = useGridColumnLayout(lineGridId, lineColumns)
  const lineSort = useGridSort()
  const lineFilters = useGridColumnFilters()
  const [lineFilterMenu, setLineFilterMenu] = useState<{
    key: string
    label: string
    rect: DOMRect
  } | null>(null)

  const lineFilterOptions = useMemo(() => {
    if (!lineFilterMenu || !draft?.lines) return []
    return collectUniqueFilterValues(draft.lines, lineFilterMenu.key, getDraftLineFilterValue)
  }, [lineFilterMenu, draft?.lines])

  const filteredLines = useMemo(() => {
    if (!draft?.lines) return []
    return applyColumnFilters(draft.lines, lineFilters.filters, getDraftLineFilterValue)
  }, [draft?.lines, lineFilters.filters])

  const sortedLines = useMemo(() => {
    if (!lineSort.sort) return filteredLines
    const { key, dir } = lineSort.sort
    return [...filteredLines].sort((a, b) => compareDraftLines(a, b, key, dir))
  }, [filteredLines, lineSort.sort])

  const isLineColumnSortable = (key: string) => key !== 'actions'
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

  const renderLineCell = (colKey: string, line: DraftLine) => {
    switch (colKey) {
      case 'item':
        return (
          <td
            key={colKey}
            title={`${line.item_nm ?? '-'} (ID:${line.item_id})`}
          >
            <span className="erp-item-name">{line.item_nm ?? '-'}</span>
            <span className="muted small"> (ID:{line.item_id})</span>
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
      case 'actions':
        return <td key={colKey}></td>
      default:
        return null
    }
  }

  const renderPendingCell = (colKey: string, row: PendingLineRow) => {
    switch (colKey) {
      case 'item':
        return (
          <td key={colKey} className="erp-grid-cell-edit">
            <select
              className="erp-grid-input"
              value={row.item_id}
              onChange={(e) =>
                updatePendingRow(row.key, {
                  item_id: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
            >
              <option value="">{copy.selectOption}</option>
              {items.map((item) => (
                <option key={item.item_id} value={item.item_id}>
                  {formatItemLabel(item)}
                </option>
              ))}
            </select>
          </td>
        )
      case 'location':
        return (
          <td key={colKey} className="erp-grid-cell-edit">
            <select
              className="erp-grid-input"
              value={row.location_id}
              onChange={(e) =>
                updatePendingRow(row.key, {
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
              onChange={(e) => updatePendingRow(row.key, { lot: e.target.value })}
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
              onChange={(e) => updatePendingRow(row.key, { qty: e.target.value })}
            />
          </td>
        )
      case 'actions':
        return (
          <td key={colKey} className="erp-col-actions">
            <div className="erp-row-actions">
              <button
                type="button"
                className="btn erp-btn erp-btn-new btn-sm"
                disabled={row.saving}
                onClick={() => void savePendingRow(row)}
              >
                {row.saving ? copy.submittingCreate : copy.saveRowBtn}
              </button>
              <button
                type="button"
                className="btn erp-btn erp-btn-clear btn-sm"
                disabled={row.saving}
                onClick={() => removePendingRow(row.key)}
              >
                {copy.removeRowBtn}
              </button>
            </div>
          </td>
        )
      default:
        return null
    }
  }

  const load = useCallback(async () => {
    if (!draftId) {
      setDraft(null)
      setError(null)
      setPendingRows([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await api.getDraft(draftId, variant)
      setDraft(data)
      setPendingRows([])
      setRowError(null)
    } catch (e) {
      setDraft(null)
      setError(e instanceof Error ? e.message : copy.loadFail)
    } finally {
      setLoading(false)
    }
  }, [draftId, copy.loadFail, variant])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  useEffect(() => {
    if (!canEdit) return
    api.listItems().then(setItems).catch(() => setItems([]))
    api.listLocationsMaster().then(setLocations).catch(() => setLocations([]))
  }, [canEdit])

  const addRow = () => {
    setRowError(null)
    setPendingRows((prev) => [...prev, emptyPendingRow()])
  }

  const updatePendingRow = (key: string, patch: Partial<PendingLineRow>) => {
    setPendingRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const removePendingRow = (key: string) => {
    setPendingRows((prev) => prev.filter((row) => row.key !== key))
    setRowError(null)
  }

  const savePendingRow = async (row: PendingLineRow) => {
    if (!draft) return
    if (!row.item_id || !row.location_id || !row.lot.trim() || !row.qty) {
      setRowError(copy.addLineValidation)
      return
    }
    const qty = Number(row.qty)
    if (!qty || qty <= 0) {
      setRowError(copy.addLineValidation)
      return
    }

    const nextLineNo = Math.max(0, ...draft.lines.map((line) => line.line_no)) + 1
    setRowError(null)
    updatePendingRow(row.key, { saving: true })
    try {
      await api.addDraftLine(
        draft.inv_receipt_draft_id,
        {
          item_id: Number(row.item_id),
          location_id: Number(row.location_id),
          lot: row.lot.trim(),
          qty,
          line_no: nextLineNo,
        },
        variant
      )
      await load()
      onUpdated?.()
    } catch (e) {
      updatePendingRow(row.key, { saving: false })
      setRowError(e instanceof Error ? e.message : copy.addLineFail)
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

  const showEmptyHint = draft.lines.length === 0 && pendingRows.length === 0

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
      {canEdit && (
        <div className="erp-detail-toolbar">
          <button type="button" className="btn erp-btn erp-btn-new btn-sm" onClick={addRow}>
            {copy.addRowBtn}
          </button>
          {rowError && <span className="alert-inline error">{rowError}</span>}
        </div>
      )}
      {showEmptyHint && <p className="muted erp-grid-empty">{copy.noLinesMsg}</p>}
      {(draft.lines.length > 0 || pendingRows.length > 0 || canEdit) && (
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
              {sortedLines.map((line, index) => (
                <tr key={line.inv_receipt_draft_line_id} className={index % 2 === 1 ? 'row-alt' : undefined}>
                  {lineLayout.orderedColumns.map((col) => renderLineCell(col.key, line))}
                </tr>
              ))}
              {pendingRows.map((row, index) => (
                <tr
                  key={row.key}
                  className={`erp-grid-row-editing ${(sortedLines.length + index) % 2 === 1 ? 'row-alt' : ''}`}
                >
                  {lineLayout.orderedColumns.map((col) => renderPendingCell(col.key, row))}
                </tr>
              ))}
            </tbody>
          </ResizableGridTable>
        </div>
      )}
    </div>
  )
}
