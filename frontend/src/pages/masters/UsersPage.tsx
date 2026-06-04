import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import type { CompanyMaster } from '../../types/auth'
import { ErpGridPanel } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { GridRowNumCell } from '../../components/GridRowNumCell'
import { masterUserEditColumns } from '../../components/erp/masterGridColumns'
import { useExcelLikeGrid } from '../../hooks/useExcelLikeGrid'
import { useGridRowKeyboardNav } from '../../hooks/useGridRowKeyboardNav'
import { useMasterGridToolbarFeedback } from '../../hooks/useMasterGridToolbarFeedback'
import {
  buildUserCreatePayload,
  buildUserUpdatePayload,
  emptyEditUserRow,
  isActiveUserRow,
  isBlankUserRow,
  listRowsToEditUserRows,
  userRowChanged,
  userRowSnapshotsFromEditRows,
  type EditUserRow,
  type UserRowSnapshot,
} from '../../utils/userMasterEdit'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../../utils/gridTrailingBlankRow'
import { toFilterCellValue } from '../../utils/gridColumnFilter'
import { gridCellPlaceholder } from '../../utils/gridPlaceholder'
import { GridRowSelectButtons } from '../../components/GridRowSelectButtons'
import { MasterGridToolbarActions } from '../../components/masters/MasterGridToolbar'
import {
  deleteSelectedConfirm,
  masterPersistResultMessage,
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

export function UsersPage() {
  const { session } = useAuth()
  const defaultCompanyCd = session?.company_cd ?? ''
  const [companyOptions, setCompanyOptions] = useState<CompanyMaster[]>([])
  const [editRows, setEditRows] = useState<EditUserRow[]>([])
  const [savedSnapshots, setSavedSnapshots] = useState<Map<number, UserRowSnapshot>>(
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
      const rows = await api.listUsersMaster()
      const dataRows = listRowsToEditUserRows(rows)
      setSavedSnapshots(userRowSnapshotsFromEditRows(dataRows))
      setEditRows(
        ensureTrailingBlankRow(dataRows, isBlankUserRow, () =>
          emptyEditUserRow(defaultCompanyCd)
        )
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [defaultCompanyCd])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void (async () => {
      try {
        setCompanyOptions(await api.listCompaniesMaster())
      } catch {
        setCompanyOptions([])
      }
    })()
  }, [])

  useEffect(() => {
    const valid = new Set(editRows.map((row) => row.key))
    setSelectedKeys((prev) => {
      const next = new Set([...prev].filter((key) => valid.has(key)))
      return next.size === prev.size ? prev : next
    })
  }, [editRows])

  const getFilterValue = useCallback((row: EditUserRow, col: string) => {
    switch (col) {
      case 'company':
        return toFilterCellValue(row.company_cd)
      case 'code':
        return toFilterCellValue(row.user_cd)
      case 'name':
        return toFilterCellValue(row.user_nm)
      case 'active':
        return row.is_active ? 'yes' : 'no'
      default:
        return masterDateFilterValue(row, col)
    }
  }, [])

  const exportValue = useCallback((row: EditUserRow, col: string) => {
    switch (col) {
      case 'company':
        return row.company_cd
      case 'code':
        return row.user_cd
      case 'name':
        return row.user_nm
      case 'active':
        return row.is_active ? 'Y' : 'N'
      default:
        return masterDateExportValue(row, col)
    }
  }, [])

  const deleteRowsRef = useRef<() => void>(() => {})

  const grid = useExcelLikeGrid({
    columns: masterUserEditColumns,
    rows: editRows,
    getFilterValue,
    rowDelete: {
      label: 'Delete row',
      getSelectedCount: () => selectedKeys.size,
      onDelete: () => deleteRowsRef.current(),
    },
    excelExport: {
      sheetName: 'Users',
      filenamePrefix: 'users',
      getExportValue: exportValue,
    },
  })

  const selectableRows = useMemo(
    () => selectableDisplayRows(grid.displayRows, isBlankUserRow),
    [grid.displayRows]
  )

  const rowNav = useGridRowKeyboardNav({
    wrapId: 'masters-users',
    displayRows: grid.displayRows,
    isBlankRow: isBlankUserRow,
  })

  const selectedCount = useMemo(
    () => selectedSelectableCount(selectableRows, selectedKeys, (row) => row.key),
    [selectableRows, selectedKeys]
  )

  const updateRow = (key: string, patch: Partial<EditUserRow>) => {
    clearToolbarFeedback()
    setEditRows((rows) =>
      updateRowWithTrailingBlank(rows, key, patch, isBlankUserRow, () =>
        emptyEditUserRow(defaultCompanyCd)
      )
    )
  }

  const removeSelectedFromGrid = () => {
    if (selectedKeys.size === 0) return
    setEditRows((rows) =>
      removeSelectedGridRows(rows, selectedKeys, isBlankUserRow, () => emptyEditUserRow())
    )
    setSelectedKeys(new Set())
  }
  deleteRowsRef.current = removeSelectedFromGrid

  const deleteSelected = async () => {
    if (selectedKeys.size === 0) return
    if (!confirm(deleteSelectedConfirm(selectedKeys.size, 'user(s)'))) return
    beginToolbarAction()
    setSubmitting(true)
    setError(null)
    try {
      const selected = editRows.filter((row) => selectedKeys.has(row.key))
      const toDelete = selected.filter((row) => row.user_id != null)
      for (const row of toDelete) {
        await api.deleteUser(row.user_id!)
      }
      setEditRows((rows) =>
        removeSelectedGridRows(rows, selectedKeys, isBlankUserRow, () =>
          emptyEditUserRow(defaultCompanyCd)
        )
      )
      setSelectedKeys(new Set())
      setSuccess(toDelete.length > 0 ? 'User(s) deleted.' : 'Row(s) removed.')
      if (toDelete.length > 0) await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSave = async () => {
    beginToolbarAction()
    const active = editRows.filter(isActiveUserRow)
    const keys = active.map(
      (row) => `${row.company_cd.trim().toLowerCase()}\t${row.user_cd.trim().toLowerCase()}`
    )
    if (new Set(keys).size !== keys.length) {
      setRowError('Duplicate company code and user id pairs in the grid.')
      return
    }
    const toCreate = active.filter((row) => row.user_id == null)
    const toUpdate = active.filter(
      (row) => row.user_id != null && userRowChanged(row, savedSnapshots.get(row.user_id))
    )
    if (toCreate.length === 0 && toUpdate.length === 0) {
      setSuccess(savedCountMessage(0, 'user'))
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      for (const row of toCreate) {
        await api.createUser(buildUserCreatePayload(row))
      }
      for (const row of toUpdate) {
        const patch = buildUserUpdatePayload(row, savedSnapshots.get(row.user_id!))
        if (patch && Object.keys(patch).length > 0) {
          await api.updateUser(row.user_id!, patch)
        }
      }
      setSuccess(masterPersistResultMessage(toCreate.length + toUpdate.length, 0, 'user'))
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
        gridId="masters-users-edit"
        title="Users"
        columns={masterUserEditColumns}
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
        gridRowNavWrapId="masters-users"
        onLayoutReady={grid.onLayoutReady}
        onGridContextMenu={grid.openContextMenu}
        layoutOptions={{ pinFirst: ['rownum', 'select'] }}
        rowCount={grid.displayRows.length}
        {...grid.tableProps}
      >
        {(layout) => (
          <tbody>
            {grid.displayRows.map((row, index) => {
              const isSentinel = isBlankUserRow(row)
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
                              aria-label={`Select ${row.user_cd || 'row'}`}
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
                      case 'company':
                        if (isSentinel && companyOptions.length === 0) {
                          return (
                            <td key={col.key} className="erp-grid-cell-edit">
                              <input
                                className="erp-grid-input"
                                value={row.company_cd}
                                placeholder={gridCellPlaceholder('DEMO', isSentinel)}
                                onChange={(e) =>
                                  updateRow(row.key, { company_cd: e.target.value })
                                }
                              />
                            </td>
                          )
                        }
                        if (row.user_id != null) {
                          return (
                            <td key={col.key} className="erp-grid-cell-readonly">
                              {row.company_cd}
                            </td>
                          )
                        }
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <select
                              className="erp-grid-input"
                              value={row.company_cd}
                              onChange={(e) =>
                                updateRow(row.key, { company_cd: e.target.value })
                              }
                            >
                              <option value="">Select…</option>
                              {companyOptions.map((c) => (
                                <option key={c.co_id} value={c.company_cd}>
                                  {c.company_cd}
                                </option>
                              ))}
                            </select>
                          </td>
                        )
                      case 'code':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <input
                              className="erp-grid-input"
                              value={row.user_cd}
                              readOnly={row.user_id != null}
                              placeholder={gridCellPlaceholder('admin', isSentinel)}
                              onChange={(e) => updateRow(row.key, { user_cd: e.target.value })}
                            />
                          </td>
                        )
                      case 'name':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <input
                              className="erp-grid-input"
                              value={row.user_nm}
                              placeholder={gridCellPlaceholder('', isSentinel)}
                              onChange={(e) => updateRow(row.key, { user_nm: e.target.value })}
                            />
                          </td>
                        )
                      case 'password':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <input
                              className="erp-grid-input"
                              type="password"
                              value={row.password}
                              placeholder={
                                row.user_id != null
                                  ? 'Leave blank to keep'
                                  : gridCellPlaceholder('password', isSentinel)
                              }
                              onChange={(e) => updateRow(row.key, { password: e.target.value })}
                            />
                          </td>
                        )
                      case 'active':
                        if (isSentinel) {
                          return <td key={col.key} className="erp-col-check" />
                        }
                        return (
                          <td key={col.key} className="erp-col-check">
                            <input
                              type="checkbox"
                              checked={row.is_active}
                              onChange={(e) =>
                                updateRow(row.key, { is_active: e.target.checked })
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
