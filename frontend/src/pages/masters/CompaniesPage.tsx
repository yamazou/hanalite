import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { GridRowNumCell } from '../../components/GridRowNumCell'
import { masterCompanyEditColumns } from '../../components/erp/masterGridColumns'
import { useExcelLikeGrid } from '../../hooks/useExcelLikeGrid'
import { useGridRowKeyboardNav } from '../../hooks/useGridRowKeyboardNav'
import { useMasterGridToolbarFeedback } from '../../hooks/useMasterGridToolbarFeedback'
import {
  buildCompanyPayload,
  companyRowSnapshotsFromEditRows,
  emptyEditCompanyRow,
  isActiveCompanyRow,
  isBlankCompanyRow,
  listRowsToEditCompanyRows,
  type CompanyRowSnapshot,
  type EditCompanyRow,
} from '../../utils/companyMasterEdit'
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

export function CompaniesPage() {
  const [editRows, setEditRows] = useState<EditCompanyRow[]>([])
  const [savedSnapshots, setSavedSnapshots] = useState<Map<number, CompanyRowSnapshot>>(
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
      const rows = await api.listCompaniesMaster()
      const dataRows = listRowsToEditCompanyRows(rows)
      setSavedSnapshots(companyRowSnapshotsFromEditRows(dataRows))
      setEditRows(
        ensureTrailingBlankRow(dataRows, isBlankCompanyRow, () => emptyEditCompanyRow())
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

  const getFilterValue = useCallback((row: EditCompanyRow, col: string) => {
    switch (col) {
      case 'code':
        return toFilterCellValue(row.company_cd)
      case 'name':
        return toFilterCellValue(row.company_nm)
      default:
        return masterDateFilterValue(row, col)
    }
  }, [])

  const exportValue = useCallback((row: EditCompanyRow, col: string) => {
    switch (col) {
      case 'code':
        return row.company_cd
      case 'name':
        return row.company_nm
      default:
        return masterDateExportValue(row, col)
    }
  }, [])

  const deleteRowsRef = useRef<() => void>(() => {})

  const grid = useExcelLikeGrid({
    columns: masterCompanyEditColumns,
    rows: editRows,
    getFilterValue,
    rowDelete: {
      label: 'Delete row',
      getSelectedCount: () => selectedKeys.size,
      onDelete: () => deleteRowsRef.current(),
    },
    excelExport: {
      sheetName: 'Companies',
      filenamePrefix: 'companies',
      getExportValue: exportValue,
    },
  })

  const selectableRows = useMemo(
    () => selectableDisplayRows(grid.displayRows, isBlankCompanyRow),
    [grid.displayRows]
  )

  const rowNav = useGridRowKeyboardNav({
    wrapId: 'masters-companies',
    displayRows: grid.displayRows,
    isBlankRow: isBlankCompanyRow,
  })

  const selectedCount = useMemo(
    () => selectedSelectableCount(selectableRows, selectedKeys, (row) => row.key),
    [selectableRows, selectedKeys]
  )

  const updateRow = (key: string, patch: Partial<EditCompanyRow>) => {
    clearToolbarFeedback()
    setEditRows((rows) =>
      updateRowWithTrailingBlank(rows, key, patch, isBlankCompanyRow, () => emptyEditCompanyRow())
    )
  }

  const removeSelectedFromGrid = () => {
    if (selectedKeys.size === 0) return
    setEditRows((rows) =>
      removeSelectedGridRows(rows, selectedKeys, isBlankCompanyRow, () => emptyEditCompanyRow())
    )
    setSelectedKeys(new Set())
  }
  deleteRowsRef.current = removeSelectedFromGrid

  const deleteSelected = async () => {
    if (selectedKeys.size === 0) return
    if (!confirm(deleteSelectedConfirm(selectedKeys.size, 'company(ies)'))) return
    beginToolbarAction()
    setSubmitting(true)
    setError(null)
    try {
      const selected = editRows.filter((row) => selectedKeys.has(row.key))
      const toDelete = selected.filter((row) => row.co_id != null)
      for (const row of toDelete) {
        await api.deleteCompany(row.co_id!)
      }
      setEditRows((rows) =>
        removeSelectedGridRows(rows, selectedKeys, isBlankCompanyRow, () => emptyEditCompanyRow())
      )
      setSelectedKeys(new Set())
      setSuccess(toDelete.length > 0 ? 'Company(ies) deleted.' : 'Row(s) removed.')
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
      (row) => row.co_id ?? null
    )
    const active = editRows.filter(isActiveCompanyRow)
    const incompletePersisted = editRows.filter(
      (row) => row.co_id != null && !isActiveCompanyRow(row)
    )
    if (incompletePersisted.length > 0) {
      setRowError('Complete Company Code and Name for saved rows, or delete those rows.')
      return
    }
    const codes = active.map((row) => row.company_cd.trim().toLowerCase())
    if (new Set(codes).size !== codes.length) {
      setRowError('Duplicate company codes in the grid.')
      return
    }
    if (active.length === 0 && pendingDeleteIds.length === 0) {
      setRowError('Add at least one company row.')
      return
    }

    const toSave = changedActiveRows(
      editRows,
      savedSnapshots,
      isActiveCompanyRow,
      (row) => row.co_id,
      (row) => (isActiveCompanyRow(row) ? buildCompanyPayload(row) : null)
    )
    if (toSave.length === 0 && pendingDeleteIds.length === 0) {
      setSuccess(savedCountMessage(0, 'company'))
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      for (const id of pendingDeleteIds) {
        await api.deleteCompany(id)
      }
      for (const row of toSave) {
        const payload = buildCompanyPayload(row)
        if (row.co_id != null) {
          await api.updateCompany(row.co_id, payload)
        } else {
          await api.createCompany(payload)
        }
      }
      setSuccess(
        masterPersistResultMessage(toSave.length, pendingDeleteIds.length, 'company')
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
        gridId="masters-companies-edit"
        title="Companies"
        columns={masterCompanyEditColumns}
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
        gridRowNavWrapId="masters-companies"
        onLayoutReady={grid.onLayoutReady}
        onGridContextMenu={grid.openContextMenu}
        layoutOptions={{ pinFirst: ['rownum', 'select'] }}
        rowCount={grid.displayRows.length}
        {...grid.tableProps}
      >
        {(layout) => (
          <tbody>
            {grid.displayRows.map((row, index) => {
              const isSentinel = isBlankCompanyRow(row)
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
                              aria-label={`Select ${row.company_cd || 'row'}`}
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
                              value={row.company_cd}
                              readOnly={row.co_id != null}
                              placeholder={gridCellPlaceholder('DEMO', isSentinel)}
                              onChange={(e) =>
                                updateRow(row.key, { company_cd: e.target.value })
                              }
                            />
                          </td>
                        )
                      case 'name':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <input
                              className="erp-grid-input"
                              value={row.company_nm}
                              placeholder={gridCellPlaceholder('', isSentinel)}
                              onChange={(e) =>
                                updateRow(row.key, { company_nm: e.target.value })
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
