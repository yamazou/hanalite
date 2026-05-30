import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { ErpSuggestInput } from '../components/ErpSuggestInput'
import { ErpGridPanel, erpRowClass } from '../components/erp/ErpGridPanel'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpSearchPanel } from '../components/erp/ErpSearchPanel'
import {
  traceBalanceColumns,
  traceCurrentColumns,
  traceHistoryColumns,
} from '../components/erp/masterGridColumns'
import { useExcelLikeGrid } from '../hooks/useExcelLikeGrid'
import type { GridColumnLayout } from '../hooks/useGridColumnLayout'
import type { LotTraceResult } from '../types/inventory'
import { formatDateTime, formatQty } from '../utils/format'
import { ColoredItemName } from '../components/ColoredItemText'
import { toFilterCellValue } from '../utils/gridColumnFilter'
import { resolveLocationIdFromText, suggestCurrentLots, suggestLocations } from '../utils/searchSuggest'

export function LotTracePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [lot, setLot] = useState(() => searchParams.get('lot') ?? '')
  const [locationText, setLocationText] = useState('')
  const [result, setResult] = useState<LotTraceResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runTrace = async (value: string, locationLabel: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Enter a lot number.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const locId = locationLabel.trim()
        ? await resolveLocationIdFromText(locationLabel)
        : undefined
      const data = await api.traceLot(trimmed, locId)
      setResult(data)
      const qp: Record<string, string> = { lot: trimmed }
      if (locId != null) qp.location_id = String(locId)
      setSearchParams(qp)
    } catch (e) {
      setResult(null)
      setError(e instanceof Error ? e.message : 'Trace failed')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void runTrace(lot, locationText)
  }

  useEffect(() => {
    const q = searchParams.get('lot')?.trim()
    const locId = searchParams.get('location_id')?.trim()
    if (!q) return
    const init = async () => {
      let locLabel = ''
      if (locId) {
        const locations = await api.listLocationsMaster()
        const loc = locations.find((l) => String(l.location_id) === locId)
        if (loc) {
          locLabel = `${loc.location_cd} / ${loc.location_nm}`
          setLocationText(locLabel)
        }
      }
      setLot(q)
      await runTrace(q, locLabel)
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial URL only
  }, [])

  const lotTitle = result?.lot ?? lot

  const currentRows = result?.current ?? []
  const historyRows = result?.history ?? []
  const balanceRows = result?.balances ?? []

  const currentFilter = useCallback(
    (row: (typeof currentRows)[number], col: string) => {
      switch (col) {
        case 'item':
          return toFilterCellValue(row.item_nm)
        case 'location':
          return toFilterCellValue(`${row.location_cd} ${row.location_nm}`)
        case 'qty':
          return toFilterCellValue(row.qty)
        default:
          return toFilterCellValue('')
      }
    },
    []
  )

  const historyFilter = useCallback(
    (row: (typeof historyRows)[number], col: string) => {
      switch (col) {
        case 'type':
          return toFilterCellValue(row.movetyps_cd)
        case 'move_qty':
          return toFilterCellValue(row.move_qty)
        case 'qty':
          return toFilterCellValue(row.qty)
        case 'actual_at':
          return toFilterCellValue(formatDateTime(row.actual_at))
        default:
          return toFilterCellValue('')
      }
    },
    []
  )

  const balanceFilter = useCallback(
    (row: (typeof balanceRows)[number], col: string) => {
      switch (col) {
        case 'period':
          return toFilterCellValue(row.period_year_month)
        case 'item':
          return toFilterCellValue(row.item_nm)
        case 'location':
          return toFilterCellValue(`${row.location_cd} ${row.location_nm}`)
        case 'beg_qty':
          return toFilterCellValue(row.beg_qty)
        case 'qty':
          return toFilterCellValue(row.qty)
        default:
          return toFilterCellValue('')
      }
    },
    []
  )

  const currentGrid = useExcelLikeGrid({
    columns: traceCurrentColumns,
    rows: currentRows,
    getFilterValue: currentFilter,
    excelExport: {
      sheetName: 'Current',
      filenamePrefix: 'trace_current',
      getExportValue: (row, col) => {
        switch (col) {
          case 'item':
            return row.item_nm
          case 'location':
            return `${row.location_cd} ${row.location_nm}`
          case 'qty':
            return row.qty
          default:
            return ''
        }
      },
    },
  })

  const historyGrid = useExcelLikeGrid({
    columns: traceHistoryColumns,
    rows: historyRows,
    getFilterValue: historyFilter,
    excelExport: {
      sheetName: 'History',
      filenamePrefix: 'trace_history',
      getExportValue: (row, col) => {
        switch (col) {
          case 'type':
            return row.movetyps_nm ? `${row.movetyps_cd} / ${row.movetyps_nm}` : row.movetyps_cd
          case 'move_qty':
            return row.move_qty
          case 'qty':
            return row.qty
          case 'actual_at':
            return formatDateTime(row.actual_at)
          default:
            return ''
        }
      },
    },
  })

  const balanceGrid = useExcelLikeGrid({
    columns: traceBalanceColumns,
    rows: balanceRows,
    getFilterValue: balanceFilter,
    excelExport: {
      sheetName: 'Balances',
      filenamePrefix: 'trace_balances',
      getExportValue: (row, col) => {
        switch (col) {
          case 'period':
            return row.period_year_month
          case 'item':
            return row.item_nm
          case 'location':
            return `${row.location_cd} ${row.location_nm}`
          case 'beg_qty':
            return row.beg_qty
          case 'qty':
            return row.qty
          default:
            return ''
        }
      },
    },
  })

  const currentLayoutRef = useRef<GridColumnLayout | null>(null)
  const historyLayoutRef = useRef<GridColumnLayout | null>(null)
  const balanceLayoutRef = useRef<GridColumnLayout | null>(null)

  const handleRefresh = () => {
    if (lot.trim()) void runTrace(lot, locationText)
  }

  const handleSaveAllGridLayouts = () => {
    currentLayoutRef.current?.saveLayout()
    historyLayoutRef.current?.saveLayout()
    balanceLayoutRef.current?.saveLayout()
  }

  return (
    <ErpScreen
      error={error}
      className="erp-screen-stacked"
      title="Lot Trace"
      onRefresh={handleRefresh}
      onSaveGrid={result ? handleSaveAllGridLayouts : undefined}
    >
      {currentGrid.filterMenuElement}
      {currentGrid.contextMenuElement}
      {historyGrid.filterMenuElement}
      {historyGrid.contextMenuElement}
      {balanceGrid.filterMenuElement}
      {balanceGrid.contextMenuElement}
      <ErpSearchPanel>
        <form onSubmit={onSubmit} className="erp-search-form erp-search-form-suggest">
          <ErpSuggestInput
            value={lot}
            onChange={setLot}
            placeholder="Lot Number"
            ariaLabel="Lot Number"
            fieldClassName="erp-search-field-reference"
            fetchSuggestions={suggestCurrentLots}
          />
          <ErpSuggestInput
            value={locationText}
            onChange={setLocationText}
            placeholder="Location"
            ariaLabel="Location"
            fieldClassName="erp-search-field-supplier"
            fetchSuggestions={suggestLocations}
          />
          <div className="erp-search-actions">
            <button type="submit" className="btn erp-btn erp-btn-search" disabled={loading}>
              {loading ? 'Searching…' : 'Trace'}
            </button>
          </div>
        </form>
      </ErpSearchPanel>

      {result && (
        <>
          <ErpGridPanel
            gridId="trace-current-v1"
            title={`Current Stock — Lot ${lotTitle}`}
            columns={traceCurrentColumns}
            isEmpty={currentRows.length === 0}
            emptyText="No current stock for this lot"
            onLayoutReady={(layout) => {
              currentLayoutRef.current = layout
              currentGrid.onLayoutReady(layout)
            }}
            onGridContextMenu={currentGrid.openContextMenu}
            {...currentGrid.tableProps}
          >
            {(layout) => (
              <tbody>
                {currentGrid.displayRows.map((r, index) => (
                  <tr key={`${r.location_id}-${r.item_id}`} className={erpRowClass(index)}>
                    {layout.orderedColumns.map((col) => {
                      switch (col.key) {
                        case 'item':
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
                        case 'qty':
                          return <td key={col.key}>{formatQty(r.qty)}</td>
                        default:
                          return <td key={col.key} />
                      }
                    })}
                  </tr>
                ))}
              </tbody>
            )}
          </ErpGridPanel>

          <ErpGridPanel
            gridId="trace-history-v1"
            title="GR/GI History"
            columns={traceHistoryColumns}
            isEmpty={historyRows.length === 0}
            emptyText="No movements"
            onLayoutReady={(layout) => {
              historyLayoutRef.current = layout
              historyGrid.onLayoutReady(layout)
            }}
            onGridContextMenu={historyGrid.openContextMenu}
            {...historyGrid.tableProps}
          >
            {(layout) => (
              <tbody>
                {historyGrid.displayRows.map((h, index) => (
                  <tr key={h.inv_grgi_id} className={erpRowClass(index)}>
                    {layout.orderedColumns.map((col) => {
                      switch (col.key) {
                        case 'item':
                          return (
                            <td key={col.key}>
                              <ColoredItemName itemId={h.item_id}>{h.item_nm}</ColoredItemName>
                            </td>
                          )
                        case 'type':
                          return (
                            <td key={col.key}>
                              {h.movetyps_nm ? `${h.movetyps_cd} / ${h.movetyps_nm}` : h.movetyps_cd}
                            </td>
                          )
                        case 'move_qty':
                          return <td key={col.key}>{formatQty(h.move_qty)}</td>
                        case 'qty':
                          return <td key={col.key}>{formatQty(h.qty)}</td>
                        case 'actual_at':
                          return <td key={col.key}>{formatDateTime(h.actual_at)}</td>
                        default:
                          return <td key={col.key} />
                      }
                    })}
                  </tr>
                ))}
              </tbody>
            )}
          </ErpGridPanel>

          <ErpGridPanel
            gridId="trace-balance-v1"
            title="Period Balances"
            columns={traceBalanceColumns}
            isEmpty={balanceRows.length === 0}
            emptyText="No balance snapshots"
            onLayoutReady={(layout) => {
              balanceLayoutRef.current = layout
              balanceGrid.onLayoutReady(layout)
            }}
            onGridContextMenu={balanceGrid.openContextMenu}
            {...balanceGrid.tableProps}
          >
            {(layout) => (
              <tbody>
                {balanceGrid.displayRows.map((b, index) => (
                  <tr key={b.inv_balance_id} className={erpRowClass(index)}>
                    {layout.orderedColumns.map((col) => {
                      switch (col.key) {
                        case 'period':
                          return <td key={col.key}>{b.period_year_month}</td>
                        case 'item':
                          return (
                            <td key={col.key}>
                              <ColoredItemName itemId={b.item_id}>{b.item_nm}</ColoredItemName>
                            </td>
                          )
                        case 'location':
                          return (
                            <td key={col.key}>
                              <code>{b.location_cd}</code> {b.location_nm}
                            </td>
                          )
                        case 'beg_qty':
                          return <td key={col.key}>{formatQty(b.beg_qty)}</td>
                        case 'qty':
                          return <td key={col.key}>{formatQty(b.qty)}</td>
                        default:
                          return <td key={col.key} />
                      }
                    })}
                  </tr>
                ))}
              </tbody>
            )}
          </ErpGridPanel>
        </>
      )}
    </ErpScreen>
  )
}
