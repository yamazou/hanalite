import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { GridRowNumCell } from '../../components/GridRowNumCell'
import { masterItemTypEditColumns } from '../../components/erp/masterGridColumns'
import { useExcelLikeGrid } from '../../hooks/useExcelLikeGrid'
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
import { GridRowSelectButtons } from '../../components/GridRowSelectButtons'
import { MasterGridToolbarActions } from '../../components/masters/MasterGridToolbar'
import { ItemTypColorCell } from '../../components/masters/ItemTypColorCell'
import { useRefreshMasterCatalogAfterSave } from '../../context/MasterCatalogContext'
import { useItemTypColors } from '../../context/ItemTypColorContext'
import {
  changedActiveRows,
  deleteSelectedConfirm,
  savedCountMessage,
} from '../../utils/gridRowChange'
import { selectableDisplayRows, selectedSelectableCount } from '../../utils/gridRowSelection'

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
  const [success, setSuccess] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const rows = await api.listItemtyps()
      const dataRows = listRowsToEditItemTypRows(rows)
      setSavedSnapshots(itemTypRowSnapshotsFromEditRows(dataRows))
      setEditRows(
        ensureTrailingBlankRow(dataRows, isBlankItemTypRow, () => emptyEditItemTypRow())
      )
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

  const getFilterValue = useCallback((row: EditItemTypRow, col: string) => {
    switch (col) {
      case 'code':
        return toFilterCellValue(row.itemtyp_cd)
      case 'name':
        return toFilterCellValue(row.itemtyp_nm)
      case 'color':
        return toFilterCellValue(row.itemtyp_color)
      default:
        return toFilterCellValue('')
    }
  }, [])

  const itemTypExportValue = useCallback((row: EditItemTypRow, col: string) => {
    switch (col) {
      case 'code':
        return row.itemtyp_cd
      case 'name':
        return row.itemtyp_nm
      case 'color':
        return row.itemtyp_color
      default:
        return ''
    }
  }, [])

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
        const { rows, updated, added } = mergeItemTypImportRows(parsed, editRows)
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

  const selectedCount = useMemo(
    () => selectedSelectableCount(selectableRows, selectedKeys, (row) => row.key),
    [selectableRows, selectedKeys]
  )

  const updateRow = (key: string, patch: Partial<EditItemTypRow>) => {
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

  const deleteSelected = async () => {
    if (selectedKeys.size === 0) return
    if (!confirm(deleteSelectedConfirm(selectedKeys.size, 'item type(s)'))) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const selected = editRows.filter((row) => selectedKeys.has(row.key))
      const toDelete = selected.filter((row) => row.itemtyp_id != null)
      const toDrop = new Set(selected.map((row) => row.key))
      for (const row of toDelete) {
        await api.deleteItemTyp(row.itemtyp_id!)
      }
      setEditRows((rows) =>
        ensureTrailingBlankRow(
          rows.filter((row) => !toDrop.has(row.key)),
          isBlankItemTypRow,
          () => emptyEditItemTypRow()
        )
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
  deleteRowsRef.current = () => void deleteSelected()

  const handleSave = async () => {
    const active = editRows.filter(isActiveItemTypRow)
    const incompletePersisted = editRows.filter(
      (row) => row.itemtyp_id != null && !isActiveItemTypRow(row)
    )
    if (incompletePersisted.length > 0) {
      setRowError('Complete Item Type Code and Name for saved rows, or delete those rows.')
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
    if (active.length === 0) {
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
    if (toSave.length === 0) {
      setRowError(null)
      setSuccess(savedCountMessage(0, 'item type'))
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    setRowError(null)
    try {
      for (const row of toSave) {
        const payload = buildItemTypPayload(row)
        if (row.itemtyp_id != null) {
          await api.updateItemTyp(row.itemtyp_id, payload)
        } else {
          await api.createItemTyp(payload)
        }
      }
      setSuccess(savedCountMessage(toSave.length, 'item type'))
      refreshMasterCatalog()
      await load()
      await reloadItemTypColors()
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
        onRefresh={() => void load()}
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
                  className={`erp-grid-row-editing${index % 2 === 1 ? ' row-alt' : ''}${
                    selectedKeys.has(row.key) ? ' selected' : ''
                  }${isSentinel ? ' erp-grid-row-sentinel' : ''}`}
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
