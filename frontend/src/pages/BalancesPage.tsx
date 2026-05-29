import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { ErpSuggestInput } from '../components/ErpSuggestInput'
import { ErpGridPanel, erpRowClass } from '../components/erp/ErpGridPanel'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpSearchPanel } from '../components/erp/ErpSearchPanel'
import { balanceColumns } from '../components/erp/masterGridColumns'
import type { BalanceItem } from '../types/inventory'
import { useExcelLikeGrid } from '../hooks/useExcelLikeGrid'
import { formatDateTime, formatQty } from '../utils/format'
import { ColoredItemName } from '../components/ColoredItemText'
import { toFilterCellValue } from '../utils/gridColumnFilter'
import { resolveLocationIdFromText, suggestLocations } from '../utils/searchSuggest'

function currentPeriod(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}${m}`
}

export function BalancesPage() {
  const [period, setPeriod] = useState('')
  const [rows, setRows] = useState<BalanceItem[]>([])
  const [locationText, setLocationText] = useState('')
  const [createPeriod, setCreatePeriod] = useState(currentPeriod())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listBalances(
        period || undefined,
        undefined,
        locationText.trim() || undefined
      )
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [period, locationText])

  useEffect(() => {
    load()
  }, [load])

  const getFilterValue = useCallback((row: BalanceItem, col: string) => {
    switch (col) {
      case 'period':
        return toFilterCellValue(row.period_year_month)
      case 'item':
        return toFilterCellValue(row.item_nm)
      case 'location':
        return toFilterCellValue(`${row.location_cd} ${row.location_nm}`)
      case 'lot':
        return toFilterCellValue(row.lot)
      case 'beg_qty':
        return toFilterCellValue(row.beg_qty)
      case 'qty':
        return toFilterCellValue(row.qty)
      case 'beg_at':
        return toFilterCellValue(formatDateTime(row.beg_at))
      default:
        return toFilterCellValue('')
    }
  }, [])

  const grid = useExcelLikeGrid({
    columns: balanceColumns,
    rows,
    getFilterValue,
    excelExport: {
      sheetName: 'Balances',
      filenamePrefix: 'balances',
      getExportValue: (row, col) => {
        switch (col) {
          case 'period':
            return row.period_year_month
          case 'item':
            return row.item_nm
          case 'location':
            return `${row.location_cd} ${row.location_nm}`
          case 'lot':
            return row.lot
          case 'beg_qty':
            return row.beg_qty
          case 'qty':
            return row.qty
          case 'beg_at':
            return formatDateTime(row.beg_at)
          default:
            return ''
        }
      },
    },
  })

  const onFilter = (e: FormEvent) => {
    e.preventDefault()
    load()
  }

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    const p = createPeriod.trim()
    if (!/^\d{6}$/.test(p)) {
      setError('Period must be in YYYYMM format.')
      return
    }
    setCreating(true)
    setError(null)
    setSuccess(null)
    try {
      const locationId = await resolveLocationIdFromText(locationText)
      const res = await api.createPeriodBalance(p, locationId)
      setSuccess(`Saved ${res.rows_saved} balance rows for ${res.period_year_month}.`)
      setPeriod(p)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create balance snapshot')
    } finally {
      setCreating(false)
    }
  }

  return (
    <ErpScreen error={error} success={success}>
      {grid.filterMenuElement}
      {grid.contextMenuElement}
      <ErpSearchPanel>
        <form onSubmit={onCreate} className="erp-search-form erp-search-form-suggest">
          <ErpSuggestInput
            value={locationText}
            onChange={setLocationText}
            placeholder="Location (optional)"
            ariaLabel="Location"
            fieldClassName="erp-search-field-supplier"
            fetchSuggestions={suggestLocations}
          />
          <label className="erp-search-field erp-search-field-reference">
            <input
              className="erp-input"
              value={createPeriod}
              onChange={(e) => setCreatePeriod(e.target.value)}
              pattern="\d{6}"
              placeholder="Period YYYYMM"
              aria-label="Target Period"
              required
            />
          </label>
          <div className="erp-search-actions">
            <button type="submit" className="btn erp-btn erp-btn-search" disabled={creating}>
              {creating ? 'Creating…' : 'Create snapshot'}
            </button>
          </div>
        </form>
      </ErpSearchPanel>

      <ErpSearchPanel>
        <form onSubmit={onFilter} className="erp-search-form erp-search-form-suggest">
          <ErpSuggestInput
            value={locationText}
            onChange={setLocationText}
            placeholder="Location"
            ariaLabel="Location"
            fieldClassName="erp-search-field-supplier"
            fetchSuggestions={suggestLocations}
          />
          <label className="erp-search-field erp-search-field-reference">
            <input
              className="erp-input"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="Filter period YYYYMM"
              aria-label="Filter Period"
              pattern="\d{6}|"
            />
          </label>
          <div className="erp-search-actions">
            <button type="submit" className="btn erp-btn erp-btn-search">
              Search
            </button>
            <button type="button" className="btn erp-btn erp-btn-clear" onClick={load}>
              Refresh
            </button>
          </div>
        </form>
      </ErpSearchPanel>

      <ErpGridPanel
        gridId="inventory-balances-v1"
        title="Period Balances"
        columns={balanceColumns}
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
              <tr key={r.inv_balance_id} className={erpRowClass(index)}>
                {layout.orderedColumns.map((col) => {
                  switch (col.key) {
                    case 'period':
                      return <td key={col.key}>{r.period_year_month}</td>
                    case 'item':
                      return (
                        <td key={col.key}>
                          <ColoredItemName itemId={r.item_id}>{r.item_nm}</ColoredItemName>
                        </td>
                      )
                    case 'location':
                      return (
                        <td key={col.key}>
                          <code>{r.location_cd}</code> {r.location_nm}
                        </td>
                      )
                    case 'lot':
                      return (
                        <td key={col.key}>
                          <code>{r.lot}</code>
                        </td>
                      )
                    case 'beg_qty':
                      return <td key={col.key}>{formatQty(r.beg_qty)}</td>
                    case 'qty':
                      return <td key={col.key}>{formatQty(r.qty)}</td>
                    case 'beg_at':
                      return <td key={col.key}>{formatDateTime(r.beg_at)}</td>
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
