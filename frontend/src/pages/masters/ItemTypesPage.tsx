import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { GridRowNumCell } from '../../components/GridRowNumCell'
import { masterItemTypEditColumns } from '../../components/erp/masterGridColumns'
import { useExcelLikeGrid } from '../../hooks/useExcelLikeGrid'
import { useGridRowKeyboardNav } from '../../hooks/useGridRowKeyboardNav'
import { useMasterGridToolbarFeedback } from '../../hooks/useMasterGridToolbarFeedback'
import {
  buildItemTypPayload,
  emptyEditItemTypRow,
  isActiveItemTypRow,
  isBlankItemTypRow,
  itemTypRowSnapshotsFromEditRows,
  listRowsToEditItemTypRows,
  type EditItemTypRow,
  type ItemTypRowSnapshot,
} from '../../utils/itemTypMasterEdit'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../../utils/gridTrailingBlankRow'
import { toFilterCellValue } from '../../utils/gridColumnFilter'
import { mergeItemTypImportRows } from '../../utils/itemTypExcelImport'
import { normalizeItemTypColor } from '../../utils/itemTypColor'
import type { LocationTyp } from '../../types/masters'
import { locationTypDropdownLabel } from '../../utils/locationTypMasterEdit'
import { GridRowSelectButtons } from '../../components/GridRowSelectButtons'
import { MasterGridToolbarActions } from '../../components/masters/MasterGridToolbar'
import { ItemTypColorCell } from '../../components/masters/ItemTypColorCell'
import { useRefreshMasterCatalogAfterSave } from '../../context/MasterCatalogContext'
import { useItemTypColors } from '../../context/ItemTypColorContext'
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

