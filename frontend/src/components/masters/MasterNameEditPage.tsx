import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ErpGridPanel } from '../erp/ErpGridPanel'
import { ErpScreen } from '../erp/ErpScreen'
import { GridRowNumCell } from '../GridRowNumCell'
import { masterNameEditColumns } from '../erp/masterGridColumns'
import { useExcelLikeGrid } from '../../hooks/useExcelLikeGrid'
import { useMasterGridToolbarFeedback } from '../../hooks/useMasterGridToolbarFeedback'
import {
  emptyEditNameMasterRow,
  isActiveNameMasterRow,
  isBlankNameMasterRow,
  listRowToEditNameMasterRow,
  nameMasterRowSnapshotsFromEditRows,
  type EditNameMasterRow,
  type NameMasterRowSnapshot,
} from '../../utils/nameMasterEdit'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../../utils/gridTrailingBlankRow'
import { toFilterCellValue } from '../../utils/gridColumnFilter'
import { mergeNameMasterImportRows } from '../../utils/nameMasterExcelImport'
import { GridRowSelectButtons } from '../GridRowSelectButtons'
import { MasterGridToolbarActions } from './MasterGridToolbar'
import {
  changedActiveRows,
  deleteSelectedConfirm,
  masterPersistResultMessage,
  persistedIdsPendingDelete,
  removeSelectedGridRows,
  savedCountMessage,
} from '../../utils/gridRowChange'
import { selectableDisplayRows, selectedSelectableCount } from '../../utils/gridRowSelection'

type NameRecord = { id: number; name: string }

type Props = {
  title: string
  gridId: string
  nameLabel: string
  placeholder?: string
  sheetName: string
  filenamePrefix: string
  loadRecords: () => Promise<NameRecord[]>
  createRecord: (name: string) => Promise<void>
  updateRecord: (id: number, name: string) => Promise<void>
  deleteRecord: (id: number) => Promise<void>
}

function entityLabelsFromTitle(title: string): { plural: string; singular: string } {
  const lower = title.toLowerCase()
  let singular = lower
  if (lower.endsWith('ies')) {
    singular = `${lower.slice(0, -3)}y`
  } else if (lower.endsWith('ses') || lower.endsWith('xes') || lower.endsWith('zes')) {
    singular = lower.slice(0, -2)
  } else if (lower.endsWith('s')) {
    singular = lower.slice(0, -1)
  }
  return { plural: `${singular}(s)`, singular }
}

