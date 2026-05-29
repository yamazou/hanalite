import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { GridRowNumCell } from '../../components/GridRowNumCell'
import { masterLocationEditColumns } from '../../components/erp/masterGridColumns'
import { MasterGridToolbar } from '../../components/masters/MasterGridToolbar'
import { useExcelLikeGrid } from '../../hooks/useExcelLikeGrid'
import type { LocationMaster } from '../../types/masters'
import {
  buildLocationPayload,
  emptyEditLocationRow,
  isActiveLocationRow,
  isBlankLocationRow,
  listRowsToEditLocationRows,
  type EditLocationRow,
} from '../../utils/locationMasterEdit'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../../utils/gridTrailingBlankRow'
import { toFilterCellValue } from '../../utils/gridColumnFilter'
import { mergeLocationImportRows } from '../../utils/locationExcelImport'

const LOCATION_TYPES: LocationMaster['location_type'][] = ['RM', 'Process', 'NG', 'FG']

export function LocationsPage() {
  const [editRows, setEditRows] = useState<EditLocationRow[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await api.listLocationsMaster()
      setEditRows(
        ensureTrailingBlankRow(
          listRowsToEditLocationRows(rows),
          isBlankLocationRow,
          () => emptyEditLocationRow()
        )
      )
      setSelectedKeys(new Set())
      setRowError(null)
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
        return toFilterCellValue(row.location_type)
      default:
        return toFilterCellValue('')
    }
  }, [])

  const exportValue = useCallback((row: EditLocationRow, col: string) => {
    switch (col) {
      case 'code':
        return row.location_cd
      case 'name':
        return row.location_nm
      case 'type':
        return row.location_type
      default:
        return ''
    }
  }, [])

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
        const { rows, updated, added } = mergeLocationImportRows(parsed, editRows)
        setEditRows(
          ensureTrailingBlankRow(rows, isBlankLocationRow, () => emptyEditLocationRow())
        )
        if (updated + added > 0) {
          setSuccess(`Import: ${added} added, ${updated} updated in grid. Click Save to persist.`)
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

  const updateRow = (key: string, patch: Partial<EditLocationRow>) => {
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

  const deleteSelected = async () => {
    if (selectedKeys.size === 0) return
    if (!confirm('Delete selected location(s)?')) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const selected = editRows.filter((row) => selectedKeys.has(row.key))
      const toDelete = selected.filter((row) => row.location_id != null)
      const toDrop = new Set(selected.map((row) => row.key))
      for (const row of toDelete) {
        await api.deleteLocation(row.location_id!)
      }
      setEditRows((rows) =>
        ensureTrailingBlankRow(
          rows.filter((row) => !toDrop.has(row.key)),
          isBlankLocationRow,
          () => emptyEditLocationRow()
        )
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
  deleteRowsRef.current = () => void deleteSelected()

  const handleSave = async () => {
    const active = editRows.filter(isActiveLocationRow)
    const incomplete = editRows.filter(
      (row) => !isBlankLocationRow(row) && !isActiveLocationRow(row)
    )
    if (incomplete.length > 0) {
      setRowError('Enter Code, Name, and Type for each row, or clear empty rows.')
      return
    }
    if (active.length === 0) {
      setRowError('Add at least one location row.')
      return
    }
    const codes = active.map((row) => row.location_cd.trim().toLowerCase())
    if (new Set(codes).size !== codes.length) {
      setRowError('Duplicate location codes in the grid.')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    setRowError(null)
    try {
      for (const row of active) {
        const payload = buildLocationPayload(row)
        if (row.location_id != null) {
          await api.updateLocation(
            row.location_id,
            payload.location_cd,
            payload.location_nm,
            payload.location_type
          )
        } else {
          await api.createLocation(
            payload.location_cd,
            payload.location_nm,
            payload.location_type
          )
        }
      }
      setSuccess('Locations saved.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ErpScreen error={error} success={success}>
      {grid.filterMenuElement}
      {grid.contextMenuElement}
      <ErpGridPanel
        gridId="masters-locations-edit-v1"
        title="Locations"
        columns={masterLocationEditColumns}
        loading={loading}
        isEmpty={false}
        onRefresh={() => void load()}
        toolbarLeft={
          <MasterGridToolbar
            displayRowCount={grid.displayRows.length}
            submitting={submitting}
            rowError={rowError}
            onSelectAll={() =>
              setSelectedKeys(new Set(grid.displayRows.map((row) => row.key)))
            }
            onClearSelection={() => setSelectedKeys(new Set())}
            onSave={() => void handleSave()}
          />
        }
        showSaveGridButton
        panelClassName="erp-panel-grow"
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
                  className={`erp-grid-row-editing${index % 2 === 1 ? ' row-alt' : ''}${
                    selectedKeys.has(row.key) ? ' selected' : ''
                  }${isSentinel ? ' erp-grid-row-sentinel' : ''}`}
                >
                  {layout.orderedColumns.map((col) => {
                    switch (col.key) {
                      case 'rownum':
                        return <GridRowNumCell key={col.key} index={index} />
                      case 'select':
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
                              className={`erp-grid-input${row.location_type === '' ? ' erp-input-empty' : ''}`}
                              value={row.location_type}
                              data-loc-grid-cell={`${row.key}:type`}
                              onChange={(e) =>
                                updateRow(row.key, {
                                  location_type: e.target
                                    .value as LocationMaster['location_type'],
                                })
                              }
                              onKeyDown={(e) => handleCellKeyDown(e, row)}
                            >
                              <option value="" />
                              {LOCATION_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                          </td>
                        )
                      default:
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
