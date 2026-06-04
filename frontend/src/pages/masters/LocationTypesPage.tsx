import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { GridRowNumCell } from '../../components/GridRowNumCell'
import { masterLocationTypEditColumns } from '../../components/erp/masterGridColumns'
import { useExcelLikeGrid } from '../../hooks/useExcelLikeGrid'
import { useGridRowKeyboardNav } from '../../hooks/useGridRowKeyboardNav'
import { useMasterGridToolbarFeedback } from '../../hooks/useMasterGridToolbarFeedback'
import {
  buildLocationTypPayload,
  emptyEditLocationTypRow,
  isActiveLocationTypRow,
  isBlankLocationTypRow,
  listRowsToEditLocationTypRows,
  locationTypRowSnapshotsFromEditRows,
  type EditLocationTypRow,
  type LocationTypRowSnapshot,
} from '../../utils/locationTypMasterEdit'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../../utils/gridTrailingBlankRow'
import { toFilterCellValue } from '../../utils/gridColumnFilter'
import { mergeLocationTypImportRows } from '../../utils/locationTypExcelImport'
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

export function LocationTypesPage() {
  const refreshMasterCatalog = useRefreshMasterCatalogAfterSave()
  const [editRows, setEditRows] = useState<EditLocationTypRow[]>([])
  const [savedSnapshots, setSavedSnapshots] = useState<Map<number, LocationTypRowSnapshot>>(
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
      const rows = await api.listLocationtypsMaster()
      const dataRows = listRowsToEditLocationTypRows(rows)
      setSavedSnapshots(locationTypRowSnapshotsFromEditRows(dataRows))
      setEditRows(
        ensureTrailingBlankRow(dataRows, isBlankLocationTypRow, () => emptyEditLocationTypRow())
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

  const getFilterValue = useCallback((row: EditLocationTypRow, col: string) => {
    switch (col) {
      case 'code':
        return toFilterCellValue(row.locationtyp_cd)
      case 'name':
        return toFilterCellValue(row.locationtyp_nm)
      default:
        return masterDateFilterValue(row, col)
    }
  }, [])

  const exportValue = useCallback((row: EditLocationTypRow, col: string) => {
    switch (col) {
      case 'code':
        return row.locationtyp_cd
      case 'name':
        return row.locationtyp_nm
      default:
        return masterDateExportValue(row, col)
    }
  }, [])

  const deleteRowsRef = useRef<() => void>(() => {})

  const grid = useExcelLikeGrid({
    columns: masterLocationTypEditColumns,
    rows: editRows,
    getFilterValue,
    rowDelete: {
      label: 'Delete row',
      getSelectedCount: () => selectedKeys.size,
      onDelete: () => deleteRowsRef.current(),
    },
    excelExport: {
      sheetName: 'Location Types',
      filenamePrefix: 'location-types',
      getExportValue: exportValue,
    },
    excelImport: {
      applyParsedRows: async (parsed) => {
        beginToolbarAction()
        const { rows, updated, added } = mergeLocationTypImportRows(parsed, editRows)
        setEditRows(
          ensureTrailingBlankRow(rows, isBlankLocationTypRow, () => emptyEditLocationTypRow())
        )
        if (updated + added > 0) {
          setSuccess(
            `Import: ${added} added, ${updated} updated in grid. Click Update to persist.`
          )
        } else {
          setSuccess('No rows were imported from the file.')
        }
      },
    },
  })

  const selectableRows = useMemo(
    () => selectableDisplayRows(grid.displayRows, isBlankLocationTypRow),
    [grid.displayRows]
  )

  const rowNav = useGridRowKeyboardNav({
    wrapId: 'masters-location-types',
    displayRows: grid.displayRows,
    isBlankRow: isBlankLocationTypRow,
  })

  const selectedCount = useMemo(
    () => selectedSelectableCount(selectableRows, selectedKeys, (row) => row.key),
    [selectableRows, selectedKeys]
  )

  const updateRow = (key: string, patch: Partial<EditLocationTypRow>) => {
    clearToolbarFeedback()
    setEditRows((rows) =>
      updateRowWithTrailingBlank(rows, key, patch, isBlankLocationTypRow, () =>
        emptyEditLocationTypRow()
      )
    )
  }

  const removeSelectedFromGrid = () => {
    if (selectedKeys.size === 0) return
    setEditRows((rows) =>
      removeSelectedGridRows(rows, selectedKeys, isBlankLocationTypRow, () =>
        emptyEditLocationTypRow()
      )
    )
    setSelectedKeys(new Set())
  }
  deleteRowsRef.current = removeSelectedFromGrid

  const deleteSelected = async () => {
    if (selectedKeys.size === 0) return
    if (!confirm(deleteSelectedConfirm(selectedKeys.size, 'location type(s)'))) return
    beginToolbarAction()
    setSubmitting(true)
    try {
      const selected = editRows.filter((row) => selectedKeys.has(row.key))
      const toDelete = selected.filter((row) => row.locationtyp_id != null)
      for (const row of toDelete) {
        await api.deleteLocationTyp(row.locationtyp_id!)
      }
      setEditRows((rows) =>
        removeSelectedGridRows(rows, selectedKeys, isBlankLocationTypRow, () =>
          emptyEditLocationTypRow()
        )
      )
      setSelectedKeys(new Set())
      setSuccess(toDelete.length > 0 ? 'Location type(s) deleted.' : 'Row(s) removed.')
      if (toDelete.length > 0) {
        refreshMasterCatalog()
        await load()
      }
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSave = async () => {
    beginToolbarAction()
    const pendingDeleteIds = persistedIdsPendingDelete(
      editRows,
      savedSnapshots,
      (row) => row.locationtyp_id ?? null
    )
    const active = editRows.filter(isActiveLocationTypRow)
    const incompletePersisted = editRows.filter(
      (row) => row.locationtyp_id != null && !isActiveLocationTypRow(row)
    )
    if (incompletePersisted.length > 0) {
      setRowError('Complete Location Type Code and Name for saved rows, or delete those rows.')
      return
    }
    const codes = active.map((row) => row.locationtyp_cd.trim().toLowerCase())
    if (new Set(codes).size !== codes.length) {
      setRowError('Duplicate location type codes in the grid.')
      return
    }
    if (active.length === 0 && pendingDeleteIds.length === 0) {
      setRowError('Add at least one location type row.')
      return
    }

    const toSave = changedActiveRows(
      editRows,
      savedSnapshots,
      isActiveLocationTypRow,
      (row) => row.locationtyp_id,
      (row) => (isActiveLocationTypRow(row) ? buildLocationTypPayload(row) : null)
    )
    if (toSave.length === 0 && pendingDeleteIds.length === 0) {
      setSuccess(savedCountMessage(0, 'location type'))
      return
    }

    setSubmitting(true)
    try {
      for (const id of pendingDeleteIds) {
        await api.deleteLocationTyp(id)
      }
      for (const row of toSave) {
        const payload = buildLocationTypPayload(row)
        if (row.locationtyp_id != null) {
          await api.updateLocationTyp(row.locationtyp_id, payload)
        } else {
          await api.createLocationTyp(payload)
        }
      }
      setSuccess(
        masterPersistResultMessage(toSave.length, pendingDeleteIds.length, 'location type')
      )
      if (pendingDeleteIds.length > 0 || toSave.length > 0) {
        refreshMasterCatalog()
        await load()
      }
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ErpScreen error={error}>
      {grid.filterMenuElement}
      {grid.contextMenuElement}
      <ErpGridPanel
        gridId="masters-locationtyps-edit-v1"
        title="Location Types"
        columns={masterLocationTypEditColumns}
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
        gridRowNavWrapId="masters-location-types"
        onLayoutReady={grid.onLayoutReady}
        onGridContextMenu={grid.openContextMenu}
        layoutOptions={{ pinFirst: ['rownum', 'select'] }}
        rowCount={grid.displayRows.length}
        {...grid.tableProps}
      >
        {(layout) => (
          <tbody>
            {grid.displayRows.map((row, index) => {
              const isSentinel = isBlankLocationTypRow(row)
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
                              aria-label={`Select ${row.locationtyp_cd || 'row'}`}
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
                              value={row.locationtyp_cd}
                              placeholder={gridCellPlaceholder('RM', isSentinel)}
                              onChange={(e) =>
                                updateRow(row.key, { locationtyp_cd: e.target.value })
                              }
                            />
                          </td>
                        )
                      case 'name':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <input
                              className="erp-grid-input"
                              value={row.locationtyp_nm}
                              placeholder={gridCellPlaceholder('Raw Material', isSentinel)}
                              onChange={(e) =>
                                updateRow(row.key, { locationtyp_nm: e.target.value })
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
