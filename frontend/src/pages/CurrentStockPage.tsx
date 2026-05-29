import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { ErpSuggestInput } from '../components/ErpSuggestInput'
import { ErpGridPanel, erpRowClass } from '../components/erp/ErpGridPanel'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpSearchPanel } from '../components/erp/ErpSearchPanel'
import { currentStockColumns } from '../components/erp/masterGridColumns'
import type { CurrentStock } from '../types/inventory'
import { useExcelLikeGrid } from '../hooks/useExcelLikeGrid'
import { formatDate, formatDateTime, formatQty } from '../utils/format'
import { ColoredItemCode, ColoredItemName } from '../components/ColoredItemText'
import { toFilterCellValue } from '../utils/gridColumnFilter'
import { suggestCurrentLots, suggestItems, suggestLocations } from '../utils/searchSuggest'

type SearchFilters = {
  item: string
  lot: string
  location: string
  includeZero: boolean
}

const emptySearch: SearchFilters = {
  item: '',
  lot: '',
  location: '',
  includeZero: false,
}

export function CurrentStockPage() {
  const [searchInput, setSearchInput] = useState<SearchFilters>(emptySearch)
  const [appliedSearch, setAppliedSearch] = useState<SearchFilters>(emptySearch)
  const [rows, setRows] = useState<CurrentStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listCurrentStock({
        lot: appliedSearch.lot.trim() || undefined,
        item_q: appliedSearch.item.trim() || undefined,
        location_q: appliedSearch.location.trim() || undefined,
        include_zero: appliedSearch.includeZero,
      })
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [appliedSearch])

  useEffect(() => {
    load()
  }, [load])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setAppliedSearch(searchInput)
  }

  const clearSearch = () => {
    setSearchInput(emptySearch)
    setAppliedSearch(emptySearch)
  }

  const searchFormClass = useMemo(() => 'erp-search-form erp-search-form-suggest', [])

  const getFilterValue = useCallback((row: CurrentStock, col: string) => {
    switch (col) {
      case 'item_cd':
        return toFilterCellValue(row.item_cd)
      case 'item_nm':
        return toFilterCellValue(row.item_nm)
      case 'location':
        return toFilterCellValue(`${row.location_cd} ${row.location_nm}`)
      case 'type':
        return toFilterCellValue(row.itemtyp_nm)
      case 'lot':
        return toFilterCellValue(row.lot)
      case 'gr_date':
        return toFilterCellValue(row.gr_date ? formatDate(row.gr_date) : null)
      case 'qty':
        return toFilterCellValue(row.qty)
      case 'updated':
        return toFilterCellValue(formatDateTime(row.updated_at))
      default:
        return toFilterCellValue('')
    }
  }, [])

  const grid = useExcelLikeGrid({
    columns: currentStockColumns,
    rows,
    getFilterValue,
    excelExport: {
      sheetName: 'Current Stock',
      filenamePrefix: 'current_stock',
      getExportValue: (row, col) => {
        switch (col) {
          case 'item_cd':
            return row.item_cd
          case 'item_nm':
            return row.item_nm
          case 'location':
            return `${row.location_cd} ${row.location_nm}`
          case 'type':
            return row.itemtyp_nm
          case 'lot':
            return row.lot
          case 'gr_date':
            return row.gr_date ? formatDate(row.gr_date) : ''
          case 'qty':
            return row.qty
          case 'updated':
            return formatDateTime(row.updated_at)
          default:
            return ''
        }
      },
    },
  })

  return (
    <ErpScreen error={error}>
      {grid.filterMenuElement}
      {grid.contextMenuElement}
      <ErpSearchPanel>
        <form onSubmit={onSearch} className={searchFormClass}>
          <ErpSuggestInput
            value={searchInput.item}
            onChange={(item) => setSearchInput((prev) => ({ ...prev, item }))}
            placeholder="Item code - Item name"
            ariaLabel="Item code - Item name"
            fieldClassName="erp-search-field-item"
            fetchSuggestions={suggestItems}
          />
          <ErpSuggestInput
            value={searchInput.lot}
            onChange={(lot) => setSearchInput((prev) => ({ ...prev, lot }))}
            placeholder="Lot"
            ariaLabel="Lot"
            fieldClassName="erp-search-field-reference"
            fetchSuggestions={suggestCurrentLots}
          />
          <ErpSuggestInput
            value={searchInput.location}
            onChange={(location) => setSearchInput((prev) => ({ ...prev, location }))}
            placeholder="Location"
            ariaLabel="Location"
            fieldClassName="erp-search-field-supplier"
            fetchSuggestions={suggestLocations}
          />
          <label className="erp-search-field erp-search-field-check">
            <input
              type="checkbox"
              checked={searchInput.includeZero}
              onChange={(e) =>
                setSearchInput((prev) => ({ ...prev, includeZero: e.target.checked }))
              }
            />
            <span>Include zero</span>
          </label>
          <div className="erp-search-actions">
            <button type="submit" className="btn erp-btn erp-btn-search">
              Search
            </button>
            <button type="button" className="btn erp-btn erp-btn-clear" onClick={clearSearch}>
              Clear
            </button>
            <button type="button" className="btn erp-btn erp-btn-clear" onClick={load}>
              Refresh
            </button>
          </div>
        </form>
      </ErpSearchPanel>

      <ErpGridPanel
        gridId="inventory-current-v3"
        title="Current Stock"
        columns={currentStockColumns}
        loading={loading}
        isEmpty={!loading && rows.length === 0}
        onRefresh={load}
        onLayoutReady={grid.onLayoutReady}
        onGridContextMenu={grid.openContextMenu}
        showSaveGridButton
        {...grid.tableProps}
      >
        {(layout) => (
          <tbody>
            {grid.displayRows.map((r, index) => (
              <tr key={r.inv_current_id} className={erpRowClass(index)}>
                {layout.orderedColumns.map((col) => {
                  switch (col.key) {
                    case 'item_cd':
                      return (
                        <td key={col.key}>
                          <ColoredItemCode itemtypId={r.itemtyp_id} itemId={r.item_id}>
                            {r.item_cd}
                          </ColoredItemCode>
                        </td>
                      )
                    case 'item_nm':
                      return (
                        <td key={col.key}>
                          <ColoredItemName itemtypId={r.itemtyp_id} itemId={r.item_id}>
                            {r.item_nm}
                          </ColoredItemName>
                        </td>
                      )
                    case 'location':
                      return (
                        <td key={col.key}>
                          <code>{r.location_cd}</code> {r.location_nm}
                        </td>
                      )
                    case 'type':
                      return <td key={col.key}>{r.itemtyp_nm}</td>
                    case 'lot':
                      return (
                        <td key={col.key}>
                          <code>{r.lot}</code>
                        </td>
                      )
                    case 'gr_date':
                      return (
                        <td key={col.key}>{r.gr_date ? formatDate(r.gr_date) : '-'}</td>
                      )
                    case 'qty':
                      return <td key={col.key}>{formatQty(r.qty)}</td>
                    case 'updated':
                      return <td key={col.key}>{formatDateTime(r.updated_at)}</td>
                    case 'actions':
                      return (
                        <td key={col.key} className="erp-col-actions">
                          <Link
                            to={`/trace?lot=${encodeURIComponent(r.lot)}&location_id=${r.location_id}`}
                            className="erp-link"
                          >
                            Trace
                          </Link>
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
    </ErpScreen>
  )
}
