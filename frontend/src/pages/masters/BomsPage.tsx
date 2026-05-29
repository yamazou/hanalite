import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { GridRowNumCell } from '../../components/GridRowNumCell'
import { masterBomEditColumns } from '../../components/erp/masterGridColumns'
import { MasterGridToolbar } from '../../components/masters/MasterGridToolbar'
import { useExcelLikeGrid } from '../../hooks/useExcelLikeGrid'
import type { BomCreatePayload, BomRow } from '../../types/boms'
import type { ItemSearchRow, LocationMaster } from '../../types/masters'
import { formatQty } from '../../utils/format'
import { toFilterCellValue } from '../../utils/gridColumnFilter'
import {
  emptyEditBomRow,
  isActiveBomRow,
  isBlankBomRow,
  listRowsToEditBomRows,
  type EditBomRow,
} from '../../utils/bomMasterEdit'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../../utils/gridTrailingBlankRow'
import { mergeBomImportRows } from '../../utils/bomExcelImport'
import { ColoredItemCode, ColoredItemName } from '../../components/ColoredItemText'
import { useItemTypColors } from '../../context/ItemTypColorContext'
import { itemTextColorStyle } from '../../utils/itemTypColor'

async function resolveItemCd(cd: string): Promise<ItemSearchRow | null> {
  const trimmed = cd.trim()
  if (!trimmed) return null
  const hits = await api.searchItems(trimmed, 15)
  const exact = hits.find((h) => h.item_cd.toLowerCase() === trimmed.toLowerCase())
  return exact ?? hits[0] ?? null
}

type BomTreeLine = {
  indent: number
  item_cd: string
  item_nm: string
  item_id?: number
  itemtyp_id?: number
  suffix?: string
}

