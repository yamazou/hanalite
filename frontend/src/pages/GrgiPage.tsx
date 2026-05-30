import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { ErpSuggestInput } from '../components/ErpSuggestInput'
import { ItemSearchPicker } from '../components/ItemSearchPicker'
import { ErpGridPanel, erpRowClass } from '../components/erp/ErpGridPanel'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpSearchPanel } from '../components/erp/ErpSearchPanel'
import { grgiHistoryColumns } from '../components/erp/masterGridColumns'
import type { ItemSearchRow } from '../types/masters'
import { useMasterCatalog } from '../context/MasterCatalogContext'
import type { GrgiHistory } from '../types/inventory'
import { useExcelLikeGrid } from '../hooks/useExcelLikeGrid'
import type { GridColumnLayout } from '../hooks/useGridColumnLayout'
import { datetimeLocalToIso, formatDateTime, formatQty, toDatetimeLocalValue } from '../utils/format'
import { ColoredItemName } from '../components/ColoredItemText'
import { toFilterCellValue } from '../utils/gridColumnFilter'
import { resolveLocationIdFromText, suggestCurrentLots, suggestLocations } from '../utils/searchSuggest'

export function GrgiPage() {
  const [history, setHistory] = useState<GrgiHistory[]>([])
  const { movetyps } = useMasterCatalog()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [selectedItem, setSelectedItem] = useState<ItemSearchRow | null>(null)
  const [lot, setLot] = useState('')
  const [moveQty, setMoveQty] = useState('')
  const [movetypsId, setMovetypsId] = useState('')
  const [locationText, setLocationText] = useState('')
  const [fromLocationText, setFromLocationText] = useState('')
  const [toLocationText, setToLocationText] = useState('')
  const [moveLot, setMoveLot] = useState('')
  const [moveQtyMv, setMoveQtyMv] = useState('')
  const [actualAt, setActualAt] = useState(toDatetimeLocalValue())
  const [submitting, setSubmitting] = useState(false)
  const grgiMovetyps = movetyps.filter((m) => m.movetyps_cd === 'GR' || m.movetyps_cd === 'GI')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const h = await api.listGrgiHistory(80)
      setHistory(h)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (grgiMovetyps.length && !movetypsId) {
      setMovetypsId(String(grgiMovetyps[0].movetyps_id))
    }
  }, [grgiMovetyps, movetypsId])

  useEffect(() => {
    load()
  }, [load])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedItem) {
      setError('Select an item.')
      return
    }
    const locationId = await resolveLocationIdFromText(locationText)
    if (!locationId) {
      setError('Select a valid location from the list.')
      return
    }
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      await api.createGrgi({
        item_id: selectedItem.item_id,
        location_id: locationId,
        lot: lot.trim(),
        move_qty: Number(moveQty),
        movetyps_id: Number(movetypsId),
        actual_at: datetimeLocalToIso(actualAt),
      })
      setSuccess('Movement posted.')
      setLot('')
      setMoveQty('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post movement')
    } finally {
      setSubmitting(false)
    }
  }

  const onMove = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedItem) {
      setError('Select an item.')
      return
    }
    const fromLocationId = await resolveLocationIdFromText(fromLocationText)
    const toLocationId = await resolveLocationIdFromText(toLocationText)
    if (!fromLocationId || !toLocationId) {
      setError('Select valid from/to locations from the list.')
      return
    }
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      await api.createLocationMove({
        item_id: selectedItem.item_id,
        from_location_id: fromLocationId,
        to_location_id: toLocationId,
        lot: moveLot.trim(),
        qty: Number(moveQtyMv),
        actual_at: datetimeLocalToIso(actualAt),
      })
      setSuccess('Location transfer (MV) posted.')
      setMoveLot('')
      setMoveQtyMv('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post location transfer')
    } finally {
      setSubmitting(false)
    }
  }

  const renderItemPicker = (form: 'grgi' | 'mv') => (
    <span className="erp-search-field erp-search-field-item" key={form}>
      <ItemSearchPicker
        hideLabel
        label="Item code - Item name"
        value={selectedItem}
        onChange={setSelectedItem}
        showInlineClear={false}
        required
      />
    </span>
  )

  const getFilterValue = useCallback((row: GrgiHistory, col: string) => {
    switch (col) {
      case 'id':
        return toFilterCellValue(row.inv_grgi_id)
      case 'item':
        return toFilterCellValue(row.item_nm)
      case 'location':
        return toFilterCellValue(`${row.location_cd} ${row.location_nm}`)
      case 'lot':
        return toFilterCellValue(row.lot)
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
  }, [])

  const [gridLayout, setGridLayout] = useState<GridColumnLayout | null>(null)

  const grid = useExcelLikeGrid({
    columns: grgiHistoryColumns,
    rows: history,
    getFilterValue,
    excelExport: {
      sheetName: 'GR/GI History',
      filenamePrefix: 'grgi_history',
      getExportValue: (row, col) => {
        switch (col) {
          case 'id':
            return row.inv_grgi_id
          case 'item':
            return row.item_nm
          case 'location':
            return `${row.location_cd} ${row.location_nm}`
          case 'lot':
            return row.lot
          case 'type':
            return row.movetyps_cd
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

  const renderActualAtInput = (form: 'grgi' | 'mv') => (
    <label className="erp-search-field erp-search-field-date" key={form}>
      <input
        type="datetime-local"
        className="erp-input erp-input-date"
        value={actualAt}
        aria-label="Actual Date/Time"
        onChange={(e) => setActualAt(e.target.value)}
        required
      />
    </label>
  )

  return (
    <ErpScreen
      error={error}
      success={success}
      className="erp-screen-stacked"
      title="GR/GI Movements"
      onRefresh={load}
      onSaveGrid={() => gridLayout?.saveLayout()}
      saveGridIsDirty={gridLayout?.isDirty}
    >
      {grid.filterMenuElement}
      {grid.contextMenuElement}
      <ErpSearchPanel>
        <form onSubmit={onSubmit} className="erp-search-form erp-search-form-suggest">
          <span className="erp-search-section-label">GR/GI</span>
          {renderItemPicker('grgi')}
          <ErpSuggestInput
            value={locationText}
            onChange={setLocationText}
            placeholder="Location"
            ariaLabel="Location"
            fieldClassName="erp-search-field-supplier"
            fetchSuggestions={suggestLocations}
          />
          <ErpSuggestInput
            value={lot}
            onChange={setLot}
            placeholder="Lot"
            ariaLabel="Lot"
            fieldClassName="erp-search-field-reference"
            fetchSuggestions={suggestCurrentLots}
          />
          <label className="erp-search-field">
            <select
              className="erp-input"
              value={movetypsId}
              aria-label="Move Type"
              onChange={(e) => setMovetypsId(e.target.value)}
              required
            >
              {grgiMovetyps.map((m) => (
                <option key={m.movetyps_id} value={m.movetyps_id}>
                  {m.movetyps_nm ? `${m.movetyps_cd} / ${m.movetyps_nm}` : m.movetyps_cd}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-search-field erp-search-field-qty">
            <input
              type="number"
              className="erp-input"
              step="0.001"
              min="0.001"
              value={moveQty}
              onChange={(e) => setMoveQty(e.target.value)}
              placeholder="Qty"
              aria-label="Qty"
              required
            />
          </label>
          {renderActualAtInput('grgi')}
          <div className="erp-search-actions">
            <button type="submit" className="btn erp-btn erp-btn-search" disabled={submitting}>
              {submitting ? 'Saving…' : 'Post GR/GI'}
            </button>
          </div>
        </form>
      </ErpSearchPanel>

      <ErpSearchPanel>
        <form onSubmit={onMove} className="erp-search-form erp-search-form-suggest">
          <span className="erp-search-section-label">MV</span>
          {renderItemPicker('mv')}
          <ErpSuggestInput
            value={fromLocationText}
            onChange={setFromLocationText}
            placeholder="From"
            ariaLabel="From Location"
            fieldClassName="erp-search-field-supplier"
            fetchSuggestions={suggestLocations}
          />
          <ErpSuggestInput
            value={toLocationText}
            onChange={setToLocationText}
            placeholder="To"
            ariaLabel="To Location"
            fieldClassName="erp-search-field-supplier"
            fetchSuggestions={suggestLocations}
          />
          <ErpSuggestInput
            value={moveLot}
            onChange={setMoveLot}
            placeholder="Lot"
            ariaLabel="Lot"
            fieldClassName="erp-search-field-reference"
            fetchSuggestions={suggestCurrentLots}
          />
          <label className="erp-search-field erp-search-field-qty">
            <input
              type="number"
              className="erp-input"
              step="0.001"
              min="0.001"
              value={moveQtyMv}
              onChange={(e) => setMoveQtyMv(e.target.value)}
              placeholder="Qty"
              aria-label="Qty"
              required
            />
          </label>
          {renderActualAtInput('mv')}
          <div className="erp-search-actions">
            <button type="submit" className="btn erp-btn erp-btn-search" disabled={submitting}>
              {submitting ? 'Saving…' : 'Post Transfer'}
            </button>
          </div>
        </form>
      </ErpSearchPanel>

      <ErpGridPanel
        gridId="inventory-grgi-history-v1"
        hidePanelTitleBar
        columns={grgiHistoryColumns}
        loading={loading}
        isEmpty={!loading && history.length === 0}
        emptyText="No history"
        panelClassName="erp-panel-grow-main"
        onLayoutReady={(layout) => {
          setGridLayout(layout)
          grid.onLayoutReady(layout)
        }}
        onGridContextMenu={grid.openContextMenu}
        {...grid.tableProps}
      >
        {(layout) => (
          <tbody>
            {grid.displayRows.map((h, index) => (
              <tr key={h.inv_grgi_id} className={erpRowClass(index)}>
                {layout.orderedColumns.map((col) => {
                  switch (col.key) {
                    case 'id':
                      return <td key={col.key}>{h.inv_grgi_id}</td>
                    case 'item':
                      return (
                        <td key={col.key}>
                          <ColoredItemName itemId={h.item_id}>{h.item_nm}</ColoredItemName>
                        </td>
                      )
                    case 'location':
                      return (
                        <td key={col.key}>
                          <code>{h.location_cd}</code> {h.location_nm}
                        </td>
                      )
                    case 'lot':
                      return (
                        <td key={col.key}>
                          <code>{h.lot}</code>
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
    </ErpScreen>
  )
}
