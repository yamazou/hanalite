import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { GridRowNumCell } from '../../components/GridRowNumCell'
import { masterNumberingElementEditColumns } from '../../components/erp/masterGridColumns'
import { useExcelLikeGrid } from '../../hooks/useExcelLikeGrid'
import { useGridRowKeyboardNav } from '../../hooks/useGridRowKeyboardNav'
import { useMasterGridToolbarFeedback } from '../../hooks/useMasterGridToolbarFeedback'
import {
  buildNumberingElementPayload,
  emptyEditNumberingElementRow,
  isActiveNumberingElementRow,
  isBlankNumberingElementRow,
  listRowsToEditNumberingElementRows,
  NUMBERING_ELEMENT_KINDS,
  numberingElementRowSnapshotsFromEditRows,
  type EditNumberingElementRow,
  type NumberingElementRowSnapshot,
} from '../../utils/numberingElementMasterEdit'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../../utils/gridTrailingBlankRow'
import { toFilterCellValue } from '../../utils/gridColumnFilter'
import { gridCellPlaceholder } from '../../utils/gridPlaceholder'
import { GridRowSelectButtons } from '../../components/GridRowSelectButtons'
import { MasterGridToolbarActions } from '../../components/masters/MasterGridToolbar'
import {
  changedActiveRows,
  deleteSelectedConfirm,
  masterPersistResultMessage,
  persistedIdsPendingDelete,
  removeSelectedGridRows,
  savedCountMessage,
} from '../../utils/gridRowChange'
import { selectableDisplayRows, selectedSelectableCount } from '../../utils/gridRowSelection'
import {
  isMasterDateColumn,
  masterDateCellText,
  masterDateExportValue,
  masterDateFilterValue,
} from '../../utils/masterGridDates'

