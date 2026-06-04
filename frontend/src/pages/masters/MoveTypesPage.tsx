import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { GridRowNumCell } from '../../components/GridRowNumCell'
import { masterMoveTypEditColumns } from '../../components/erp/masterGridColumns'
import { useExcelLikeGrid } from '../../hooks/useExcelLikeGrid'
import { useGridRowKeyboardNav } from '../../hooks/useGridRowKeyboardNav'
import { useMasterGridToolbarFeedback } from '../../hooks/useMasterGridToolbarFeedback'
import {
  buildMoveTypPayload,
  emptyEditMoveTypRow,
  isActiveMoveTypRow,
  isBlankMoveTypRow,
  listRowsToEditMoveTypRows,
  moveTypRowSnapshotsFromEditRows,
  type EditMoveTypRow,
  type MoveTypRowSnapshot,
} from '../../utils/moveTypMasterEdit'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../../utils/gridTrailingBlankRow'
import { toFilterCellValue } from '../../utils/gridColumnFilter'
import { mergeMoveTypImportRows } from '../../utils/moveTypExcelImport'
import { gridCellPlaceholder } from '../../utils/gridPlaceholder'
import { GridRowSelectButtons } from '../../components/GridRowSelectButtons'
import { MasterGridToolbarActions } from '../../components/masters/MasterGridToolbar'
import { useRefreshMasterCatalogAfterSave } from '../../context/MasterCatalogContext'
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