export function ItemTypesPage() {
  const refreshMasterCatalog = useRefreshMasterCatalogAfterSave()
  const { reload: reloadItemTypColors } = useItemTypColors()
  const [editRows, setEditRows] = useState<EditItemTypRow[]>([])
  const [savedSnapshots, setSavedSnapshots] = useState<Map<number, ItemTypRowSnapshot>>(
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
      const [rows, locRows] = await Promise.all([
        api.listItemtyps(),
        api.listLocationtypsMaster(),
      ])
      setLocationtyps(locRows)
      const dataRows = listRowsToEditItemTypRows(rows)
      setSavedSnapshots(itemTypRowSnapshotsFromEditRows(dataRows))
      setEditRows(
        ensureTrailingBlankRow(dataRows, isBlankItemTypRow, () => emptyEditItemTypRow())
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

  const getFilterValue = useCallback((row: EditItemTypRow, col: string) => {
    switch (col) {
      case 'code':
        return toFilterCellValue(row.itemtyp_cd)
      case 'name':
        return toFilterCellValue(row.itemtyp_nm)
      case 'locationtyp':
        return toFilterCellValue(
          row.locationtyp_id === ''
            ? ''
            : (locationTypLabelById.get(row.locationtyp_id) ?? '')
        )
      case 'color':
        return toFilterCellValue(row.itemtyp_color)
      default:
        return masterDateFilterValue(row, col)
    }
  }, [locationTypLabelById])

  const itemTypExportValue = useCallback(
    (row: EditItemTypRow, col: string) => {
      switch (col) {
        case 'code':
          return row.itemtyp_cd
        case 'name':
          return row.itemtyp_nm
        case 'locationtyp':
          return row.locationtyp_id === ''
            ? ''
            : (locationTypLabelById.get(row.locationtyp_id) ?? '')
        case 'color':
          return row.itemtyp_color
        default:
          return masterDateExportValue(row, col)
      }
    },
    [locationTypLabelById]
  )

  const deleteRowsRef = useRef<() => void>(() => {})

  const grid = useExcelLikeGrid({
    columns: masterItemTypEditColumns,
    rows: editRows,
    getFilterValue,
    rowDelete: {
      label: 'Delete row',
      getSelectedCount: () => selectedKeys.size,
      onDelete: () => deleteRowsRef.current(),
    },
    excelExport: {
      sheetName: 'Item Types',
      filenamePrefix: 'item-types',
      getExportValue: itemTypExportValue,
    },
    excelImport: {
      applyParsedRows: async (parsed) => {
        beginToolbarAction()
        const { rows, updated, added } = mergeItemTypImportRows(
          parsed,
          editRows,
          locationtyps
        )
        setEditRows(
          ensureTrailingBlankRow(rows, isBlankItemTypRow, () => emptyEditItemTypRow())
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
    () => selectableDisplayRows(grid.displayRows, isBlankItemTypRow),
    [grid.displayRows]
  )

  const rowNav = useGridRowKeyboardNav({
    wrapId: 'masters-item-types',
    displayRows: grid.displayRows,
    isBlankRow: isBlankItemTypRow,
  })

  const selectedCount = useMemo(
    () => selectedSelectableCount(selectableRows, selectedKeys, (row) => row.key),
    [selectableRows, selectedKeys]
  )

  const updateRow = (key: string, patch: Partial<EditItemTypRow>) => {
    clearToolbarFeedback()
    setEditRows((rows) =>
      updateRowWithTrailingBlank(
        rows,
        key,
        patch,
        isBlankItemTypRow,
        () => emptyEditItemTypRow()
      )
    )
  }

  const focusCodeCell = (rowKey: string) => {
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-itemtyp-grid-cell="${rowKey}:code"]`)
        ?.focus()
    })
  }

  const commitSentinelRowOnEnter = (row: EditItemTypRow) => {
    if (editRows[editRows.length - 1]?.key !== row.key) return
    if (isBlankItemTypRow(row)) return

    const newBlank = emptyEditItemTypRow()
    setEditRows((rows) =>
      ensureTrailingBlankRow(rows, isBlankItemTypRow, () => newBlank)
    )
    focusCodeCell(newBlank.key)
  }

  const handleCellKeyDown = (e: React.KeyboardEvent, row: EditItemTypRow) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (editRows[editRows.length - 1]?.key !== row.key) return
    commitSentinelRowOnEnter(row)
  }

  const removeSelectedFromGrid = () => {
    if (selectedKeys.size === 0) return
    setEditRows((rows) =>
      removeSelectedGridRows(rows, selectedKeys, isBlankItemTypRow, () => emptyEditItemTypRow())
    )
    setSelectedKeys(new Set())
  }
  deleteRowsRef.current = removeSelectedFromGrid

  const deleteSelected = async () => {
    if (selectedKeys.size === 0) return
    if (!confirm(deleteSelectedConfirm(selectedKeys.size, 'item type(s)'))) return
    beginToolbarAction()
    setSubmitting(true)
    setError(null)
    try {
      const selected = editRows.filter((row) => selectedKeys.has(row.key))
      const toDelete = selected.filter((row) => row.itemtyp_id != null)
      for (const row of toDelete) {
        await api.deleteItemTyp(row.itemtyp_id!)
      }
      setEditRows((rows) =>
        removeSelectedGridRows(rows, selectedKeys, isBlankItemTypRow, () => emptyEditItemTypRow())
      )
      setSelectedKeys(new Set())
      setSuccess(
        toDelete.length > 0 ? 'Item type(s) deleted.' : 'Row(s) removed.'
      )
      if (toDelete.length > 0) {
        await load()
        await reloadItemTypColors()
      }
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
      (row) => row.itemtyp_id ?? null
    )
    const active = editRows.filter(isActiveItemTypRow)
    const incompletePersisted = editRows.filter(
      (row) => row.itemtyp_id != null && !isActiveItemTypRow(row)
    )
    if (incompletePersisted.length > 0) {
      setRowError(
        'Complete Item Type Code, Name, and Location Type for saved rows, or delete those rows.'
      )
      return
    }
    const invalidColorRow = active.find((row) => {
      const raw = row.itemtyp_color.trim()
      return raw.length > 0 && normalizeItemTypColor(row.itemtyp_color) === ''
    })
    if (invalidColorRow) {
      setRowError(
        `Invalid color on "${invalidColorRow.itemtyp_cd}". Enter 6 hex digits (e.g. FF0000) or clear the field.`
      )
      return
    }
    if (active.length === 0 && pendingDeleteIds.length === 0) {
      setRowError('Add at least one item type row.')
      return
    }
    const codes = active.map((row) => row.itemtyp_cd.trim().toLowerCase())
    if (new Set(codes).size !== codes.length) {
      setRowError('Duplicate item type codes in the grid.')
      return
    }

    const toSave = changedActiveRows(
      editRows,
      savedSnapshots,
      isActiveItemTypRow,
      (row) => row.itemtyp_id,
      (row) => (isActiveItemTypRow(row) ? buildItemTypPayload(row) : null)
    )
    if (toSave.length === 0 && pendingDeleteIds.length === 0) {
      setSuccess(savedCountMessage(0, 'item type'))
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      for (const id of pendingDeleteIds) {
        await api.deleteItemTyp(id)
      }
      for (const row of toSave) {
        const payload = buildItemTypPayload(row)
        if (row.itemtyp_id != null) {
          await api.updateItemTyp(row.itemtyp_id, payload)
        } else {
          await api.createItemTyp(payload)
        }
      }
      setSuccess(
        masterPersistResultMessage(toSave.length, pendingDeleteIds.length, 'item type')
      )
      if (pendingDeleteIds.length > 0 || toSave.length > 0) {
        refreshMasterCatalog()
        await load()
        await reloadItemTypColors()
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
        gridId="masters-itemtyps-edit-v2"
        title="Item Types"
        columns={masterItemTypEditColumns}
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
        gridRowNavWrapId="masters-item-types"
        onLayoutReady={grid.onLayoutReady}
        onGridContextMenu={grid.openContextMenu}
        layoutOptions={{ pinFirst: ['rownum', 'select'] }}
        rowCount={grid.displayRows.length}
        {...grid.tableProps}
      >
        {(layout) => (
          <tbody>
            {grid.displayRows.map((row, index) => {
              const isSentinel = isBlankItemTypRow(row)
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
                              aria-label={`Select ${row.itemtyp_cd || 'row'}`}
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
                              value={row.itemtyp_cd}
                              placeholder={isSentinel ? '' : 'RM'}
                              data-itemtyp-grid-cell={`${row.key}:code`}
                              onChange={(e) =>
                                updateRow(row.key, { itemtyp_cd: e.target.value })
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
                              value={row.itemtyp_nm}
                              placeholder={isSentinel ? '' : 'Raw Material'}
                              data-itemtyp-grid-cell={`${row.key}:name`}
                              onChange={(e) =>
                                updateRow(row.key, { itemtyp_nm: e.target.value })
                              }
                              onKeyDown={(e) => handleCellKeyDown(e, row)}
                            />
                          </td>
                        )
                      case 'locationtyp':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <select
                              className={`erp-grid-input${
                                row.locationtyp_id === '' ? ' erp-input-empty' : ''
                              }`}
                              value={row.locationtyp_id}
                              aria-label="Location Type"
                              data-itemtyp-grid-cell={`${row.key}:locationtyp`}
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
                      case 'color':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit erp-col-color">
                            <ItemTypColorCell
                              value={row.itemtyp_color}
                              disabled={isSentinel && !row.itemtyp_cd.trim()}
                              onChange={(itemtyp_color) =>
                                updateRow(row.key, { itemtyp_color })
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
