import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { GridRowNumCell } from '../../components/GridRowNumCell'
import { masterLocationEditColumns } from '../../components/erp/masterGridColumns'
import { GridRowSelectButtons } from '../../components/GridRowSelectButtons'
import { MasterGridToolbarActions } from '../../components/masters/MasterGridToolbar'
import { useRefreshMasterCatalogAfterSave } from '../../context/MasterCatalogContext'
import { useExcelLikeGrid } from '../../hooks/useExcelLikeGrid'
import { useGridRowKeyboardNav } from '../../hooks/useGridRowKeyboardNav'
import { useMasterGridToolbarFeedback } from '../../hooks/useMasterGridToolbarFeedback'
import type { LocationTyp } from '../../types/masters'
import { locationTypDropdownLabel } from '../../utils/locationTypMasterEdit'
import {
  buildLocationPayload,
  emptyEditLocationRow,
  isActiveLocationRow,
  isBlankLocationRow,
  listRowsToEditLocationRows,
  locationRowSnapshotsFromEditRows,
  type EditLocationRow,
  type LocationRowSnapshot,
} from '../../utils/locationMasterEdit'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../../utils/gridTrailingBlankRow'
import { toFilterCellValue } from '../../utils/gridColumnFilter'
import { mergeLocationImportRows } from '../../utils/locationExcelImport'
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

