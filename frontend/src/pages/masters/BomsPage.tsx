import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel, erpRowClass } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { ErpSearchPanel } from '../../components/erp/ErpSearchPanel'
import { GridContextMenu, type GridContextMenuState } from '../../components/GridContextMenu'
import { masterBomColumns } from '../../components/erp/masterGridColumns'
import { ItemSearchPicker } from '../../components/ItemSearchPicker'
import type { BomCreatePayload, BomRow } from '../../types/boms'
import { itemRefFromSearch } from '../../types/boms'
import type { ItemSearchRow, LocationMaster } from '../../types/masters'
import { formatQty } from '../../utils/format'
import { downloadExcelSheet, exportFilename } from '../../utils/exportExcel'

export function BomsPage() {
  const [rows, setRows] = useState<BomRow[]>([])
  const [parentFilter, setParentFilter] = useState<ItemSearchRow | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [parent, setParent] = useState<ItemSearchRow | null>(null)
  const [child, setChild] = useState<ItemSearchRow | null>(null)
  const [level, setLevel] = useState('0')
  const [reqQty, setReqQty] = useState('')
  const [fromLocationId, setFromLocationId] = useState('')
  const [toLocationId, setToLocationId] = useState('')
  const [locations, setLocations] = useState<LocationMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [gridMenu, setGridMenu] = useState<GridContextMenuState>(null)
  const [gridMenuRow, setGridMenuRow] = useState<BomRow | null>(null)
  const [treeTitle, setTreeTitle] = useState<string | null>(null)
  const [treeLines, setTreeLines] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listBoms(parentFilter?.item_id)
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [parentFilter])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    api.listLocationsMaster().then(setLocations).catch(() => {})
  }, [])

  const resetForm = () => {
    setEditId(null)
    setParent(null)
    setChild(null)
    setLevel('0')
    setReqQty('')
    setFromLocationId('')
    setToLocationId('')
  }

  const startEdit = (row: BomRow) => {
    setEditId(row.bom_id)
    setParent({
      item_id: row.p_item_id,
      item_cd: row.p_item_cd,
      item_nm: row.p_item_nm,
      itemtyp_id: 0,
      itemtyp_nm: '',
    })
    setChild({
      item_id: row.c_item_id,
      item_cd: row.c_item_cd,
      item_nm: row.c_item_nm,
      itemtyp_id: 0,
      itemtyp_nm: '',
    })
    setReqQty(String(row.c_req_qty))
    setLevel(String(row.level))
    setFromLocationId(String(row.from_location_id))
    setToLocationId(String(row.to_location_id))
    setError(null)
    setSuccess(null)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!parent || !child || !fromLocationId || !toLocationId) {
      setError('Select parent, child, from location and to location.')
      return
    }
    const levelNo = Number(level)
    if (!Number.isInteger(levelNo) || levelNo < 0) {
      setError('Level must be an integer 0 or greater.')
      return
    }
    const qty = Number(reqQty)
    if (!qty || qty <= 0) {
      setError('Child required qty must be greater than 0.')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const payload: BomCreatePayload = {
        parent: itemRefFromSearch(parent),
        child: itemRefFromSearch(child),
        level: levelNo,
        from_location_id: Number(fromLocationId),
        to_location_id: Number(toLocationId),
        c_req_qty: qty,
      }
      if (editId) {
        await api.updateBom(editId, payload)
        setSuccess('BOM updated.')
      } else {
        await api.createBom(payload)
        setSuccess('BOM created.')
      }
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this BOM line?')) return
    setError(null)
    setSuccess(null)
    try {
      await api.deleteBom(id)
      if (editId === id) resetForm()
      setSuccess('BOM deleted.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const exportBomsToExcel = () => {
    const headers = ['Parent', 'Child', 'Level', 'To Location', 'From Location', 'Req Qty']
    const exportRows = rows.map((row) => [
      `${row.p_item_cd} ${row.p_item_nm}`,
      `${row.c_item_cd} ${row.c_item_nm}`,
      row.level,
      `${row.to_location_cd} ${row.to_location_nm}`,
      `${row.from_location_cd} ${row.from_location_nm}`,
      Number(row.c_req_qty),
    ])
    downloadExcelSheet('BOM', headers, exportRows, exportFilename('bom_list'))
  }

  const showTreeFromRow = async (baseRow: BomRow | null) => {
    if (!baseRow) return
    try {
      const allBoms = await api.listBoms()
      const byParent = new Map<number, BomRow[]>()
      for (const row of allBoms) {
        const bucket = byParent.get(row.p_item_id) ?? []
        bucket.push(row)
        byParent.set(row.p_item_id, bucket)
      }
      for (const [key, bucket] of byParent) {
        bucket.sort((a, b) => {
          const levelDiff = Number(a.level) - Number(b.level)
          if (levelDiff !== 0) return levelDiff
          return a.bom_id - b.bom_id
        })
        byParent.set(key, bucket)
      }

      const rootText = `${baseRow.p_item_cd} - ${baseRow.p_item_nm}`
      const lines: string[] = [rootText]
      const visitedParents = new Set<number>()
      const walk = (parentId: number, depth: number) => {
        if (visitedParents.has(parentId)) return
        visitedParents.add(parentId)
        const children = byParent.get(parentId) ?? []
        for (const child of children) {
          const indent = '  '.repeat(depth)
          lines.push(
            `${indent}▶ ${child.c_item_cd} ${child.c_item_nm} (Lv ${child.level}, ${child.to_location_cd} ← ${child.from_location_cd}, Qty ${formatQty(child.c_req_qty)})`
          )
          walk(child.c_item_id, depth + 1)
        }
        visitedParents.delete(parentId)
      }
      walk(baseRow.p_item_id, 1)
      setTreeTitle(`Tree: ${baseRow.p_item_cd} ${baseRow.p_item_nm}`)
      setTreeLines(lines)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load BOM tree')
    }
  }

  return (
    <ErpScreen error={error} success={success}>
      <GridContextMenu
        menu={gridMenu}
        excelLabel="Excel Export"
        onExcel={exportBomsToExcel}
        onClose={() => {
          setGridMenu(null)
          setGridMenuRow(null)
        }}
        items={[
          {
            label: 'Show Parent Tree',
            onClick: () => {
              void showTreeFromRow(gridMenuRow)
            },
          },
        ]}
      />
      <ErpSearchPanel>
        <div className="erp-search-form erp-search-form-bom-filter">
          <ItemSearchPicker label="Filter parent" value={parentFilter} onChange={setParentFilter} />
          <div className="erp-search-actions">
            <button type="button" className="btn erp-btn erp-btn-search" onClick={load}>
              Apply
            </button>
          </div>
        </div>
      </ErpSearchPanel>

      <ErpSearchPanel className="erp-panel-master-form">
        <form onSubmit={onSubmit} className="erp-search-form erp-search-form-bom">
          <ItemSearchPicker label="Parent" value={parent} onChange={setParent} required />
          <ItemSearchPicker label="Child" value={child} onChange={setChild} required />
          <label className="erp-search-field erp-search-field-qty erp-search-field-with-label">
            <span className="bom-field-label">Level</span>
            <input
              type="number"
              className="erp-input"
              step="1"
              min="0"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="0"
              aria-label="BOM level"
              required
            />
          </label>
          <label className="erp-search-field erp-search-field-qty erp-search-field-with-label">
            <span className="bom-field-label">To Location</span>
            <select
              className={`erp-input${toLocationId === '' ? ' erp-input-empty' : ''}`}
              value={toLocationId}
              onChange={(e) => setToLocationId(e.target.value)}
              required
            >
              <option value="">Select...</option>
              {locations.map((l) => (
                <option key={l.location_id} value={l.location_id}>
                  {l.location_cd}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-search-field erp-search-field-qty erp-search-field-with-label">
            <span className="bom-field-label">From Location</span>
            <select
              className={`erp-input${fromLocationId === '' ? ' erp-input-empty' : ''}`}
              value={fromLocationId}
              onChange={(e) => setFromLocationId(e.target.value)}
              required
            >
              <option value="">Select...</option>
              {locations.map((l) => (
                <option key={l.location_id} value={l.location_id}>
                  {l.location_cd}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-search-field erp-search-field-qty erp-search-field-with-label">
            <span className="bom-field-label">Req Qty</span>
            <input
              type="number"
              className="erp-input"
              step="0.001"
              min="0.001"
              value={reqQty}
              onChange={(e) => setReqQty(e.target.value)}
              placeholder="0.000"
              aria-label="Child required qty"
              required
            />
          </label>
          <div className="erp-search-actions">
            <button type="submit" className="btn erp-btn erp-btn-search" disabled={submitting}>
              {submitting ? 'Saving…' : editId ? 'Update' : 'Save'}
            </button>
            {editId && (
              <button type="button" className="btn erp-btn erp-btn-clear" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </ErpSearchPanel>

      <ErpGridPanel
        gridId="masters-boms-v2"
        title="BOM"
        columns={masterBomColumns}
        loading={loading}
        isEmpty={!loading && rows.length === 0}
        emptyText="No BOM lines"
        onRefresh={load}
      >
        {(layout) => (
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.bom_id}
                className={erpRowClass(index, editId === row.bom_id)}
                onClick={() => startEdit(row)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setGridMenu({ x: event.clientX, y: event.clientY })
                  setGridMenuRow(row)
                }}
              >
                {layout.orderedColumns.map((col) => {
                  switch (col.key) {
                    case 'parent':
                      return (
                        <td key={col.key}>
                          <code>{row.p_item_cd}</code> {row.p_item_nm}
                        </td>
                      )
                    case 'child':
                      return (
                        <td key={col.key}>
                          <code>{row.c_item_cd}</code> {row.c_item_nm}
                        </td>
                      )
                    case 'qty':
                      return <td key={col.key}>{formatQty(row.c_req_qty)}</td>
                    case 'level':
                      return <td key={col.key}>{row.level}</td>
                    case 'from_location':
                      return <td key={col.key}><code>{row.from_location_cd}</code> {row.from_location_nm}</td>
                    case 'to_location':
                      return <td key={col.key}><code>{row.to_location_cd}</code> {row.to_location_nm}</td>
                    case 'actions':
                      return (
                        <td
                          key={col.key}
                          className="erp-col-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="btn erp-btn erp-btn-search"
                            onClick={() => startEdit(row)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn erp-btn erp-btn-cancel"
                            onClick={() => void handleDelete(row.bom_id)}
                          >
                            Delete
                          </button>
                        </td>
                      )
                    default:
                      return <td key={col.key} />
                  }
                })}
              </tr>
            ))}
          </tbody>
        )}
      </ErpGridPanel>
      {treeTitle && treeLines.length > 0 && (
        <div className="erp-panel">
          <div className="erp-panel-title">{treeTitle}</div>
          <div className="erp-panel-content">
            <pre className="erp-tree-view">{treeLines.join('\n')}</pre>
            <div className="erp-search-actions">
              <button type="button" className="btn erp-btn erp-btn-clear" onClick={() => setTreeTitle(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </ErpScreen>
  )
}
