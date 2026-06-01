import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { GridRowNumCell } from '../../components/GridRowNumCell'
import { masterCustomerEditColumns } from '../../components/erp/masterGridColumns'
import { useExcelLikeGrid } from '../../hooks/useExcelLikeGrid'
import {
  buildCustomerPayload,
  customerRowSnapshotsFromEditRows,
  emptyEditCustomerRow,
  isActiveCustomerRow,
  isBlankCustomerRow,
  listRowsToEditCustomerRows,
  type CustomerRowSnapshot,
  type EditCustomerRow,
} from '../../utils/customerMasterEdit'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../../utils/gridTrailingBlankRow'
import { toFilterCellValue } from '../../utils/gridColumnFilter'
import { mergeCustomerImportRows } from '../../utils/customerExcelImport'
import { gridCellPlaceholder } from '../../utils/gridPlaceholder'
import { GridRowSelectButtons } from '../../components/GridRowSelectButtons'
import { MasterGridToolbarActions } from '../../components/masters/MasterGridToolbar'
import { useRefreshMasterCatalogAfterSave } from '../../context/MasterCatalogContext'
import {
  changedActiveRows,
  deleteSelectedConfirm,
  removeSelectedGridRows,
  savedCountMessage,
} from '../../utils/gridRowChange'
import { selectableDisplayRows, selectedSelectableCount } from '../../utils/gridRowSelection'

export function CustomersPage() {
  const refreshMasterCatalog = useRefreshMasterCatalogAfterSave()
  const [editRows, setEditRows] = useState<EditCustomerRow[]>([])
  const [savedSnapshots, setSavedSnapshots] = useState<Map<number, CustomerRowSnapshot>>(
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
    try {
      const rows = await api.listCustomersMaster()
      const dataRows = listRowsToEditCustomerRows(rows)
      setSavedSnapshots(customerRowSnapshotsFromEditRows(dataRows))
      setEditRows(
        ensureTrailingBlankRow(dataRows, isBlankCustomerRow, () => emptyEditCustomerRow())
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

  const getFilterValue = useCallback((row: EditCustomerRow, col: string) => {
    switch (col) {
      case 'code':
        return toFilterCellValue(row.customers_cd)
      case 'name':
        return toFilterCellValue(row.customers_nm)
      default:
        return toFilterCellValue('')
    }
  }, [])

  const exportValue = useCallback((row: EditCustomerRow, col: string) => {
    switch (col) {
      case 'code':
        return row.customers_cd
      case 'name':
        return row.customers_nm
      default:
        return ''
    }
  }, [])

  const deleteRowsRef = useRef<() => void>(() => {})

  const grid = useExcelLikeGrid({
    columns: masterCustomerEditColumns,
    rows: editRows,
    getFilterValue,
    rowDelete: {
      label: 'Delete row',
      getSelectedCount: () => selectedKeys.size,
      onDelete: () => deleteRowsRef.current(),
    },
    excelExport: {
      sheetName: 'Customers',
      filenamePrefix: 'customers',
      getExportValue: exportValue,
    },
    excelImport: {
      applyParsedRows: async (parsed) => {
        const { rows, updated, added } = mergeCustomerImportRows(parsed, editRows)
        setEditRows(
          ensureTrailingBlankRow(rows, isBlankCustomerRow, () => emptyEditCustomerRow())
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
    () => selectableDisplayRows(grid.displayRows, isBlankCustomerRow),
    [grid.displayRows]
  )

  const selectedCount = useMemo(
    () => selectedSelectableCount(selectableRows, selectedKeys, (row) => row.key),
    [selectableRows, selectedKeys]
  )

  const updateRow = (key: string, patch: Partial<EditCustomerRow>) => {
    setEditRows((rows) =>
      updateRowWithTrailingBlank(rows, key, patch, isBlankCustomerRow, () => emptyEditCustomerRow())
    )
  }

  const removeSelectedFromGrid = () => {
    if (selectedKeys.size === 0) return
    setEditRows((rows) =>
      removeSelectedGridRows(rows, selectedKeys, isBlankCustomerRow, () => emptyEditCustomerRow())
    )
    setSelectedKeys(new Set())
  }
  deleteRowsRef.current = removeSelectedFromGrid

  const deleteSelected = async () => {
    if (selectedKeys.size === 0) return
    if (!confirm(deleteSelectedConfirm(selectedKeys.size, 'customer(s)'))) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const selected = editRows.filter((row) => selectedKeys.has(row.key))
      const toDelete = selected.filter((row) => row.customers_id != null)
      for (const row of toDelete) {
        await api.deleteCustomer(row.customers_id!)
      }
      setEditRows((rows) =>
        removeSelectedGridRows(rows, selectedKeys, isBlankCustomerRow, () => emptyEditCustomerRow())
      )
      setSelectedKeys(new Set())
      setSuccess(toDelete.length > 0 ? 'Customer(s) deleted.' : 'Row(s) removed.')
      if (toDelete.length > 0) await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSave = async () => {
    const active = editRows.filter(isActiveCustomerRow)
    const incompletePersisted = editRows.filter(
      (row) => row.customers_id != null && !isActiveCustomerRow(row)
    )
    if (incompletePersisted.length > 0) {
      setRowError('Complete Customer Code and Name for saved rows, or delete those rows.')
      return
    }
    const codes = active.map((row) => row.customers_cd.trim().toLowerCase())
    if (new Set(codes).size !== codes.length) {
      setRowError('Duplicate customer codes in the grid.')
      return
    }
    if (active.length === 0) {
      setRowError('Add at least one customer row.')
      return
    }

    const toSave = changedActiveRows(
      editRows,
      savedSnapshots,
      isActiveCustomerRow,
      (row) => row.customers_id,
      (row) => (isActiveCustomerRow(row) ? buildCustomerPayload(row) : null)
    )
    if (toSave.length === 0) {
      setRowError(null)
      setSuccess(savedCountMessage(0, 'customer'))
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    setRowError(null)
    try {
      for (const row of toSave) {
        const payload = buildCustomerPayload(row)
        if (row.customers_id != null) {
          await api.updateCustomer(row.customers_id, payload)
        } else {
          await api.createCustomer(payload)
        }
      }
      setSuccess(savedCountMessage(toSave.length, 'customer'))
      refreshMasterCatalog()
      await load()
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
        gridId="masters-customers-edit-v2"
        title="Customers"
        columns={masterCustomerEditColumns}
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
              const isSentinel = isBlankCustomerRow(row)
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
                              aria-label={`Select ${row.customers_cd || 'row'}`}
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
                              value={row.customers_cd}
                              placeholder={gridCellPlaceholder('CUS01', isSentinel)}
                              onChange={(e) =>
                                updateRow(row.key, { customers_cd: e.target.value })
                              }
                            />
                          </td>
                        )
                      case 'name':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <input
                              className="erp-grid-input"
                              value={row.customers_nm}
                              placeholder={gridCellPlaceholder('', isSentinel)}
                              onChange={(e) =>
                                updateRow(row.key, { customers_nm: e.target.value })
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