export function LocationsPage() {
  const refreshMasterCatalog = useRefreshMasterCatalogAfterSave()
  const [editRows, setEditRows] = useState<EditLocationRow[]>([])
  const [savedSnapshots, setSavedSnapshots] = useState<Map<number, LocationRowSnapshot>>(
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
  const [locationtyps, setLocationtyps] = useState<LocationTyp[]>([])

  const locationTypLabelById = useMemo(() => {
    const map = new Map<number, string>()
    for (const t of locationtyps) {
      map.set(t.locationtyp_id, locationTypDropdownLabel(t))
    }
    return map
  }, [locationtyps])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rows, locTypRows] = await Promise.all([
        api.listLocationsMaster(),
        api.listLocationtypsMaster(),
      ])
      setLocationtyps(locTypRows)
      const dataRows = listRowsToEditLocationRows(rows)
      setSavedSnapshots(locationRowSnapshotsFromEditRows(dataRows))
      setEditRows(
        ensureTrailingBlankRow(dataRows, isBlankLocationRow, () => emptyEditLocationRow())
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

  const getFilterValue = useCallback((row: EditLocationRow, col: string) => {
    switch (col) {
      case 'code':
        return toFilterCellValue(row.location_cd)
      case 'name':
        return toFilterCellValue(row.location_nm)
      case 'type':
        return toFilterCellValue(
          row.locationtyp_id === ''
            ? ''
            : (locationTypLabelById.get(row.locationtyp_id) ?? '')
        )
      default:
        return masterDateFilterValue(row, col)
    }
  }, [locationTypLabelById])

  const exportValue = useCallback(
    (row: EditLocationRow, col: string) => {
      switch (col) {
        case 'code':
          return row.location_cd
        case 'name':
          return row.location_nm
        case 'type':
          return row.locationtyp_id === ''
            ? ''
            : (locationTypLabelById.get(row.locationtyp_id) ?? '')
        default:
          return masterDateExportValue(row, col)
      }
    },
    [locationTypLabelById]
  )

  const deleteRowsRef = useRef<() => void>(() => {})

  const grid = useExcelLikeGrid({
    columns: masterLocationEditColumns,
    rows: editRows,
    getFilterValue,
    excelExport: {
      sheetName: 'Locations',
      filenamePrefix: 'locations',
      getExportValue: exportValue,
    },
    excelImport: {
      applyParsedRows: async (parsed) => {
        beginToolbarAction()
        const { rows, updated, added } = mergeLocationImportRows(
          parsed,
          editRows,
          locationtyps
        )
        setEditRows(
          ensureTrailingBlankRow(rows, isBlankLocationRow, () => emptyEditLocationRow())
        )
        if (updated + added > 0) {
          setSuccess(`Import: ${added} added, ${updated} updated in grid. Click Update to persist.`)
        } else {
          setSuccess('No rows were imported from the file.')
        }
      },
    },
    rowDelete: {
      label: 'Delete row',
      getSelectedCount: () => selectedKeys.size,
      onDelete: () => deleteRowsRef.current(),
    },
  })

  const selectableRows = useMemo(
    () => selectableDisplayRows(grid.displayRows, isBlankLocationRow),
    [grid.displayRows]
  )

  const rowNav = useGridRowKeyboardNav({
    wrapId: 'masters-locations',
    displayRows: grid.displayRows,
    isBlankRow: isBlankLocationRow,
  })

  const selectedCount = useMemo(
    () => selectedSelectableCount(selectableRows, selectedKeys, (row) => row.key),
    [selectableRows, selectedKeys]
  )

  const updateRow = (key: string, patch: Partial<EditLocationRow>) => {
    clearToolbarFeedback()
    setEditRows((rows) =>
      updateRowWithTrailingBlank(rows, key, patch, isBlankLocationRow, () =>
        emptyEditLocationRow()
      )
    )
  }

  const focusCodeCell = (rowKey: string) => {
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-loc-grid-cell="${rowKey}:code"]`)
        ?.focus()
    })
  }

  const commitSentinelRowOnEnter = (row: EditLocationRow) => {
    if (editRows[editRows.length - 1]?.key !== row.key) return
    if (isBlankLocationRow(row)) return
    const newBlank = emptyEditLocationRow()
    setEditRows((rows) =>
      ensureTrailingBlankRow(rows, isBlankLocationRow, () => newBlank)
    )
    focusCodeCell(newBlank.key)
  }

  const handleCellKeyDown = (e: React.KeyboardEvent, row: EditLocationRow) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (editRows[editRows.length - 1]?.key !== row.key) return
    commitSentinelRowOnEnter(row)
  }

  const removeSelectedFromGrid = () => {
    if (selectedKeys.size === 0) return
    setEditRows((rows) =>
      removeSelectedGridRows(rows, selectedKeys, isBlankLocationRow, () => emptyEditLocationRow())
    )
    setSelectedKeys(new Set())
  }
  deleteRowsRef.current = removeSelectedFromGrid

  const deleteSelected = async () => {
    if (selectedKeys.size === 0) return
    if (!confirm(deleteSelectedConfirm(selectedKeys.size, 'location(s)'))) return
    beginToolbarAction()
    setSubmitting(true)
    setError(null)
    try {
      const selected = editRows.filter((row) => selectedKeys.has(row.key))
      const toDelete = selected.filter((row) => row.location_id != null)
      for (const row of toDelete) {
        await api.deleteLocation(row.location_id!)
      }
      setEditRows((rows) =>
        removeSelectedGridRows(rows, selectedKeys, isBlankLocationRow, () => emptyEditLocationRow())
      )
      setSelectedKeys(new Set())
      setSuccess(toDelete.length > 0 ? 'Location(s) deleted.' : 'Row(s) removed.')
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
      (row) => row.location_id ?? null
    )
    const active = editRows.filter(isActiveLocationRow)
    const incomplete = editRows.filter(
      (row) => !isBlankLocationRow(row) && !isActiveLocationRow(row)
    )
    if (incomplete.length > 0) {
      setRowError('Enter Location Code and Location Type for each row, or clear empty rows.')
      return
    }
    if (active.length === 0 && pendingDeleteIds.length === 0) {
      setRowError('Add at least one location row.')
      return
    }
    const codes = active.map((row) => row.location_cd.trim().toLowerCase())
    if (new Set(codes).size !== codes.length) {
      setRowError('Duplicate location codes in the grid.')
      return
    }

    const toSave = changedActiveRows(
      editRows,
      savedSnapshots,
      isActiveLocationRow,
      (row) => row.location_id,
      (row) => (isActiveLocationRow(row) ? buildLocationPayload(row) : null)
    )
    if (toSave.length === 0 && pendingDeleteIds.length === 0) {
      setSuccess(savedCountMessage(0, 'location'))
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      for (const id of pendingDeleteIds) {
        await api.deleteLocation(id)
      }
      for (const row of toSave) {
        const payload = buildLocationPayload(row)
        if (row.location_id != null) {
          await api.updateLocation(row.location_id, payload)
        } else {
          await api.createLocation(payload)
        }
      }
      setSuccess(
        masterPersistResultMessage(toSave.length, pendingDeleteIds.length, 'location')
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
        gridId="masters-locations-edit-v1"
        title="Locations"
        columns={masterLocationEditColumns}
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
        gridRowNavWrapId="masters-locations"
        onLayoutReady={grid.onLayoutReady}
        onGridContextMenu={grid.openContextMenu}
        layoutOptions={{ pinFirst: ['rownum', 'select'] }}
        rowCount={grid.displayRows.length}
        {...grid.tableProps}
      >
        {(layout) => (
          <tbody>
            {grid.displayRows.map((row, index) => {
              const isSentinel = isBlankLocationRow(row)
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
                              aria-label={`Select ${row.location_cd || 'row'}`}
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
                              value={row.location_cd}
                              placeholder={isSentinel ? '' : 'Location Code'}
                              data-loc-grid-cell={`${row.key}:code`}
                              onChange={(e) =>
                                updateRow(row.key, { location_cd: e.target.value })
                              }
                              onKeyDown={(e) => handleCellKeyDown(e, row)}
                            />
                          </td>
                        )
                      case 'name':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <input
                              className="erp-grid-input"
                              value={row.location_nm}
                              placeholder={isSentinel ? '' : 'Location Name'}
                              data-loc-grid-cell={`${row.key}:name`}
                              onChange={(e) =>
                                updateRow(row.key, { location_nm: e.target.value })
                              }
                              onKeyDown={(e) => handleCellKeyDown(e, row)}
                            />
                          </td>
                        )
                      case 'type':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <select
                              className={`erp-grid-input${
                                row.locationtyp_id === '' ? ' erp-input-empty' : ''
                              }`}
                              value={row.locationtyp_id}
                              aria-label="Location Type"
                              data-loc-grid-cell={`${row.key}:type`}
                              onChange={(e) =>
                                updateRow(row.key, {
                                  locationtyp_id:
                                    e.target.value === '' ? '' : Number(e.target.value),
                                })
                              }
                              onKeyDown={(e) => handleCellKeyDown(e, row)}
                            >
                              <option value="">{isSentinel ? '' : 'Location Type'}</option>
                              {locationtyps.map((t) => (
                                <option key={t.locationtyp_id} value={t.locationtyp_id}>
                                  {locationTypDropdownLabel(t)}
                                </option>
                              ))}
                            </select>
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
