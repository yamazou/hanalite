import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { GridRowNumCell } from '../../components/GridRowNumCell'
import { masterNumberingPatternEditColumns } from '../../components/erp/masterGridColumns'
import { useExcelLikeGrid } from '../../hooks/useExcelLikeGrid'
import { useGridRowKeyboardNav } from '../../hooks/useGridRowKeyboardNav'
import { useMasterGridToolbarFeedback } from '../../hooks/useMasterGridToolbarFeedback'
import {
  buildNumberingPatternPayload,
  emptyEditNumberingPatternRow,
  isActiveNumberingPatternRow,
  isBlankNumberingPatternRow,
  listRowsToEditNumberingPatternRows,
  NUMBERING_ELEMENT_SLOT_KEYS,
  NUMBERING_SEQ_RESET_SCOPES,
  numberingPatternRowSnapshotsFromEditRows,
  type EditNumberingPatternRow,
  type NumberingPatternRowSnapshot,
} from '../../utils/numberingPatternMasterEdit'
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

export function NumberingPatternsPage() {
  const [editRows, setEditRows] = useState<EditNumberingPatternRow[]>([])
  const [savedSnapshots, setSavedSnapshots] = useState<
    Map<number, NumberingPatternRowSnapshot>
  >(() => new Map())
  const [elementCodes, setElementCodes] = useState<string[]>([])
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
      const [patterns, elements] = await Promise.all([
        api.listNumberingPatternsMaster(),
        api.listNumberingElementsMaster(),
      ])
      setElementCodes(elements.map((el) => el.numbering_element_cd))
      const dataRows = listRowsToEditNumberingPatternRows(patterns)
      setSavedSnapshots(numberingPatternRowSnapshotsFromEditRows(dataRows))
      setEditRows(
        ensureTrailingBlankRow(dataRows, isBlankNumberingPatternRow, () =>
          emptyEditNumberingPatternRow()
        )
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

  const getFilterValue = useCallback((row: EditNumberingPatternRow, col: string) => {
    if (col === 'code') return toFilterCellValue(row.numbering_pattern_cd)
    if (col === 'name') return toFilterCellValue(row.numbering_pattern_nm)
    if (col === 'seq_reset') return toFilterCellValue(row.seq_reset_scope)
    if (col === 'image') return toFilterCellValue(row.numbering_image)
    if (col.startsWith('element_')) {
      return toFilterCellValue(row[col as keyof EditNumberingPatternRow] as string)
    }
    return masterDateFilterValue(row, col)
  }, [])

  const exportValue = useCallback((row: EditNumberingPatternRow, col: string) => {
    if (col === 'code') return row.numbering_pattern_cd
    if (col === 'name') return row.numbering_pattern_nm
    if (col === 'seq_reset') return row.seq_reset_scope
    if (col === 'image') return row.numbering_image
    if (col.startsWith('element_')) {
      return String(row[col as keyof EditNumberingPatternRow] ?? '')
    }
    return masterDateExportValue(row, col)
  }, [])

  const deleteRowsRef = useRef<() => void>(() => {})

  const grid = useExcelLikeGrid({
    columns: masterNumberingPatternEditColumns,
    rows: editRows,
    getFilterValue,
    rowDelete: {
      label: 'Delete row',
      getSelectedCount: () => selectedKeys.size,
      onDelete: () => deleteRowsRef.current(),
    },
    excelExport: {
      sheetName: 'Numbering Patterns',
      filenamePrefix: 'numbering-patterns',
      getExportValue: exportValue,
    },
  })

  const selectableRows = useMemo(
    () => selectableDisplayRows(grid.displayRows, isBlankNumberingPatternRow),
    [grid.displayRows]
  )

  const rowNav = useGridRowKeyboardNav({
    wrapId: 'masters-numbering-patterns',
    displayRows: grid.displayRows,
    isBlankRow: isBlankNumberingPatternRow,
  })

  const selectedCount = useMemo(
    () => selectedSelectableCount(selectableRows, selectedKeys, (row) => row.key),
    [selectableRows, selectedKeys]
  )

  const updateRow = (key: string, patch: Partial<EditNumberingPatternRow>) => {
    clearToolbarFeedback()
    setEditRows((rows) =>
      updateRowWithTrailingBlank(
        rows,
        key,
        patch,
        isBlankNumberingPatternRow,
        () => emptyEditNumberingPatternRow()
      )
    )
  }

  const removeSelectedFromGrid = () => {
    if (selectedKeys.size === 0) return
    setEditRows((rows) =>
      removeSelectedGridRows(
        rows,
        selectedKeys,
        isBlankNumberingPatternRow,
        () => emptyEditNumberingPatternRow()
      )
    )
    setSelectedKeys(new Set())
  }
  deleteRowsRef.current = removeSelectedFromGrid

  const deleteSelected = async () => {
    if (selectedKeys.size === 0) return
    if (!confirm(deleteSelectedConfirm(selectedKeys.size, 'numbering pattern(s)'))) return
    beginToolbarAction()
    setSubmitting(true)
    setError(null)
    try {
      const selected = editRows.filter((row) => selectedKeys.has(row.key))
      const toDelete = selected.filter((row) => row.numbering_pattern_id != null)
      for (const row of toDelete) {
        await api.deleteNumberingPattern(row.numbering_pattern_id!)
      }
      setEditRows((rows) =>
        removeSelectedGridRows(
          rows,
          selectedKeys,
          isBlankNumberingPatternRow,
          () => emptyEditNumberingPatternRow()
        )
      )
      setSelectedKeys(new Set())
      setSuccess(toDelete.length > 0 ? 'Numbering pattern(s) deleted.' : 'Row(s) removed.')
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
      (row) => row.numbering_pattern_id ?? null
    )
    const active = editRows.filter(isActiveNumberingPatternRow)
    const codes = active.map((row) => row.numbering_pattern_cd.trim().toLowerCase())
    if (new Set(codes).size !== codes.length) {
      setRowError('Duplicate pattern codes in the grid.')
      return
    }
    const toSave = changedActiveRows(
      editRows,
      savedSnapshots,
      isActiveNumberingPatternRow,
      (row) => row.numbering_pattern_id,
      (row) => (isActiveNumberingPatternRow(row) ? buildNumberingPatternPayload(row) : null)
    )
    if (toSave.length === 0 && pendingDeleteIds.length === 0) {
      setSuccess(savedCountMessage(0, 'numbering pattern'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      for (const id of pendingDeleteIds) {
        await api.deleteNumberingPattern(id)
      }
      for (const row of toSave) {
        const payload = buildNumberingPatternPayload(row)
        if (row.numbering_pattern_id != null) {
          await api.updateNumberingPattern(row.numbering_pattern_id, payload)
        } else {
          await api.createNumberingPattern(payload)
        }
      }
      setSuccess(
        masterPersistResultMessage(toSave.length, pendingDeleteIds.length, 'numbering pattern')
      )
      if (pendingDeleteIds.length > 0 || toSave.length > 0) await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const elementDatalistId = 'numbering-element-codes'

  return (
    <ErpScreen error={error}>
      <datalist id={elementDatalistId}>
        {elementCodes.map((cd) => (
          <option key={cd} value={cd} />
        ))}
      </datalist>
      {grid.filterMenuElement}
      {grid.contextMenuElement}
      <ErpGridPanel
        gridId="masters-numbering-patterns-v1"
        title="Numbering Patterns"
        columns={masterNumberingPatternEditColumns}
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
        gridRowNavWrapId="masters-numbering-patterns"
        onLayoutReady={grid.onLayoutReady}
        onGridContextMenu={grid.openContextMenu}
        layoutOptions={{ pinFirst: ['rownum', 'select', 'code', 'name'] }}
        rowCount={grid.displayRows.length}
        {...grid.tableProps}
      >
        {(layout) => (
          <tbody>
            {grid.displayRows.map((row, index) => {
              const isSentinel = isBlankNumberingPatternRow(row)
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
                        if (isSentinel) return <td key={col.key} className="erp-col-check" />
                        return (
                          <td key={col.key} className="erp-col-check">
                            <input
                              type="checkbox"
                              checked={selectedKeys.has(row.key)}
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
                              value={row.numbering_pattern_cd}
                              placeholder={gridCellPlaceholder('L001', isSentinel)}
                              onChange={(e) =>
                                updateRow(row.key, { numbering_pattern_cd: e.target.value })
                              }
                            />
                          </td>
                        )
                      case 'name':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <input
                              className="erp-grid-input"
                              value={row.numbering_pattern_nm}
                              onChange={(e) =>
                                updateRow(row.key, { numbering_pattern_nm: e.target.value })
                              }
                            />
                          </td>
                        )
                      case 'seq_reset':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <select
                              className="erp-grid-input"
                              value={row.seq_reset_scope}
                              onChange={(e) =>
                                updateRow(row.key, { seq_reset_scope: e.target.value })
                              }
                            >
                              {NUMBERING_SEQ_RESET_SCOPES.map((scope) => (
                                <option key={scope} value={scope}>
                                  {scope}
                                </option>
                              ))}
                            </select>
                          </td>
                        )
                      case 'image':
                        return (
                          <td key={col.key} className="erp-grid-cell-readonly">
                            {row.numbering_image}
                          </td>
                        )
                      default:
                        if (NUMBERING_ELEMENT_SLOT_KEYS.includes(col.key as (typeof NUMBERING_ELEMENT_SLOT_KEYS)[number])) {
                          const slotKey = col.key as (typeof NUMBERING_ELEMENT_SLOT_KEYS)[number]
                          return (
                            <td key={col.key} className="erp-grid-cell-edit">
                              <input
                                className="erp-grid-input"
                                list={elementDatalistId}
                                value={row[slotKey]}
                                onChange={(e) =>
                                  updateRow(row.key, { [slotKey]: e.target.value })
                                }
                              />
                            </td>
                          )
                        }
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
