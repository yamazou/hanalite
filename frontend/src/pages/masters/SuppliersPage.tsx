import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { GridRowNumCell } from '../../components/GridRowNumCell'
import { masterSupplierEditColumns } from '../../components/erp/masterGridColumns'
import { useExcelLikeGrid } from '../../hooks/useExcelLikeGrid'
import {
  buildSupplierPayload,
  emptyEditSupplierRow,
  isActiveSupplierRow,
  isBlankSupplierRow,
  listRowsToEditSupplierRows,
  type EditSupplierRow,
} from '../../utils/supplierMasterEdit'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../../utils/gridTrailingBlankRow'
import { toFilterCellValue } from '../../utils/gridColumnFilter'
import { mergeSupplierImportRows } from '../../utils/supplierExcelImport'
import { gridCellPlaceholder } from '../../utils/gridPlaceholder'
import { GridRowSelectButtons } from '../../components/GridRowSelectButtons'
import { MasterGridToolbar } from '../../components/masters/MasterGridToolbar'
import { useRefreshMasterCatalogAfterSave } from '../../context/MasterCatalogContext'

export function SuppliersPage() {
  const refreshMasterCatalog = useRefreshMasterCatalogAfterSave()
  const [editRows, setEditRows] = useState<EditSupplierRow[]>([])
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
      const rows = await api.listSuppliersMaster()
      setEditRows(
        ensureTrailingBlankRow(
          listRowsToEditSupplierRows(rows),
          isBlankSupplierRow,
          () => emptyEditSupplierRow()
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

  const getFilterValue = useCallback((row: EditSupplierRow, col: string) => {
    switch (col) {
      case 'code':
        return toFilterCellValue(row.suppliers_cd)
      case 'name':
        return toFilterCellValue(row.suppliers_nm)
      default:
        return toFilterCellValue('')
    }
  }, [])

  const exportValue = useCallback((row: EditSupplierRow, col: string) => {
    switch (col) {
      case 'code':
        return row.suppliers_cd
      case 'name':
        return row.suppliers_nm
      default:
        return ''
    }
  }, [])

  const deleteRowsRef = useRef<() => void>(() => {})

  const grid = useExcelLikeGrid({
    columns: masterSupplierEditColumns,
    rows: editRows,
    getFilterValue,
    rowDelete: {
      label: 'Delete row',
      getSelectedCount: () => selectedKeys.size,
      onDelete: () => deleteRowsRef.current(),
    },
    excelExport: {
      sheetName: 'Suppliers',
      filenamePrefix: 'suppliers',
      getExportValue: exportValue,
    },
    excelImport: {
      applyParsedRows: async (parsed) => {
        const { rows, updated, added } = mergeSupplierImportRows(parsed, editRows)
        setEditRows(
          ensureTrailingBlankRow(rows, isBlankSupplierRow, () => emptyEditSupplierRow())
        )
        if (updated + added > 0) {
          setSuccess(`Import: ${added} added, ${updated} updated in grid. Click Save to persist.`)
        } else {
          setSuccess('No rows were imported from the file.')
        }
      },
    },
  })

  const updateRow = (key: string, patch: Partial<EditSupplierRow>) => {
    setEditRows((rows) =>
      updateRowWithTrailingBlank(rows, key, patch, isBlankSupplierRow, () => emptyEditSupplierRow())
    )
  }

  const deleteSelected = async () => {
    if (selectedKeys.size === 0) return
    if (!confirm('Delete selected supplier(s)?')) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const selected = editRows.filter((row) => selectedKeys.has(row.key))
      const toDelete = selected.filter((row) => row.suppliers_id != null)
      const toDrop = new Set(selected.map((row) => row.key))
      for (const row of toDelete) {
        await api.deleteSupplier(row.suppliers_id!)
      }
      setEditRows((rows) =>
        ensureTrailingBlankRow(
          rows.filter((row) => !toDrop.has(row.key)),
          isBlankSupplierRow,
          () => emptyEditSupplierRow()
        )
      )
      setSelectedKeys(new Set())
      setSuccess(toDelete.length > 0 ? 'Supplier(s) deleted.' : 'Row(s) removed.')
      if (toDelete.length > 0) await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSubmitting(false)
    }
  }
  deleteRowsRef.current = () => void deleteSelected()

  const handleSave = async () => {
    const active = editRows.filter(isActiveSupplierRow)
    const incompletePersisted = editRows.filter(
      (row) => row.suppliers_id != null && !isActiveSupplierRow(row)
    )
    if (incompletePersisted.length > 0) {
      setRowError('Complete Supplier Code and Name for saved rows, or delete those rows.')
      return
    }
    const codes = active.map((row) => row.suppliers_cd.trim().toLowerCase())
    if (new Set(codes).size !== codes.length) {
      setRowError('Duplicate supplier codes in the grid.')
      return
    }
    if (active.length === 0) {
      setRowError('Add at least one supplier row.')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    setRowError(null)
    try {
      for (const row of active) {
        const payload = buildSupplierPayload(row)
        if (row.suppliers_id != null) {
          await api.updateSupplier(row.suppliers_id, payload)
        } else {
          await api.createSupplier(payload)
        }
      }
      setSuccess('Suppliers saved.')
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
        gridId="masters-suppliers-edit-v2"
        title="Suppliers"
        columns={masterSupplierEditColumns}
        loading={loading}
        isEmpty={false}
        onRefresh={() => void load()}
        selectColumnHeader={
          <GridRowSelectButtons
            rowCount={grid.displayRows.length}
            selectedCount={selectedKeys.size}
            onSelectAll={() =>
              setSelectedKeys(new Set(grid.displayRows.map((row) => row.key)))
            }
            onClearSelection={() => setSelectedKeys(new Set())}
          />
        }
        toolbarLeft={
          <MasterGridToolbar
            submitting={submitting}
            rowError={rowError}
            statusMessage={success}
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
              const isSentinel = isBlankSupplierRow(row)
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
                              aria-label={`Select ${row.suppliers_cd || 'row'}`}
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
                              value={row.suppliers_cd}
                              placeholder={gridCellPlaceholder('SUP01', isSentinel)}
                              onChange={(e) =>
                                updateRow(row.key, { suppliers_cd: e.target.value })
                              }
                            />
                          </td>
                        )
                      case 'name':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <input
                              className="erp-grid-input"
                              value={row.suppliers_nm}
                              placeholder={gridCellPlaceholder('', isSentinel)}
                              onChange={(e) =>
                                updateRow(row.key, { suppliers_nm: e.target.value })
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
