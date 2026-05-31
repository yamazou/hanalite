import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { GridRowNumCell } from '../../components/GridRowNumCell'
import { masterBomEditColumns } from '../../components/erp/masterGridColumns'
import { GridRowSelectButtons } from '../../components/GridRowSelectButtons'
import { MasterGridToolbarActions } from '../../components/masters/MasterGridToolbar'
import { useExcelLikeGrid } from '../../hooks/useExcelLikeGrid'
import type { BomCreatePayload } from '../../types/boms'
import {
  useMasterCatalog,
  useRefreshMasterCatalogAfterSave,
} from '../../context/MasterCatalogContext'
import { findItemByCd } from '../../utils/draftEdit'
import { toFilterCellValue } from '../../utils/gridColumnFilter'
import {
  bomChildCdFieldPatch,
  bomParentCdFieldPatch,
  bomRowSnapshot,
  bomRowSnapshotsFromEditRows,
  emptyEditBomRow,
  isActiveBomRow,
  isBlankBomRow,
  listRowsToEditBomRows,
  type BomRowSnapshot,
  type EditBomRow,
} from '../../utils/bomMasterEdit'
import {
  changedActiveRows,
  deleteSelectedConfirm,
  savedCountMessage,
} from '../../utils/gridRowChange'
import { selectableDisplayRows, selectedSelectableCount } from '../../utils/gridRowSelection'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../../utils/gridTrailingBlankRow'
import { mergeBomImportRows } from '../../utils/bomExcelImport'
import { ColoredItemName } from '../../components/ColoredItemText'
import { GridItemDatalistField } from '../../components/GridItemDatalistField'
import { BomTreePanel } from '../../components/BomTreePanel'
import { useItemTypColors } from '../../context/ItemTypColorContext'
import { itemTextColorStyle } from '../../utils/itemTypColor'
import { loadBomTreeForParent, type BomTreeLine } from '../../utils/bomTree'