export function NumberingElementsPage() {
  const [editRows, setEditRows] = useState<EditNumberingElementRow[]>([])
  const [savedSnapshots, setSavedSnapshots] = useState<
    Map<number, NumberingElementRowSnapshot>
  >(() => new Map())
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const {
    success,
    setSuccess,
    rowError,
    setRowError,
    clearToolbarFeedback,
    beginToolbarAction,
  } = useMasterGridToolbarFeedback()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await api.listNumberingElementsMaster()
      const dataRows = listRowsToEditNumberingElementRows(rows)
      setSavedSnapshots(numberingElementRowSnapshotsFromEditRows(dataRows))
      setEditRows(
        ensureTrailingBlankRow(dataRows, isBlankNumberingElementRow, () =>
          emptyEditNumberingElementRow()
        )
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const valid = new Set(editRows.map((row) => row.key))
    setSelectedKeys((prev) => {
      const next = new Set([...prev].filter((key) => valid.has(key)))
      return next.size === prev.size ? prev : next
    })
  }, [editRows])

  const getFilterValue = useCallback((row: EditNumberingElementRow, col: string) => {
    switch (col) {
      case 'code':
        return toFilterCellValue(row.numbering_element_cd)
      case 'name':
        return toFilterCellValue(row.numbering_element_nm)
      case 'kind':
        return toFilterCellValue(row.element_kind)
      case 'seq_width':
        return toFilterCellValue(row.seq_width === '' ? null : row.seq_width)
      case 'literal':
        return toFilterCellValue(row.literal_text)
      case 'preview':
        return toFilterCellValue(row.preview_sample)
      default:
        return masterDateFilterValue(row, col)
    }
  }, [])

  const exportValue = useCallback((row: EditNumberingElementRow, col: string) => {
    switch (col) {
      case 'code':
        return row.numbering_element_cd
      case 'name':
        return row.numbering_element_nm
      case 'kind':
        return row.element_kind
      case 'seq_width':
        return row.seq_width === '' ? '' : row.seq_width
      case 'literal':
        return row.literal_text
      case 'preview':
        return row.preview_sample
      default:
        return masterDateExportValue(row, col)
    }
  }, [])

  const deleteRowsRef = useRef<() => void>(() => {})

  const grid = useExcelLikeGrid({
    columns: masterNumberingElementEditColumns,
    rows: editRows,
    getFilterValue,
    rowDelete: {
      label: 'Delete row',
      getSelectedCount: () => selectedKeys.size,
      onDelete: () => deleteRowsRef.current(),
    },
    excelExport: {
      sheetName: 'Numbering Elements',
      filenamePrefix: 'numbering-elements',
      getExportValue: exportValue,
    },
  })

  const selectableRows = useMemo(
    () => selectableDisplayRows(grid.displayRows, isBlankNumberingElementRow),
    [grid.displayRows]
  )

  const rowNav = useGridRowKeyboardNav({
    wrapId: 'masters-numbering-elements',
    displayRows: grid.displayRows,
    isBlankRow: isBlankNumberingElementRow,
  })

  const selectedCount = useMemo(
    () => selectedSelectableCount(selectableRows, selectedKeys, (row) => row.key),
    [selectableRows, selectedKeys]
  )

  const updateRow = (key: string, patch: Partial<EditNumberingElementRow>) => {
    clearToolbarFeedback()
    setEditRows((rows) =>
      updateRowWithTrailingBlank(
        rows,
        key,
        patch,
        isBlankNumberingElementRow,
        () => emptyEditNumberingElementRow()
      )
    )
  }

  const removeSelectedFromGrid = () => {
    if (selectedKeys.size === 0) return
    setEditRows((rows) =>
      removeSelectedGridRows(
        rows,
        selectedKeys,
        isBlankNumberingElementRow,
        () => emptyEditNumberingElementRow()
      )
    )
    setSelectedKeys(new Set())
  }
  deleteRowsRef.current = removeSelectedFromGrid

  const deleteSelected = async () => {
    if (selectedKeys.size === 0) return
    if (!confirm(deleteSelectedConfirm(selectedKeys.size, 'numbering element(s)'))) return
    beginToolbarAction()
    setSubmitting(true)
    setError(null)
    try {
      const selected = editRows.filter((row) => selectedKeys.has(row.key))
      const toDelete = selected.filter((row) => row.numbering_element_id != null)
      for (const row of toDelete) {
        await api.deleteNumberingElement(row.numbering_element_id!)
      }
      setEditRows((rows) =>
        removeSelectedGridRows(
          rows,
          selectedKeys,
          isBlankNumberingElementRow,
          () => emptyEditNumberingElementRow()
        )
      )
      setSelectedKeys(new Set())
      setSuccess(toDelete.length > 0 ? 'Numbering element(s) deleted.' : 'Row(s) removed.')
      if (toDelete.length > 0) await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSave = async () => {
    beginToolbarAction()
    const pendingDeleteIds = persistedIdsPendingDelete(
      editRows,
      savedSnapshots,
      (row) => row.numbering_element_id ?? null
    )
    const active = editRows.filter(isActiveNumberingElementRow)
    const codes = active.map((row) => row.numbering_element_cd.trim().toUpperCase())
    if (new Set(codes).size !== codes.length) {
      setRowError('Duplicate element codes in the grid.')
      return
    }
    const toSave = changedActiveRows(
      editRows,
      savedSnapshots,
      isActiveNumberingElementRow,
      (row) => row.numbering_element_id,
      (row) => (isActiveNumberingElementRow(row) ? buildNumberingElementPayload(row) : null)
    )
    if (toSave.length === 0 && pendingDeleteIds.length === 0) {
      setSuccess(savedCountMessage(0, 'numbering element'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      for (const id of pendingDeleteIds) {
        await api.deleteNumberingElement(id)
      }
      for (const row of toSave) {
        const payload = buildNumberingElementPayload(row)
        if (row.numbering_element_id != null) {
          await api.updateNumberingElement(row.numbering_element_id, payload)
        } else {
          await api.createNumberingElement(payload)
        }
      }
      setSuccess(
        masterPersistResultMessage(toSave.length, pendingDeleteIds.length, 'numbering element')
      )
      if (pendingDeleteIds.length > 0 || toSave.length > 0) await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ErpScreen error={error}>
      {grid.filterMenuElement}
      {grid.contextMenuElement}
      <ErpGridPanel
        gridId="masters-numbering-elements-v1"
        title="Numbering Elements"
        columns={masterNumberingElementEditColumns}
        loading={loading}
        isEmpty={false}
        onRefresh={() => {
          beginToolbarAction()
          void load()
        }}
        selectColumnHeader={
          <GridRowSelectButtons
            rowCount={selectableRows.length}
            selectedCount={selectedCount}
            onSelectAll={() => setSelectedKeys(new Set(selectableRows.map((row) => row.key)))}
            onClearSelection={() => setSelectedKeys(new Set())}
          />
        }
        toolbarRight={
          <MasterGridToolbarActions
            submitting={submitting}
            rowError={rowError}
            statusMessage={success}
            selectedCount={selectedCount}
            onSave={() => void handleSave()}
            onDelete={() => void deleteSelected()}
          />
        }
        showSaveGridButton
        panelClassName="erp-panel-grow"
        gridRowNavWrapId="masters-numbering-elements"
        onLayoutReady={grid.onLayoutReady}
        onGridContextMenu={grid.openContextMenu}
        layoutOptions={{ pinFirst: ['rownum', 'select'] }}
        rowCount={grid.displayRows.length}
        {...grid.tableProps}
      >
        {(layout) => (
          <tbody>
            {grid.displayRows.map((row, index) => {
              const isSentinel = isBlankNumberingElementRow(row)
              return (
                <tr
                  key={row.key}
                  {...rowNav.getTrProps(row)}
                  className={[
                    'erp-grid-row-editing',
                    rowNav.rowHighlightClass(index, row.key) ??
                      (index % 2 === 1 ? 'row-alt' : undefined),
                    selectedKeys.has(row.key) ? 'selected' : undefined,
                    isSentinel ? 'erp-grid-row-sentinel' : undefined,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {layout.orderedColumns.map((col) => {
                    switch (col.key) {
                      case 'rownum':
                        return <GridRowNumCell key={col.key} index={index} />
                      case 'select':
                        if (isSentinel) return <td key={col.key} className="erp-col-check" />
                        return (
                          <td key={col.key} className="erp-col-check">
                            <input
                              type="checkbox"
                              checked={selectedKeys.has(row.key)}
                              onChange={(e) => {
                                setSelectedKeys((prev) => {
                                  const next = new Set(prev)
                                  if (e.target.checked) next.add(row.key)
                                  else next.delete(row.key)
                                  return next
                                })
                              }}
                            />
                          </td>
                        )
                      case 'code':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <input
                              className="erp-grid-input"
                              value={row.numbering_element_cd}
                              placeholder={gridCellPlaceholder('YY', isSentinel)}
                              onChange={(e) =>
                                updateRow(row.key, { numbering_element_cd: e.target.value })
                              }
                            />
                          </td>
                        )
                      case 'name':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <input
                              className="erp-grid-input"
                              value={row.numbering_element_nm}
                              onChange={(e) =>
                                updateRow(row.key, { numbering_element_nm: e.target.value })
                              }
                            />
                          </td>
                        )
                      case 'kind':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <select
                              className="erp-grid-input"
                              value={row.element_kind}
                              onChange={(e) =>
                                updateRow(row.key, { element_kind: e.target.value })
                              }
                            >
                              {NUMBERING_ELEMENT_KINDS.map((kind) => (
                                <option key={kind} value={kind}>
                                  {kind}
                                </option>
                              ))}
                            </select>
                          </td>
                        )
                      case 'seq_width':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit erp-col-num">
                            <input
                              className="erp-grid-input"
                              type="number"
                              min={1}
                              max={20}
                              value={row.seq_width}
                              onChange={(e) =>
                                updateRow(row.key, {
                                  seq_width:
                                    e.target.value === '' ? '' : Number(e.target.value),
                                })
                              }
                            />
                          </td>
                        )
                      case 'literal':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <input
                              className="erp-grid-input"
                              value={row.literal_text}
                              onChange={(e) =>
                                updateRow(row.key, { literal_text: e.target.value })
                              }
                            />
                          </td>
                        )
                      case 'preview':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <input
                              className="erp-grid-input"
                              value={row.preview_sample}
                              onChange={(e) =>
                                updateRow(row.key, { preview_sample: e.target.value })
                              }
                            />
                          </td>
                        )
                      default:
                        if (isMasterDateColumn(col.key)) {
                          return (
                            <td key={col.key} className="erp-grid-cell-readonly">
                              {masterDateCellText(row, col.key)}
                            </td>
                          )
                        }
                        return <td key={col.key} />
                    }
                  })}
                </tr>
              )
            })}
          </tbody>
        )}
      </ErpGridPanel>
    </ErpScreen>
  )
}
