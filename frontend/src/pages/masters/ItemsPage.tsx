import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { GridRowSelectButtons } from '../../components/GridRowSelectButtons'
import { MasterGridToolbarActions } from '../../components/masters/MasterGridToolbar'
import { GridRowNumCell } from '../../components/GridRowNumCell'
import { masterItemEditColumns } from '../../components/erp/masterGridColumns'
import { useExcelLikeGrid } from '../../hooks/useExcelLikeGrid'
import type { ItemTyp } from '../../types/masters'
import {
  buildItemPayload,
  changedActiveItemRows,
  emptyEditItemRow,
  isActiveItemRow,
  isBlankItemRow,
  itemRowSnapshotsFromEditRows,
  listRowsToEditItemRows,
  type EditItemRow,
  type ItemRowSnapshot,
} from '../../utils/itemMasterEdit'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../../utils/gridTrailingBlankRow'
import { toFilterCellValue } from '../../utils/gridColumnFilter'
import { mergeItemImportRows } from '../../utils/itemExcelImport'
import { itemTypDropdownLabel, itemTypTabLabel } from '../../utils/itemTypDisplay'
import {
  useMasterCatalog,
  useRefreshMasterCatalogAfterSave,
} from '../../context/MasterCatalogContext'
import { useItemTypColors } from '../../context/ItemTypColorContext'
import { itemTextColorStyle } from '../../utils/itemTypColor'
import {
  deleteSelectedConfirm,
  savedCountMessage,
} from '../../utils/gridRowChange'
import {
  selectableDisplayRows as getSelectableDisplayRows,
  selectedSelectableCount as countSelectedSelectable,
} from '../../utils/gridRowSelection'

export type ItemsTabFilter = 'ALL' | number