export function MoveTypesPage() {
  const refreshMasterCatalog = useRefreshMasterCatalogAfterSave()
  const [editRows, setEditRows] = useState<EditMoveTypRow[]>([])
  const [savedSnapshots, setSavedSnapshots] = useState<Map<number, MoveTypRowSnapshot>>(
    () => new Map()
  )
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
      const rows = await api.listMovetypsMaster()
      const dataRows = listRowsToEditMoveTypRows(rows)
      setSavedSnapshots(moveTypRowSnapshotsFromEditRows(dataRows))
      setEditRows(
        ensureTrailingBlankRow(dataRows, isBlankMoveTypRow, () => emptyEditMoveTypRow())
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

  const getFilterValue = useCallback((row: EditMoveTypRow, col: string) => {
    switch (col) {
      case 'code':
        return toFilterCellValue(row.movetyps_cd)
      case 'name':
        return toFilterCellValue(row.movetyps_nm)
      default:
        return masterDateFilterValue(row, col)
    }
  }, [])

  const exportValue = useCallback((row: EditMoveTypRow, col: string) => {
    switch (col) {
      case 'code':
        return row.movetyps_cd
      case 'name':
        return row.movetyps_nm
      default:
        return masterDateExportValue(row, col)
    }
  }, [])

  const deleteRowsRef = useRef<() => void>(() => {})

  const grid = useExcelLikeGrid({
    columns: masterMoveTypEditColumns,
    rows: editRows,
    getFilterValue,
    rowDelete: {
      label: 'Delete row',
      getSelectedCount: () => selectedKeys.size,
      onDelete: () => deleteRowsRef.current(),
    },
    excelExport: {
      sheetName: 'Move Types',
      filenamePrefix: 'move-types',
      getExportValue: exportValue,
    },
    excelImport: {
      applyParsedRows: async (parsed) => {
        beginToolbarAction()
        const { rows, updated, added } = mergeMoveTypImportRows(parsed, editRows)
        setEditRows(
          ensureTrailingBlankRow(rows, isBlankMoveTypRow, () => emptyEditMoveTypRow())
        )
        if (updated + added > 0) {
          setSuccess(`Import: ${added} added, ${updated} updated in grid. Click Update to persist.`)
        } else {
          setSuccess('No rows were imported from the file.')
        }
      },
    },
  })

  const selectableRows = useMemo(
    () => selectableDisplayRows(grid.displayRows, isBlankMoveTypRow),
    [grid.displayRows]
  )

  const rowNav = useGridRowKeyboardNav({
    wrapId: 'masters-move-types',
    displayRows: grid.displayRows,
    isBlankRow: isBlankMoveTypRow,
  })

  const selectedCount = useMemo(
    () => selectedSelectableCount(selectableRows, selectedKeys, (row) => row.key),
    [selectableRows, selectedKeys]
  )

  const updateRow = (key: string, patch: Partial<EditMoveTypRow>) => {
    clearToolbarFeedback()
    setEditRows((rows) =>
      updateRowWithTrailingBlank(rows, key, patch, isBlankMoveTypRow, () => emptyEditMoveTypRow())
    )
  }

  const removeSelectedFromGrid = () => {
    if (selectedKeys.size === 0) return
    setEditRows((rows) =>
      removeSelectedGridRows(rows, selectedKeys, isBlankMoveTypRow, () => emptyEditMoveTypRow())
    )
    setSelectedKeys(new Set())
  }
  deleteRowsRef.current = removeSelectedFromGrid

  const deleteSelected = async () => {
    if (selectedKeys.size === 0) return
    if (!confirm(deleteSelectedConfirm(selectedKeys.size, 'move type(s)'))) return
    beginToolbarAction()
    setSubmitting(true)
    setError(null)
    try {
      const selected = editRows.filter((row) => selectedKeys.has(row.key))
      const toDelete = selected.filter((row) => row.movetyps_id != null)
      for (const row of toDelete) {
        await api.deleteMoveTyp(row.movetyps_id!)
      }
      setEditRows((rows) =>
        removeSelectedGridRows(rows, selectedKeys, isBlankMoveTypRow, () => emptyEditMoveTypRow())
      )
      setSelectedKeys(new Set())
      setSuccess(toDelete.length > 0 ? 'Move type(s) deleted.' : 'Row(s) removed.')
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
      (row) => row.movetyps_id ?? null
    )
    const active = editRows.filter(isActiveMoveTypRow)
    const incompletePersisted = editRows.filter(
      (row) => row.movetyps_id != null && !isActiveMoveTypRow(row)
    )
    if (incompletePersisted.length > 0) {
      setRowError('Complete Move Type Code for saved rows, or delete those rows.')
      return
    }
    const codes = active.map((row) => row.movetyps_cd.trim().toLowerCase())
    if (new Set(codes).size !== codes.length) {
      setRowError('Duplicate move type codes in the grid.')
      return
    }
    if (active.length === 0 && pendingDeleteIds.length === 0) {
      setRowError('Add at least one move type row.')
      return
    }

    const toSave = changedActiveRows(
      editRows,
      savedSnapshots,
      isActiveMoveTypRow,
      (row) => row.movetyps_id,
      (row) => (isActiveMoveTypRow(row) ? buildMoveTypPayload(row) : null)
    )
    if (toSave.length === 0 && pendingDeleteIds.length === 0) {
      setSuccess(savedCountMessage(0, 'move type'))
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      for (const id of pendingDeleteIds) {
        await api.deleteMoveTyp(id)
      }
      for (const row of toSave) {
        const payload = buildMoveTypPayload(row)
        if (row.movetyps_id != null) {
          await api.updateMoveTyp(row.movetyps_id, payload)
        } else {
          await api.createMoveTyp(payload)
        }
      }
      setSuccess(
        masterPersistResultMessage(toSave.length, pendingDeleteIds.length, 'move type')
      )
      if (pendingDeleteIds.length > 0 || toSave.length > 0) {
        refreshMasterCatalog()
        await load()
      }
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
        gridId="masters-movetyps-edit-v2"
        title="Move Types"
        columns={masterMoveTypEditColumns}
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
        gridRowNavWrapId="masters-move-types"
        onLayoutReady={grid.onLayoutReady}
        onGridContextMenu={grid.openContextMenu}
        layoutOptions={{ pinFirst: ['rownum', 'select'] }}
        rowCount={grid.displayRows.length}
        {...grid.tableProps}
      >
        {(layout) => (
          <tbody>
            {grid.displayRows.map((row, index) => {
              const isSentinel = isBlankMoveTypRow(row)
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
                        if (isSentinel) {
                          return <td key={col.key} className="erp-col-check" />
                        }
                        return (
                          <td key={col.key} className="erp-col-check">
                            <input
                              type="checkbox"
                              checked={selectedKeys.has(row.key)}
                              aria-label={`Select ${row.movetyps_cd || 'row'}`}
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
                              value={row.movetyps_cd}
                              placeholder={gridCellPlaceholder('GR', isSentinel)}
                              onChange={(e) =>
                                updateRow(row.key, { movetyps_cd: e.target.value })
                              }
                            />
                          </td>
                        )
                      case 'name':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <input
                              className="erp-grid-input"
                              value={row.movetyps_nm}
                              placeholder={gridCellPlaceholder('', isSentinel)}
                              onChange={(e) =>
                                updateRow(row.key, { movetyps_nm: e.target.value })
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