export function MasterNameEditPage({
  title,
  gridId,
  nameLabel,
  placeholder,
  sheetName,
  filenamePrefix,
  loadRecords,
  createRecord,
  updateRecord,
  deleteRecord,
}: Props) {
  const entityLabels = useMemo(() => entityLabelsFromTitle(title), [title])
  const [editRows, setEditRows] = useState<EditNameMasterRow[]>([])
  const [savedSnapshots, setSavedSnapshots] = useState<Map<number, NameMasterRowSnapshot>>(
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

  const columns = masterNameEditColumns.map((col) =>
    col.key === 'name' ? { ...col, label: nameLabel } : col
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const records = await loadRecords()
      const dataRows = records.map((r) => listRowToEditNameMasterRow(r.id, r.name))
      setSavedSnapshots(nameMasterRowSnapshotsFromEditRows(dataRows))
      setEditRows(
        ensureTrailingBlankRow(dataRows, isBlankNameMasterRow, () => emptyEditNameMasterRow())
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [loadRecords])

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

  const getFilterValue = useCallback(
    (row: EditNameMasterRow, col: string) => {
      if (col === 'name') return toFilterCellValue(row.name)
      return toFilterCellValue('')
    },
    []
  )

  const deleteRowsRef = useRef<() => void>(() => {})

  const grid = useExcelLikeGrid({
    columns,
    rows: editRows,
    getFilterValue,
    rowDelete: {
      label: 'Delete row',
      getSelectedCount: () => selectedKeys.size,
      onDelete: () => deleteRowsRef.current(),
    },
    excelExport: {
      sheetName,
      filenamePrefix,
      getExportValue: (row, col) => (col === 'name' ? row.name : ''),
    },
    excelImport: {
      applyParsedRows: async (parsed) => {
        beginToolbarAction()
        const { rows, updated, added } = mergeNameMasterImportRows(parsed, editRows)
        setEditRows(
          ensureTrailingBlankRow(rows, isBlankNameMasterRow, () => emptyEditNameMasterRow())
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
    () => selectableDisplayRows(grid.displayRows, isBlankNameMasterRow),
    [grid.displayRows]
  )

  const selectedCount = useMemo(
    () => selectedSelectableCount(selectableRows, selectedKeys, (row) => row.key),
    [selectableRows, selectedKeys]
  )

  const updateRow = (key: string, patch: Partial<EditNameMasterRow>) => {
    clearToolbarFeedback()
    setEditRows((rows) =>
      updateRowWithTrailingBlank(rows, key, patch, isBlankNameMasterRow, () =>
        emptyEditNameMasterRow()
      )
    )
  }

  const focusNameCell = (rowKey: string) => {
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-name-master-cell="${rowKey}"]`)
        ?.focus()
    })
  }

  const commitSentinelRowOnEnter = (row: EditNameMasterRow) => {
    if (editRows[editRows.length - 1]?.key !== row.key) return
    if (isBlankNameMasterRow(row)) return
    const newBlank = emptyEditNameMasterRow()
    setEditRows((rows) =>
      ensureTrailingBlankRow(rows, isBlankNameMasterRow, () => newBlank)
    )
    focusNameCell(newBlank.key)
  }

  const handleCellKeyDown = (e: React.KeyboardEvent, row: EditNameMasterRow) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (editRows[editRows.length - 1]?.key !== row.key) return
    commitSentinelRowOnEnter(row)
  }

  const removeSelectedFromGrid = () => {
    if (selectedKeys.size === 0) return
    setEditRows((rows) =>
      removeSelectedGridRows(rows, selectedKeys, isBlankNameMasterRow, () => emptyEditNameMasterRow())
    )
    setSelectedKeys(new Set())
  }
  deleteRowsRef.current = removeSelectedFromGrid

  const deleteSelected = async () => {
    if (selectedKeys.size === 0) return
    if (!confirm(deleteSelectedConfirm(selectedCount, entityLabels.plural))) return
    beginToolbarAction()
    setSubmitting(true)
    setError(null)
    try {
      const selected = editRows.filter((row) => selectedKeys.has(row.key))
      const toDelete = selected.filter((row) => row.record_id != null)
      for (const row of toDelete) {
        await deleteRecord(row.record_id!)
      }
      setEditRows((rows) =>
        removeSelectedGridRows(rows, selectedKeys, isBlankNameMasterRow, () => emptyEditNameMasterRow())
      )
      setSelectedKeys(new Set())
      setSuccess(toDelete.length > 0 ? 'Deleted.' : 'Row(s) removed.')
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
      (row) => row.record_id ?? null
    )
    const active = editRows.filter(isActiveNameMasterRow)
    const incomplete = editRows.filter(
      (row) => !isBlankNameMasterRow(row) && !isActiveNameMasterRow(row)
    )
    if (incomplete.length > 0) {
      setRowError(`Enter ${nameLabel} for each row, or clear empty rows.`)
      return
    }
    if (active.length === 0 && pendingDeleteIds.length === 0) {
      setRowError('Add at least one row.')
      return
    }
    const names = active.map((row) => row.name.trim().toLowerCase())
    if (new Set(names).size !== names.length) {
      setRowError('Duplicate names in the grid.')
      return
    }

    const toSave = changedActiveRows(
      editRows,
      savedSnapshots,
      isActiveNameMasterRow,
      (row) => row.record_id,
      (row) => (isActiveNameMasterRow(row) ? { name: row.name.trim() } : null)
    )
    if (toSave.length === 0 && pendingDeleteIds.length === 0) {
      setSuccess(savedCountMessage(0, entityLabels.singular))
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      for (const id of pendingDeleteIds) {
        await deleteRecord(id)
      }
      for (const row of toSave) {
        const name = row.name.trim()
        if (row.record_id != null) {
          await updateRecord(row.record_id, name)
        } else {
          await createRecord(name)
        }
      }
      setSuccess(
        masterPersistResultMessage(
          toSave.length,
          pendingDeleteIds.length,
          entityLabels.singular
        )
      )
      if (pendingDeleteIds.length > 0 || toSave.length > 0) {
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
        gridId={gridId}
        title={title}
        columns={columns}
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
        onLayoutReady={grid.onLayoutReady}
        onGridContextMenu={grid.openContextMenu}
        layoutOptions={{ pinFirst: ['rownum', 'select'] }}
        rowCount={grid.displayRows.length}
        {...grid.tableProps}
      >
        {(layout) => (
          <tbody>
            {grid.displayRows.map((row, index) => {
              const isSentinel = isBlankNameMasterRow(row)
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
                              aria-label={`Select ${row.name || 'row'}`}
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
                      case 'name':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <input
                              className="erp-grid-input"
                              value={row.name}
                              placeholder={isSentinel ? '' : placeholder ?? nameLabel}
                              data-name-master-cell={row.key}
                              onChange={(e) => updateRow(row.key, { name: e.target.value })}
                              onKeyDown={(e) => handleCellKeyDown(e, row)}
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