export function ItemsPage() {
  const { colorForItemRef } = useItemTypColors()
  const { itemtyps, suppliers, customers } = useMasterCatalog()
  const refreshMasterCatalog = useRefreshMasterCatalogAfterSave()
  const [editRows, setEditRows] = useState<EditItemRow[]>([])
  const [savedSnapshots, setSavedSnapshots] = useState<Map<number, ItemRowSnapshot>>(
    () => new Map()
  )
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<ItemsTabFilter>('ALL')
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    setRowError(null)
    try {
      const items = await api.listItemsMaster()
      const dataRows = listRowsToEditItemRows(items)
      setSavedSnapshots(itemRowSnapshotsFromEditRows(dataRows))
      setEditRows(
        ensureTrailingBlankRow(
          dataRows,
          isBlankItemRow,
          () => emptyEditItemRow(trailingRowItemtypId())
        )
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

  const itemtypIds = useMemo(
    () => new Set(itemtyps.map((t) => t.itemtyp_id)),
    [itemtyps]
  )

  useEffect(() => {
    if (activeFilter === 'ALL') return
    if (!itemtypIds.has(activeFilter)) {
      setActiveFilter('ALL')
    }
  }, [activeFilter, itemtypIds])

  const itemtypCodeById = useMemo(() => {
    const map = new Map<number, string>()
    for (const t of itemtyps) {
      map.set(t.itemtyp_id, itemTypDropdownLabel(t))
    }
    return map
  }, [itemtyps])

  const supplierLabelById = useMemo(() => {
    const map = new Map<number, string>()
    for (const s of suppliers) {
      map.set(s.suppliers_id, `${s.suppliers_cd} / ${s.suppliers_nm}`)
    }
    return map
  }, [suppliers])

  const customerLabelById = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of customers) {
      map.set(c.customers_id, `${c.customers_cd} / ${c.customers_nm}`)
    }
    return map
  }, [customers])

  const partyFilterValue = useCallback(
    (id: number | '', labelById: Map<number, string>): string =>
      toFilterCellValue(id !== '' ? labelById.get(id) ?? null : null),
    []
  )

  const matchesItemTab = useCallback(
    (itemtypId: number | '' | undefined): boolean => {
      if (activeFilter === 'ALL') return true
      return itemtypId !== '' && itemtypId === activeFilter
    },
    [activeFilter]
  )

  const filteredRows = useMemo(() => {
    if (editRows.length === 0) return []

    const last = editRows[editRows.length - 1]
    const hasSentinel = isBlankItemRow(last)
    const dataRows = hasSentinel ? editRows.slice(0, -1) : editRows
    const sentinel = hasSentinel ? last : null

    const matched = dataRows.filter((row) => matchesItemTab(row.itemtyp_id))
    if (!sentinel) return matched
    if (sentinel.itemtyp_id === '' || matchesItemTab(sentinel.itemtyp_id)) {
      return [...matched, sentinel]
    }
    return matched
  }, [editRows, matchesItemTab])

  const getFilterValue = useCallback(
    (row: EditItemRow, col: string): string => {
      switch (col) {
        case 'code':
          return toFilterCellValue(row.item_cd)
        case 'name':
          return toFilterCellValue(row.item_nm)
        case 'type':
          return toFilterCellValue(itemtypCodeById.get(row.itemtyp_id as number) ?? null)
        case 'supplier1':
          return partyFilterValue(row.supplier_ids[0], supplierLabelById)
        case 'supplier2':
          return partyFilterValue(row.supplier_ids[1], supplierLabelById)
        case 'supplier3':
          return partyFilterValue(row.supplier_ids[2], supplierLabelById)
        case 'customer1':
          return partyFilterValue(row.customer_ids[0], customerLabelById)
        case 'customer2':
          return partyFilterValue(row.customer_ids[1], customerLabelById)
        default:
          return toFilterCellValue('')
      }
    },
    [itemtypCodeById, partyFilterValue, supplierLabelById, customerLabelById]
  )

  const itemExportValue = useCallback(
    (row: EditItemRow, col: string): string | number => {
      switch (col) {
        case 'code':
          return row.item_cd
        case 'name':
          return row.item_nm
        case 'type':
          return itemtypCodeById.get(row.itemtyp_id as number) ?? ''
        case 'supplier1':
          return row.supplier_ids[0] !== ''
            ? supplierLabelById.get(row.supplier_ids[0] as number) ?? ''
            : ''
        case 'supplier2':
          return row.supplier_ids[1] !== ''
            ? supplierLabelById.get(row.supplier_ids[1] as number) ?? ''
            : ''
        case 'supplier3':
          return row.supplier_ids[2] !== ''
            ? supplierLabelById.get(row.supplier_ids[2] as number) ?? ''
            : ''
        case 'customer1':
          return row.customer_ids[0] !== ''
            ? customerLabelById.get(row.customer_ids[0] as number) ?? ''
            : ''
        case 'customer2':
          return row.customer_ids[1] !== ''
            ? customerLabelById.get(row.customer_ids[1] as number) ?? ''
            : ''
        default:
          return ''
      }
    },
    [itemtypCodeById, supplierLabelById, customerLabelById]
  )

  /** Type preset on trailing row: blank on All, selected tab's type otherwise. */
  const trailingRowItemtypId = useCallback((): number | '' => {
    if (activeFilter === 'ALL') return ''
    return activeFilter
  }, [activeFilter])

  const defaultItemtypIdFromFilter = useCallback((): number | '' => {
    if (activeFilter === 'ALL') return itemtyps[0]?.itemtyp_id ?? ''
    return activeFilter
  }, [activeFilter, itemtyps])

  useEffect(() => {
    setEditRows((rows) => {
      if (rows.length === 0) return rows
      const last = rows[rows.length - 1]
      if (!isBlankItemRow(last)) return rows
      const nextTyp = trailingRowItemtypId()
      if (last.itemtyp_id === nextTyp) return rows
      return rows.map((row, index) =>
        index === rows.length - 1 ? { ...row, itemtyp_id: nextTyp } : row
      )
    })
  }, [trailingRowItemtypId])

  const deleteRowsRef = useRef<() => void>(() => {})

  const grid = useExcelLikeGrid({
    columns: masterItemEditColumns,
    rows: filteredRows,
    getFilterValue,
    rowDelete: {
      label: 'Delete row',
      getSelectedCount: () => selectedKeys.size,
      onDelete: () => deleteRowsRef.current(),
    },
    excelExport: {
      sheetName: 'Items',
      filenamePrefix: 'items',
      getExportValue: itemExportValue,
    },
    excelImport: {
      applyParsedRows: (parsed) => {
        let added = 0
        let updated = 0
        setEditRows((prev) => {
          const result = mergeItemImportRows(
            parsed,
            prev,
            itemtyps,
            defaultItemtypIdFromFilter()
          )
          added = result.added
          updated = result.updated
          return ensureTrailingBlankRow(
            result.rows,
            isBlankItemRow,
            () => emptyEditItemRow(trailingRowItemtypId())
          )
        })
        setRowError(null)
        setSuccess(
          added + updated > 0
            ? `Import: ${added} added, ${updated} updated. Click Save to persist.`
            : 'No rows were imported from the file.'
        )
      },
    },
  })

  const selectableRows = useMemo(
    () => getSelectableDisplayRows(grid.displayRows, isBlankItemRow),
    [grid.displayRows]
  )

  const selectedCount = useMemo(
    () => countSelectedSelectable(selectableRows, selectedKeys, (row) => row.key),
    [selectableRows, selectedKeys]
  )

  const setSupplier = (key: string, index: number, value: number | '') => {
    setEditRows((rows) =>
      rows.map((row) => {
        if (row.key !== key) return row
        const supplier_ids = [...row.supplier_ids]
        supplier_ids[index] = value
        return { ...row, supplier_ids }
      })
    )
  }

  const setCustomer = (key: string, index: number, value: number | '') => {
    setEditRows((rows) =>
      rows.map((row) => {
        if (row.key !== key) return row
        const customer_ids = [...row.customer_ids]
        customer_ids[index] = value
        return { ...row, customer_ids }
      })
    )
  }

  const renderSupplierCell = (row: EditItemRow, index: number) => (
    <select
      className={`erp-grid-input${row.supplier_ids[index] === '' ? ' erp-input-empty' : ''}`}
      value={row.supplier_ids[index]}
      aria-label={
        index === 0 ? 'Main Supplier' : index === 1 ? 'Supplier 2' : 'Supplier 3'
      }
      onChange={(e) =>
        setSupplier(row.key, index, e.target.value === '' ? '' : Number(e.target.value))
      }
    >
      <option value="" />
      {suppliers.map((s) => (
        <option key={s.suppliers_id} value={s.suppliers_id}>
          {s.suppliers_cd} / {s.suppliers_nm}
        </option>
      ))}
    </select>
  )

  const renderCustomerCell = (row: EditItemRow, index: number) => (
    <select
      className={`erp-grid-input${row.customer_ids[index] === '' ? ' erp-input-empty' : ''}`}
      value={row.customer_ids[index]}
      aria-label={index === 0 ? 'Customer 1' : 'Customer 2'}
      onChange={(e) =>
        setCustomer(row.key, index, e.target.value === '' ? '' : Number(e.target.value))
      }
    >
      <option value="" />
      {customers.map((c) => (
        <option key={c.customers_id} value={c.customers_id}>
          {c.customers_cd} / {c.customers_nm}
        </option>
      ))}
    </select>
  )

  const updateRow = (key: string, patch: Partial<EditItemRow>) => {
    setEditRows((rows) =>
      updateRowWithTrailingBlank(
        rows,
        key,
        patch,
        isBlankItemRow,
        () => emptyEditItemRow(trailingRowItemtypId())
      )
    )
  }

  const focusItemCell = (rowKey: string, col: 'code' | 'name' | 'type') => {
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-item-grid-cell="${rowKey}:${col}"]`)
        ?.focus()
    })
  }

  const commitSentinelRowOnEnter = (row: EditItemRow) => {
    if (editRows[editRows.length - 1]?.key !== row.key) return
    if (isBlankItemRow(row)) return

    const newBlank = emptyEditItemRow(trailingRowItemtypId())
    setEditRows((rows) =>
      ensureTrailingBlankRow(rows, isBlankItemRow, () => newBlank)
    )
    focusItemCell(newBlank.key, 'code')
  }

  const handleItemCellKeyDown = (e: React.KeyboardEvent, row: EditItemRow) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (editRows[editRows.length - 1]?.key !== row.key) return
    commitSentinelRowOnEnter(row)
  }

  const deleteSelected = async () => {
    if (selectedKeys.size === 0) return
    if (!confirm(deleteSelectedConfirm(selectedKeys.size, 'item(s)'))) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const selected = editRows.filter((row) => selectedKeys.has(row.key))
      const toDelete = selected.filter((row) => row.item_id != null)
      const toDrop = new Set(selected.map((row) => row.key))
      for (const row of toDelete) {
        await api.deleteItem(row.item_id!)
      }
      setEditRows((rows) =>
        ensureTrailingBlankRow(
          rows.filter((row) => !toDrop.has(row.key)),
          isBlankItemRow,
          () => emptyEditItemRow(trailingRowItemtypId())
        )
      )
      setSelectedKeys(new Set())
      setSuccess(
        toDelete.length > 0 ? 'Item(s) deleted.' : 'Row(s) removed.'
      )
      if (toDelete.length > 0) {
        await load()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSubmitting(false)
    }
  }
  deleteRowsRef.current = () => void deleteSelected()

  const handleSave = async () => {
    const active = editRows.filter(isActiveItemRow)
    const incomplete = editRows.filter(
      (row) =>
        !isBlankItemRow(row) &&
        !isActiveItemRow(row) &&
        (row.item_cd.trim() || row.item_nm.trim() || row.itemtyp_id !== '')
    )
    if (incomplete.length > 0) {
      setRowError('Enter Item Code and Item Type for each row, or clear empty rows.')
      return
    }
    if (active.length === 0) {
      setRowError('Add at least one item row.')
      return
    }
    const toSave = changedActiveItemRows(editRows, savedSnapshots)
    if (toSave.length === 0) {
      setRowError(null)
      setSuccess(savedCountMessage(0, 'item'))
      return
    }
    const codes = active.map((row) => row.item_cd.trim().toLowerCase())
    if (new Set(codes).size !== codes.length) {
      setRowError('Duplicate item codes in the grid.')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    setRowError(null)
    try {
      for (const row of toSave) {
        const payload = buildItemPayload(row)
        if (row.item_id != null) {
          await api.updateItem(row.item_id, payload)
        } else {
          await api.createItem(payload)
        }
      }
      setSuccess(savedCountMessage(toSave.length, 'item'))
      await load()
      refreshMasterCatalog()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const toolbar = (
    <>
      <button
        type="button"
        className={`erp-tab${activeFilter === 'ALL' ? ' active' : ''}`}
        onClick={() => setActiveFilter('ALL')}
      >
        All
      </button>
      {itemtyps.map((t) => (
        <button
          key={t.itemtyp_id}
          type="button"
          className={`erp-tab${activeFilter === t.itemtyp_id ? ' active' : ''}`}
          onClick={() => setActiveFilter(t.itemtyp_id)}
        >
          {itemTypTabLabel(t)}
        </button>
      ))}
    </>
  )

  return (
    <ErpScreen error={error}>
      {grid.filterMenuElement}
      {grid.contextMenuElement}
      <ErpGridPanel
        gridId="masters-items-edit-v5"
        title="Items"
        columns={masterItemEditColumns}
        loading={loading}
        isEmpty={false}
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
        toolbarLeft={toolbar}
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
              const isSentinel = isBlankItemRow(row)
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
                              aria-label={`Select ${row.item_cd || 'row'}`}
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
                              value={row.item_cd}
                              placeholder={isSentinel ? '' : 'Item Code'}
                              data-item-grid-cell={`${row.key}:code`}
                              style={itemTextColorStyle(
                                colorForItemRef({
                                  itemtypId:
                                    row.itemtyp_id === '' ? undefined : row.itemtyp_id,
                                  itemCd: row.item_cd,
                                })
                              )}
                              onChange={(e) => updateRow(row.key, { item_cd: e.target.value })}
                              onKeyDown={(e) => handleItemCellKeyDown(e, row)}
                            />
                          </td>
                        )
                      case 'name':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <input
                              className="erp-grid-input"
                              value={row.item_nm}
                              placeholder={isSentinel ? '' : 'Item Name'}
                              data-item-grid-cell={`${row.key}:name`}
                              style={itemTextColorStyle(
                                colorForItemRef({
                                  itemtypId:
                                    row.itemtyp_id === '' ? undefined : row.itemtyp_id,
                                  itemCd: row.item_cd,
                                })
                              )}
                              onChange={(e) => updateRow(row.key, { item_nm: e.target.value })}
                              onKeyDown={(e) => handleItemCellKeyDown(e, row)}
                            />
                          </td>
                        )
                      case 'type':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit">
                            <select
                              className={`erp-grid-input${row.itemtyp_id === '' ? ' erp-input-empty' : ''}`}
                              value={row.itemtyp_id}
                              data-item-grid-cell={`${row.key}:type`}
                              onChange={(e) =>
                                updateRow(row.key, {
                                  itemtyp_id:
                                    e.target.value === '' ? '' : Number(e.target.value),
                                })
                              }
                              onKeyDown={(e) => handleItemCellKeyDown(e, row)}
                            >
                              <option value="">{isSentinel ? '' : 'Type'}</option>
                              {itemtyps.map((t) => (
                                <option key={t.itemtyp_id} value={t.itemtyp_id}>
                                  {itemTypDropdownLabel(t)}
                                </option>
                              ))}
                            </select>
                          </td>
                        )
                      case 'supplier1':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit erp-grid-cell-blank">
                            {renderSupplierCell(row, 0)}
                          </td>
                        )
                      case 'supplier2':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit erp-grid-cell-blank">
                            {renderSupplierCell(row, 1)}
                          </td>
                        )
                      case 'supplier3':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit erp-grid-cell-blank">
                            {renderSupplierCell(row, 2)}
                          </td>
                        )
                      case 'customer1':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit erp-grid-cell-blank">
                            {renderCustomerCell(row, 0)}
                          </td>
                        )
                      case 'customer2':
                        return (
                          <td key={col.key} className="erp-grid-cell-edit erp-grid-cell-blank">
                            {renderCustomerCell(row, 1)}
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