export function BomsPage() {
  const { colorForItemRef } = useItemTypColors()
  const refreshMasterCatalog = useRefreshMasterCatalogAfterSave()
  const [editRows, setEditRows] = useState<EditBomRow[]>([])
  const [savedSnapshots, setSavedSnapshots] = useState<Map<number, BomRowSnapshot>>(
    () => new Map()
  )
  const { items, locations } = useMasterCatalog()
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [treeTitle, setTreeTitle] = useState<string | null>(null)
  const [treeLines, setTreeLines] = useState<BomTreeLine[]>([])
  const [treeOnSelect, setTreeOnSelect] = useState(true)
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    setRowError(null)
    try {
      const data = await api.listBoms()
      const dataRows = listRowsToEditBomRows(data)
      setSavedSnapshots(bomRowSnapshotsFromEditRows(dataRows))
      setEditRows(
        ensureTrailingBlankRow(dataRows, isBlankBomRow, () => emptyEditBomRow())
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

  const getFilterValue = useCallback((row: EditBomRow, col: string) => {
    switch (col) {
      case 'parent_cd':
        return toFilterCellValue(row.p_item_cd)
      case 'parent_nm':
        return toFilterCellValue(row.p_item_nm)
      case 'child_cd':
        return toFilterCellValue(row.c_item_cd)
      case 'child_nm':
        return toFilterCellValue(row.c_item_nm)
      case 'level':
        return toFilterCellValue(row.level)
      case 'to_location':
        return toFilterCellValue(row.to_location_id)
      case 'from_location':
        return toFilterCellValue(row.from_location_id)
      case 'qty':
        return toFilterCellValue(row.c_req_qty)
      default:
        return toFilterCellValue('')
    }
  }, [])

  const locationLabel = (id: number | '') => {
    if (id === '') return ''
    const loc = locations.find((l) => l.location_id === id)
    return loc ? loc.location_cd : ''
  }

  const exportValue = useCallback(
    (row: EditBomRow, col: string) => {
      switch (col) {
        case 'parent_cd':
          return row.p_item_cd
        case 'parent_nm':
          return row.p_item_nm
        case 'child_cd':
          return row.c_item_cd
        case 'child_nm':
          return row.c_item_nm
        case 'level':
          return row.level
        case 'to_location':
          return locationLabel(row.to_location_id)
        case 'from_location':
          return locationLabel(row.from_location_id)
        case 'qty':
          return row.c_req_qty
        default:
          return ''
      }
    },
    [locations]
  )

  const showTreeFromRow = async (baseRow: EditBomRow | null) => {
    if (!(baseRow?.p_item_cd ?? '').trim()) return
    try {
      const { title, lines } = await loadBomTreeForParent({
        item_cd: baseRow.p_item_cd,
        item_nm: baseRow.p_item_nm,
        itemtyp_id: baseRow.p_itemtyp_id,
      })
      setTreeTitle(title)
      setTreeLines(lines)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load BOM tree')
    }
  }

  const activateRow = (row: EditBomRow) => {
    if (isBlankBomRow(row)) return
    setActiveRowKey(row.key)
    if (treeOnSelect) {
      void showTreeFromRow(row)
    }
  }

  const handleTreeOnSelectChange = (enabled: boolean) => {
    setTreeOnSelect(enabled)
    if (!enabled) {
      setTreeTitle(null)
      setTreeLines([])
    } else if (activeRowKey) {
      const row = editRows.find((r) => r.key === activeRowKey) ?? null
      if (row && !isBlankBomRow(row)) {
        void showTreeFromRow(row)
      }
    }
  }

  const { dataRows, sentinelRow } = useMemo(() => {
    if (editRows.length === 0) {
      return { dataRows: [] as EditBomRow[], sentinelRow: null as EditBomRow | null }
    }
    const last = editRows[editRows.length - 1]
    if (isBlankBomRow(last)) {
      return { dataRows: editRows.slice(0, -1), sentinelRow: last }
    }
    return { dataRows: editRows, sentinelRow: null }
  }, [editRows])

  const deleteRowsRef = useRef<() => void>(() => {})

  const grid = useExcelLikeGrid({
    columns: masterBomEditColumns,
    rows: dataRows,
    getFilterValue,
    rowDelete: {
      label: 'Delete row',
      getSelectedCount: () => selectedKeys.size,
      onDelete: () => deleteRowsRef.current(),
    },
    excelExport: {
      sheetName: 'BOM',
      filenamePrefix: 'bom_list',
      getExportValue: exportValue,
    },
    excelImport: {
      applyParsedRows: async (parsed) => {
        const { rows, added } = mergeBomImportRows(parsed, editRows, locations)
        setEditRows(ensureTrailingBlankRow(rows, isBlankBomRow, () => emptyEditBomRow()))
        if (added > 0) {
          setSuccess(`Import: ${added} row(s) added to grid. Click Update to persist.`)
        } else {
          setSuccess('No rows were imported from the file.')
        }
      },
    },
  })

  /** Column filters apply to data rows only; trailing add row stays visible. */
  const displayRows = useMemo(() => {
    if (!sentinelRow) return grid.displayRows
    return [...grid.displayRows, sentinelRow]
  }, [grid.displayRows, sentinelRow])

  const selectableRows = useMemo(
    () => selectableDisplayRows(displayRows, isBlankBomRow),
    [displayRows]
  )

  const selectedCount = useMemo(
    () => selectedSelectableCount(selectableRows, selectedKeys, (row) => row.key),
    [selectableRows, selectedKeys]
  )

  const updateRow = (key: string, patch: Partial<EditBomRow>) => {
    setEditRows((rows) =>
      updateRowWithTrailingBlank(rows, key, patch, isBlankBomRow, () => emptyEditBomRow())
    )
  }

  const focusCell = (rowKey: string, col: string) => {
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-bom-grid-cell="${rowKey}:${col}"]`)
        ?.focus()
    })
  }

  const commitSentinelRowOnEnter = (row: EditBomRow) => {
    if (editRows[editRows.length - 1]?.key !== row.key) return
    if (isBlankBomRow(row)) return
    const newBlank = emptyEditBomRow()
    setEditRows((rows) => ensureTrailingBlankRow(rows, isBlankBomRow, () => newBlank))
    focusCell(newBlank.key, 'parent_cd')
  }

  const handleCellKeyDown = (e: React.KeyboardEvent, row: EditBomRow) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (editRows[editRows.length - 1]?.key !== row.key) return
    commitSentinelRowOnEnter(row)
  }

  const deleteSelected = async () => {
    if (selectedKeys.size === 0) return
    if (!confirm(deleteSelectedConfirm(selectedKeys.size, 'BOM line(s)'))) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const selected = editRows.filter((row) => selectedKeys.has(row.key))
      const toDelete = selected.filter((row) => row.bom_id != null)
      const toDrop = new Set(selected.map((row) => row.key))
      for (const row of toDelete) {
        await api.deleteBom(row.bom_id!)
      }
      setEditRows((rows) =>
        ensureTrailingBlankRow(
          rows.filter((row) => !toDrop.has(row.key)),
          isBlankBomRow,
          () => emptyEditBomRow()
        )
      )
      setSelectedKeys(new Set())
      setSuccess(toDelete.length > 0 ? 'BOM line(s) deleted.' : 'Row(s) removed.')
      if (toDelete.length > 0) await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSubmitting(false)
    }
  }
  deleteRowsRef.current = () => void deleteSelected()

  const buildPayload = (row: EditBomRow): BomCreatePayload => {
    const parent = findItemByCd(items, row.p_item_cd)
    const child = findItemByCd(items, row.c_item_cd)
    if (!parent) throw new Error(`Parent item not found: ${row.p_item_cd}`)
    if (!child) throw new Error(`Child item not found: ${row.c_item_cd}`)
    const levelNo = Number(row.level)
    if (row.level.trim() === '' || !Number.isInteger(levelNo) || levelNo < 0) {
      throw new Error(`Invalid level on row: ${row.p_item_cd} ↁE${row.c_item_cd}`)
    }
    const qty = Number(row.c_req_qty)
    if (!qty || qty <= 0) {
      throw new Error(`Invalid qty on row: ${row.p_item_cd} ↁE${row.c_item_cd}`)
    }
    return {
      parent: { item_id: parent.item_id },
      child: { item_id: child.item_id },
      level: levelNo,
      from_location_id: Number(row.from_location_id),
      to_location_id: Number(row.to_location_id),
      c_req_qty: qty,
    }
  }

  const handleSave = async () => {
    const active = editRows.filter(isActiveBomRow)
    const incomplete = editRows.filter((row) => !isBlankBomRow(row) && !isActiveBomRow(row))
    if (incomplete.length > 0) {
      setRowError('Complete all BOM fields for each row, or clear empty rows.')
      return
    }
    if (active.length === 0) {
      setRowError('Add at least one BOM row.')
      return
    }

    const toSave = changedActiveRows(
      editRows,
      savedSnapshots,
      isActiveBomRow,
      (row) => row.bom_id,
      bomRowSnapshot
    )
    if (toSave.length === 0) {
      setRowError(null)
      setSuccess(savedCountMessage(0, 'BOM line'))
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    setRowError(null)
    try {
      for (const row of toSave) {
        const payload = buildPayload(row)
        if (row.bom_id != null) {
          await api.updateBom(row.bom_id, payload)
        } else {
          await api.createBom(payload)
        }
      }
      setSuccess(savedCountMessage(toSave.length, 'BOM line'))
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
        gridId="masters-boms-edit-v1"
        title="BOM"
        columns={masterBomEditColumns}
        loading={loading}
        isEmpty={false}
        emptyText="No BOM lines"
        onRefresh={() => void load()}
        selectColumnHeader={
          <GridRowSelectButtons
            rowCount={selectableRows.length}
            selectedCount={selectedCount}
            onSelectAll={() =>
              setSelectedKeys(new Set(selectableRows.map((row) => row.key)))
            }
            onClearSelection={() => setSelectedKeys(new Set())}
          />
        }
        toolbarLeft={
          <label className="erp-toolbar-tree-toggle">
            Tree
            <input
              type="checkbox"
              checked={treeOnSelect}
              onChange={(e) => handleTreeOnSelectChange(e.target.checked)}
            />
          </label>
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
        rowCount={displayRows.length}
        {...grid.tableProps}
      >
        {(layout) => (
          <tbody>
            {displayRows.map((row, index) => {
              const isSentinel = isBlankBomRow(row)
              return (
                <tr
                  key={row.key}
                  data-bom-row-key={row.key}
                  className={`erp-grid-row-editing${index % 2 === 1 ? ' row-alt' : ''}${
                    activeRowKey === row.key || selectedKeys.has(row.key) ? ' selected' : ''
                  }${isSentinel ? ' erp-grid-row-sentinel' : ''}`}
                  onClick={() => activateRow(row)}
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
                              aria-label={`Select ${row.p_item_cd || 'row'}`}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                setSelectedKeys((prev) => {
                                  const next = new Set(prev)
                                  if (e.target.checked) next.add(row.key)
                                  else next.delete(row.key)
                                  return next
                                })
                                if (e.target.checked) {
                                  activateRow(row)
                                }
                              }}
                            />
                          </td>
                        )
                      case 'parent_cd':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <GridItemDatalistField
                              mode="cd"
                              items={items}
                              listId={`bom-parent-cd-${row.key}`}
                              value={row.p_item_cd}
                              dataCellAttr={`${row.key}:parent_cd`}
                              style={itemTextColorStyle(
                                colorForItemRef({
                                  itemtypId: row.p_itemtyp_id,
                                  itemCd: row.p_item_cd,
                                })
                              )}
                              onChange={(value) =>
                                updateRow(row.key, bomParentCdFieldPatch(items, value))
                              }
                              onKeyDown={(e) => handleCellKeyDown(e, row)}
                            />
                          </td>
                        )
                      case 'parent_nm':
                        return (
                          <td key={col.key} className="erp-grid-cell-readonly">
                            <ColoredItemName
                              itemtypId={row.p_itemtyp_id}
                              itemCd={row.p_item_cd}
                            >
                              {row.p_item_nm}
                            </ColoredItemName>
                          </td>
                        )
                      case 'child_cd':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <GridItemDatalistField
                              mode="cd"
                              items={items}
                              listId={`bom-child-cd-${row.key}`}
                              value={row.c_item_cd}
                              dataCellAttr={`${row.key}:child_cd`}
                              style={itemTextColorStyle(
                                colorForItemRef({
                                  itemtypId: row.c_itemtyp_id,
                                  itemCd: row.c_item_cd,
                                })
                              )}
                              onChange={(value) =>
                                updateRow(row.key, bomChildCdFieldPatch(items, value))
                              }
                              onKeyDown={(e) => handleCellKeyDown(e, row)}
                            />
                          </td>
                        )
                      case 'child_nm':
                        return (
                          <td key={col.key} className="erp-grid-cell-readonly">
                            <ColoredItemName
                              itemtypId={row.c_itemtyp_id}
                              itemCd={row.c_item_cd}
                            >
                              {row.c_item_nm}
                            </ColoredItemName>
                          </td>
                        )
                      case 'level':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit erp-col-num">
                            <input
                              className="erp-grid-input"
                              type="number"
                              min={0}
                              step={1}
                              value={row.level}
                              placeholder={isSentinel ? '' : '0'}
                              data-bom-grid-cell={`${row.key}:level`}
                              onChange={(e) => updateRow(row.key, { level: e.target.value })}
                              onKeyDown={(e) => handleCellKeyDown(e, row)}
                            />
                          </td>
                        )
                      case 'to_location':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <select
                              className={`erp-grid-input${row.to_location_id === '' ? ' erp-input-empty' : ''}`}
                              value={row.to_location_id}
                              onChange={(e) =>
                                updateRow(row.key, {
                                  to_location_id:
                                    e.target.value === '' ? '' : Number(e.target.value),
                                })
                              }
                              onKeyDown={(e) => handleCellKeyDown(e, row)}
                            >
                              <option value="" />
                              {locations.map((l) => (
                                <option key={l.location_id} value={l.location_id}>
                                  {l.location_cd}
                                </option>
                              ))}
                            </select>
                          </td>
                        )
                      case 'from_location':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <select
                              className={`erp-grid-input${row.from_location_id === '' ? ' erp-input-empty' : ''}`}
                              value={row.from_location_id}
                              onChange={(e) =>
                                updateRow(row.key, {
                                  from_location_id:
                                    e.target.value === '' ? '' : Number(e.target.value),
                                })
                              }
                              onKeyDown={(e) => handleCellKeyDown(e, row)}
                            >
                              <option value="" />
                              {locations.map((l) => (
                                <option key={l.location_id} value={l.location_id}>
                                  {l.location_cd}
                                </option>
                              ))}
                            </select>
                          </td>
                        )
                      case 'qty':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit erp-col-num">
                            <input
                              className="erp-grid-input"
                              type="number"
                              min={0.001}
                              step={0.001}
                              value={row.c_req_qty}
                              data-bom-grid-cell={`${row.key}:qty`}
                              onChange={(e) =>
                                updateRow(row.key, { c_req_qty: e.target.value })
                              }
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
      <BomTreePanel
        title={treeTitle}
        lines={treeLines}
        onClose={() => {
          setTreeTitle(null)
          setTreeLines([])
        }}
      />
    </ErpScreen>
  )
}