export function BomsPage() {
  const { colorForItemRef } = useItemTypColors()
  const [editRows, setEditRows] = useState<EditBomRow[]>([])
  const [locations, setLocations] = useState<LocationMaster[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const contextRowRef = useRef<EditBomRow | null>(null)
  const [treeTitle, setTreeTitle] = useState<string | null>(null)
  const [treeLines, setTreeLines] = useState<BomTreeLine[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listBoms()
      setEditRows(
        ensureTrailingBlankRow(listRowsToEditBomRows(data), isBlankBomRow, () =>
          emptyEditBomRow()
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
    api.listLocationsMaster().then(setLocations).catch(() => {})
  }, [])

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
    if (!baseRow?.p_item_cd.trim()) return
    try {
      const allBoms = await api.listBoms()
      const byParent = new Map<number, BomRow[]>()
      for (const row of allBoms) {
        const bucket = byParent.get(row.p_item_id) ?? []
        bucket.push(row)
        byParent.set(row.p_item_id, bucket)
      }
      for (const [key, bucket] of byParent) {
        bucket.sort((a, b) => Number(a.level) - Number(b.level) || a.bom_id - b.bom_id)
        byParent.set(key, bucket)
      }

      const lines: BomTreeLine[] = [
        {
          indent: 0,
          item_cd: baseRow.p_item_cd,
          item_nm: baseRow.p_item_nm,
          itemtyp_id: baseRow.p_itemtyp_id,
        },
      ]
      const parentItem = await resolveItemCd(baseRow.p_item_cd)
      if (!parentItem) {
        setTreeTitle(`Tree: ${baseRow.p_item_cd}`)
        setTreeLines([])
        return
      }
      lines[0].item_id = parentItem.item_id
      lines[0].itemtyp_id = parentItem.itemtyp_id

      const visitedParents = new Set<number>()
      const walk = (parentId: number, depth: number) => {
        if (visitedParents.has(parentId)) return
        visitedParents.add(parentId)
        for (const child of byParent.get(parentId) ?? []) {
          lines.push({
            indent: depth,
            item_cd: child.c_item_cd,
            item_nm: child.c_item_nm,
            item_id: child.c_item_id,
            suffix: `(Lv ${child.level}, ${child.to_location_cd} ← ${child.from_location_cd}, Qty ${formatQty(child.c_req_qty)})`,
          })
          walk(child.c_item_id, depth + 1)
        }
        visitedParents.delete(parentId)
      }
      walk(parentItem.item_id, 1)
      setTreeTitle(`Tree: ${baseRow.p_item_cd} ${baseRow.p_item_nm}`)
      setTreeLines(lines)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load BOM tree')
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
          setSuccess(`Import: ${added} row(s) added to grid. Click Save to persist.`)
        } else {
          setSuccess('No rows were imported from the file.')
        }
      },
    },
    contextMenuItems: [
      {
        label: 'Show Parent Tree',
        onClick: () => void showTreeFromRow(contextRowRef.current),
      },
    ],
  })

  /** Column filters apply to data rows only; trailing add row stays visible. */
  const displayRows = useMemo(() => {
    if (!sentinelRow) return grid.displayRows
    return [...grid.displayRows, sentinelRow]
  }, [grid.displayRows, sentinelRow])

  const resolveItemNames = async (
    key: string,
    field: 'parent' | 'child',
    cd: string
  ) => {
    const item = await resolveItemCd(cd)
    if (field === 'parent') {
      updateRow(key, {
        p_item_nm: item?.item_nm ?? '',
        p_itemtyp_id: item?.itemtyp_id,
      })
    } else {
      updateRow(key, {
        c_item_nm: item?.item_nm ?? '',
        c_itemtyp_id: item?.itemtyp_id,
      })
    }
  }

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
    if (!confirm('Delete selected BOM line(s)?')) return
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

  const buildPayload = async (row: EditBomRow): Promise<BomCreatePayload> => {
    const parent = await resolveItemCd(row.p_item_cd)
    const child = await resolveItemCd(row.c_item_cd)
    if (!parent) throw new Error(`Parent item not found: ${row.p_item_cd}`)
    if (!child) throw new Error(`Child item not found: ${row.c_item_cd}`)
    const levelNo = Number(row.level)
    if (row.level.trim() === '' || !Number.isInteger(levelNo) || levelNo < 0) {
      throw new Error(`Invalid level on row: ${row.p_item_cd} → ${row.c_item_cd}`)
    }
    const qty = Number(row.c_req_qty)
    if (!qty || qty <= 0) {
      throw new Error(`Invalid qty on row: ${row.p_item_cd} → ${row.c_item_cd}`)
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

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    setRowError(null)
    try {
      for (const row of active) {
        const payload = await buildPayload(row)
        if (row.bom_id != null) {
          await api.updateBom(row.bom_id, payload)
        } else {
          await api.createBom(payload)
        }
      }
      setSuccess('BOM saved.')
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
        gridId="masters-boms-edit-v1"
        title="BOM"
        columns={masterBomEditColumns}
        loading={loading}
        isEmpty={false}
        emptyText="No BOM lines"
        onRefresh={() => void load()}
        toolbarLeft={
          <MasterGridToolbar
            displayRowCount={displayRows.length}
            submitting={submitting}
            rowError={rowError}
            onSelectAll={() =>
              setSelectedKeys(new Set(displayRows.map((row) => row.key)))
            }
            onClearSelection={() => setSelectedKeys(new Set())}
            onSave={() => void handleSave()}
          />
        }
        showSaveGridButton
        panelClassName="erp-panel-grow"
        onLayoutReady={grid.onLayoutReady}
        onGridContextMenu={(event) => {
          const tr = (event.target as HTMLElement).closest('tr')
          const key = tr?.getAttribute('data-bom-row-key')
          if (key) {
            contextRowRef.current = editRows.find((r) => r.key === key) ?? null
          }
          grid.openContextMenu(event)
        }}
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
                              aria-label={`Select ${row.p_item_cd || 'row'}`}
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
                      case 'parent_cd':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <input
                              className="erp-grid-input"
                              style={itemTextColorStyle(
                                colorForItemRef({
                                  itemtypId: row.p_itemtyp_id,
                                  itemCd: row.p_item_cd,
                                })
                              )}
                              value={row.p_item_cd}
                              data-bom-grid-cell={`${row.key}:parent_cd`}
                              onChange={(e) =>
                                updateRow(row.key, { p_item_cd: e.target.value })
                              }
                              onBlur={(e) =>
                                void resolveItemNames(row.key, 'parent', e.target.value)
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
                            <input
                              className="erp-grid-input"
                              style={itemTextColorStyle(
                                colorForItemRef({
                                  itemtypId: row.c_itemtyp_id,
                                  itemCd: row.c_item_cd,
                                })
                              )}
                              value={row.c_item_cd}
                              data-bom-grid-cell={`${row.key}:child_cd`}
                              onChange={(e) =>
                                updateRow(row.key, { c_item_cd: e.target.value })
                              }
                              onBlur={(e) =>
                                void resolveItemNames(row.key, 'child', e.target.value)
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
      {treeTitle && treeLines.length > 0 && (
        <div className="erp-panel">
          <div className="erp-panel-title">{treeTitle}</div>
          <div className="erp-panel-content">
            <div className="erp-tree-view">
              {treeLines.map((line, index) => (
                <div
                  key={`${line.item_cd}-${index}`}
                  className="erp-tree-line"
                  style={{ paddingLeft: `${line.indent * 14}px` }}
                >
                  {line.indent > 0 ? <span className="erp-tree-marker">▶ </span> : null}
                  <ColoredItemCode itemId={line.item_id} itemtypId={line.itemtyp_id}>
                    {line.item_cd}
                  </ColoredItemCode>{' '}
                  <ColoredItemName itemId={line.item_id} itemtypId={line.itemtyp_id}>
                    {line.item_nm}
                  </ColoredItemName>
                  {line.suffix ? <span className="erp-tree-suffix"> {line.suffix}</span> : null}
                </div>
              ))}
            </div>
            <div className="erp-search-actions">
              <button
                type="button"
                className="btn erp-btn erp-btn-clear"
                onClick={() => setTreeTitle(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </ErpScreen>
  )
}
