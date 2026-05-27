import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Alert } from '../components/Alert'
import { DraftDetailPanel } from '../components/DraftDetailPanel'
import { ResizableGridTable, type GridColumnDef } from '../components/ResizableGridTable'
import { useGridColumnLayout } from '../hooks/useGridColumnLayout'
import { useGridSort } from '../hooks/useGridSort'
import { GridColumnFilterMenu } from '../components/GridColumnFilterMenu'
import { GridContextMenu, type GridContextMenuState } from '../components/GridContextMenu'
import { downloadExcelSheet, exportFilename } from '../utils/exportExcel'
import { useGridColumnFilters } from '../hooks/useGridColumnFilters'
import { applyColumnFilters, collectUniqueFilterValues } from '../utils/gridColumnFilter'
import { compareDraftListItems, getDraftListFilterValue } from '../utils/draftGridSort'
import { StatusBadge } from '../components/StatusBadge'
import { getDraftPageCopy, type DraftVariant } from '../config/draftPages'
import type { DraftListItem, DraftStatus, Item, Supplier } from '../types'
import { formatDateTime, formatItemLabel } from '../utils/format'

const sourceLabelByVariant = {
  receipt: { manual: 'Manual', excel: 'Excel', pdf: 'PDF' },
  delivery: { manual: 'Manual', excel: 'Excel', pdf: 'PDF' },
} as const

type SearchFilters = {
  dateFrom: string
  dateTo: string
  supplierId: number | ''
  itemId: number | ''
  lot: string
}

type Props = {
  variant?: DraftVariant
}

const emptySearchFilters: SearchFilters = {
  dateFrom: '',
  dateTo: '',
  supplierId: '',
  itemId: '',
  lot: '',
}

function cellText(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '-'
}

function SearchDateInput({
  value,
  placeholder,
  onChange,
  className,
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <span className={`erp-input-wrap${value ? '' : ' is-empty'}`}>
      <input
        type="date"
        className={className}
        value={value}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {!value && <span className="erp-input-ghost">{placeholder}</span>}
    </span>
  )
}

export function DraftListPage({ variant = 'receipt' }: Props) {
  const copy = getDraftPageCopy(variant)
  const sourceLabel = sourceLabelByVariant[variant]
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [status, setStatus] = useState<'' | DraftStatus>('')
  const [searchInput, setSearchInput] = useState<SearchFilters>(emptySearchFilters)
  const [appliedSearch, setAppliedSearch] = useState<SearchFilters>(emptySearchFilters)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [drafts, setDrafts] = useState<DraftListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [detailRefresh, setDetailRefresh] = useState(0)
  const [headerGridMenu, setHeaderGridMenu] = useState<GridContextMenuState>(null)

  const selectedId = useMemo(() => {
    const raw = searchParams.get('id')
    if (!raw) return null
    const id = Number(raw)
    return Number.isNaN(id) ? null : id
  }, [searchParams])

  const selectedDraft = useMemo(
    () => drafts.find((d) => d.inv_receipt_draft_id === selectedId) ?? null,
    [drafts, selectedId]
  )

  const filters: { value: '' | DraftStatus; label: string }[] = [
    { value: '', label: copy.filterAll },
    { value: 'registered', label: copy.filterPending },
    { value: 'approved', label: copy.filterApproved },
    { value: 'cancelled', label: copy.filterCancelled },
  ]

  useEffect(() => {
    api
      .listSuppliers()
      .then(setSuppliers)
      .catch(() => setSuppliers([]))
    api
      .listItems()
      .then(setItems)
      .catch(() => setItems([]))
  }, [])

  useEffect(() => {
    const prev = document.title
    document.title = copy.documentTitle
    return () => {
      document.title = prev
    }
  }, [copy.documentTitle])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listDrafts(
        {
          status: status || undefined,
          date_from: appliedSearch.dateFrom || undefined,
          date_to: appliedSearch.dateTo || undefined,
          suppliers_id: appliedSearch.supplierId === '' ? undefined : appliedSearch.supplierId,
          item_id: appliedSearch.itemId === '' ? undefined : appliedSearch.itemId,
          lot: appliedSearch.lot.trim() || undefined,
        },
        variant
      )
      setDrafts(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.loadFail)
    } finally {
      setLoading(false)
    }
  }, [status, appliedSearch, copy.loadFail, variant])

  useEffect(() => {
    load()
  }, [load])

  const selectDraft = (id: number) => {
    setSearchParams({ id: String(id) })
    setMessage(null)
  }

  const refreshDetail = () => {
    setDetailRefresh((v) => v + 1)
    void load()
  }

  const applySearchFilters = () => {
    if (searchInput.dateFrom && searchInput.dateTo && searchInput.dateFrom > searchInput.dateTo) {
      setError(copy.filterDateRangeError)
      return
    }
    setError(null)
    setAppliedSearch(searchInput)
  }

  const clearSearchFilters = () => {
    setSearchInput(emptySearchFilters)
    setAppliedSearch(emptySearchFilters)
    setError(null)
  }

  async function handleApprove() {
    if (!selectedId || !selectedDraft) return
    if (!confirm(copy.approveConfirm)) return
    setActing(true)
    setError(null)
    setMessage(null)
    try {
      await api.approveDraft(selectedId, variant)
      setMessage(copy.approvedMsg)
      refreshDetail()
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.approveFail)
    } finally {
      setActing(false)
    }
  }

  async function handleCancel() {
    if (!selectedId || !selectedDraft) return
    const wasApproved = selectedDraft.status === 'approved'
    const msg = wasApproved ? copy.cancelApprovedConfirm : copy.cancelDraftConfirm
    if (!confirm(msg)) return
    setActing(true)
    setError(null)
    setMessage(null)
    try {
      await api.cancelDraft(selectedId, variant)
      setMessage(wasApproved ? copy.revertedToRegisteredMsg : copy.cancelledMsg)
      refreshDetail()
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.cancelFail)
    } finally {
      setActing(false)
    }
  }

  const canApprove =
    selectedDraft?.status === 'registered' && (selectedDraft?.line_count ?? 0) > 0
  const canCancel =
    selectedDraft?.status === 'registered' || selectedDraft?.status === 'approved'

  const headerColumns = useMemo((): GridColumnDef[] => {
    const cols: GridColumnDef[] = [
      { key: 'source', label: copy.sourceCol, defaultWidth: 72 },
      { key: 'status', label: copy.statusCol, defaultWidth: 88 },
      { key: 'date', label: copy.dateColumn, defaultWidth: 128 },
      { key: 'reference', label: copy.referenceCol, defaultWidth: 96 },
      { key: 'supplier', label: copy.supplierCol, defaultWidth: 96 },
      { key: 'notes', label: copy.notesLabel, defaultWidth: 120 },
      { key: 'lines', label: copy.linesCol, defaultWidth: 52, className: 'erp-col-num' },
      { key: 'created', label: copy.createdCol, defaultWidth: 128 },
      { key: 'approved', label: copy.approvedAtLabel, defaultWidth: 128 },
      { key: 'cancelled', label: copy.cancelledAtLabel, defaultWidth: 128 },
    ]
    if (copy.showPdfImport) {
      cols.push({ key: 'pdf', label: copy.attachmentTitle ?? 'PDF', defaultWidth: 80 })
    }
    return cols
  }, [copy])

  const headerGridId = `${variant}-header${copy.showPdfImport ? '-pdf' : ''}`
  const headerLayout = useGridColumnLayout(headerGridId, headerColumns)
  const headerSort = useGridSort()
  const headerFilters = useGridColumnFilters()
  const [headerFilterMenu, setHeaderFilterMenu] = useState<{
    key: string
    label: string
    rect: DOMRect
  } | null>(null)

  const getHeaderFilterValue = useCallback(
    (row: DraftListItem, col: string) =>
      getDraftListFilterValue(row, col, sourceLabel, copy.openPdfBtn ?? 'PDF'),
    [sourceLabel, copy.openPdfBtn]
  )

  const headerFilterOptions = useMemo(() => {
    if (!headerFilterMenu) return []
    return collectUniqueFilterValues(drafts, headerFilterMenu.key, getHeaderFilterValue)
  }, [headerFilterMenu, drafts, getHeaderFilterValue])

  const filteredDrafts = useMemo(
    () => applyColumnFilters(drafts, headerFilters.filters, getHeaderFilterValue),
    [drafts, headerFilters.filters, getHeaderFilterValue]
  )

  const sortedDrafts = useMemo(() => {
    if (!headerSort.sort) return filteredDrafts
    const { key, dir } = headerSort.sort
    return [...filteredDrafts].sort((a, b) => compareDraftListItems(a, b, key, dir, sourceLabel))
  }, [filteredDrafts, headerSort.sort, sourceLabel])

  const headerFilterColumnLabel =
    headerColumns.find((c) => c.key === headerFilterMenu?.key)?.label ?? headerFilterMenu?.label ?? ''

  const exportHeaderGridToExcel = () => {
    const columns = headerLayout.orderedColumns
    const headers = columns.map((col) => col.label)
    const rows = sortedDrafts.map((d) =>
      columns.map((col) =>
        getDraftListFilterValue(d, col.key, sourceLabel, copy.openPdfBtn ?? 'PDF')
      )
    )
    downloadExcelSheet(
      copy.exportHeaderSheet,
      headers,
      rows,
      exportFilename(variant === 'delivery' ? 'delivery_drafts' : 'receipt_drafts')
    )
  }

  const renderHeaderCell = (colKey: string, d: DraftListItem, draftId: number) => {
    switch (colKey) {
      case 'source':
        return <td key={colKey}>{sourceLabel[d.source_type] ?? d.source_type}</td>
      case 'status':
        return (
          <td key={colKey}>
            <StatusBadge status={d.status} />
          </td>
        )
      case 'date':
        return <td key={colKey}>{formatDateTime(d.receipt_at)}</td>
      case 'reference':
        return (
          <td key={colKey} className="erp-link-cell">
            {cellText(d.reference_no)}
          </td>
        )
      case 'supplier':
        return <td key={colKey}>{cellText(d.supplier_nm)}</td>
      case 'notes':
        return <td key={colKey}>{cellText(d.notes)}</td>
      case 'lines':
        return (
          <td key={colKey} className="erp-col-num">
            {d.line_count}
          </td>
        )
      case 'created':
        return <td key={colKey}>{formatDateTime(d.created_at)}</td>
      case 'approved':
        return <td key={colKey}>{formatDateTime(d.approved_at)}</td>
      case 'cancelled':
        return <td key={colKey}>{formatDateTime(d.cancelled_at)}</td>
      case 'pdf':
        return (
          <td key={colKey} onClick={(e) => e.stopPropagation()}>
            {d.has_attachment ? (
              <a
                className="erp-link-cell"
                href={api.attachmentUrl(draftId, variant)}
                target="_blank"
                rel="noreferrer"
              >
                {copy.openPdfBtn}
              </a>
            ) : (
              '-'
            )}
          </td>
        )
      default:
        return null
    }
  }

  return (
    <div className="erp-screen">
      <GridContextMenu
        menu={headerGridMenu}
        excelLabel={copy.exportExcelLabel}
        onExcel={exportHeaderGridToExcel}
        onClose={() => setHeaderGridMenu(null)}
      />
      {headerFilterMenu && (
        <GridColumnFilterMenu
          columnLabel={headerFilterColumnLabel}
          options={headerFilterOptions}
          selected={headerFilters.getSelected(headerFilterMenu.key, headerFilterOptions)}
          anchorRect={headerFilterMenu.rect}
          onApply={(selected) =>
            headerFilters.applySelection(headerFilterMenu.key, selected, headerFilterOptions)
          }
          onClear={() => headerFilters.clearColumn(headerFilterMenu.key)}
          onClose={() => setHeaderFilterMenu(null)}
        />
      )}
      {error && <Alert type="error" message={error} />}
      {message && <Alert type="success" message={message} />}

      <div className="erp-panel erp-panel-search">
        <div className="erp-panel-body erp-search-body">
          <div className="erp-search-row">
            <div className="erp-search-field erp-search-field-date">
              <span className="erp-search-date-range">
                <SearchDateInput
                  className="erp-input erp-input-date"
                  value={searchInput.dateFrom}
                  placeholder={copy.filterDateFromPh}
                  onChange={(dateFrom) => setSearchInput((prev) => ({ ...prev, dateFrom }))}
                />
                <span className="erp-search-date-sep" aria-hidden="true">
                  –
                </span>
                <SearchDateInput
                  className="erp-input erp-input-date"
                  value={searchInput.dateTo}
                  placeholder={copy.filterDateToPh}
                  onChange={(dateTo) => setSearchInput((prev) => ({ ...prev, dateTo }))}
                />
              </span>
            </div>
            <label className="erp-search-field erp-search-field-supplier">
              <select
                className={`erp-input${searchInput.supplierId === '' ? ' erp-input-empty' : ''}`}
                value={searchInput.supplierId}
                aria-label={copy.supplierLabel}
                onChange={(e) =>
                  setSearchInput((prev) => ({
                    ...prev,
                    supplierId: e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
              >
                <option value="">{copy.supplierLabel}</option>
                {suppliers.map((s) => (
                  <option key={s.suppliers_id} value={s.suppliers_id}>
                    {s.suppliers_nm}
                  </option>
                ))}
              </select>
            </label>
            <label className="erp-search-field erp-search-field-item">
              <select
                className={`erp-input${searchInput.itemId === '' ? ' erp-input-empty' : ''}`}
                value={searchInput.itemId}
                aria-label={copy.itemLabel}
                onChange={(e) =>
                  setSearchInput((prev) => ({
                    ...prev,
                    itemId: e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
              >
                <option value="">{copy.itemLabel}</option>
                {items.map((item) => (
                  <option key={item.item_id} value={item.item_id}>
                    {formatItemLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label className="erp-search-field erp-search-field-lot">
              <input
                type="text"
                className="erp-input erp-input-lot"
                value={searchInput.lot}
                placeholder={copy.lotPlaceholder}
                aria-label={copy.lotLabel}
                onChange={(e) => setSearchInput((prev) => ({ ...prev, lot: e.target.value }))}
              />
            </label>
            <div className="erp-search-actions">
              <button type="button" className="btn erp-btn erp-btn-search" onClick={applySearchFilters}>
                {copy.filterApply}
              </button>
              <button type="button" className="btn erp-btn erp-btn-clear" onClick={clearSearchFilters}>
                {copy.filterClear}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="erp-panel erp-panel-grow">
        <div className="erp-panel-content">
        <div className="erp-toolbar">
          <div className="erp-toolbar-left">
            {filters.map((f) => (
              <button
                key={f.value || 'all'}
                type="button"
                className={`erp-tab ${status === f.value ? 'active' : ''}`}
                onClick={() => setStatus(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="erp-toolbar-right">
            {selectedId && canApprove && (
              <button
                type="button"
                className="btn erp-btn erp-btn-approve"
                disabled={acting}
                onClick={handleApprove}
              >
                {copy.approveBtn}
              </button>
            )}
            {selectedId && canCancel && (
              <button
                type="button"
                className="btn erp-btn erp-btn-cancel"
                disabled={acting}
                onClick={handleCancel}
              >
                {copy.cancelActionBtn}
              </button>
            )}
            <button type="button" className="btn erp-btn erp-btn-clear" onClick={load}>
              {copy.refreshBtn}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="muted erp-grid-empty">{copy.loadingText}</p>
        ) : drafts.length === 0 ? (
          <p className="muted erp-grid-empty">{copy.noDataText}</p>
        ) : (
          <div
            className="erp-grid-wrap erp-grid-wrap-header"
            onContextMenu={(event) => {
              event.preventDefault()
              setHeaderGridMenu({ x: event.clientX, y: event.clientY })
            }}
          >
            <ResizableGridTable
              layout={headerLayout}
              className="draft-list-table"
              sortMark={headerSort.sortMark}
              onHeaderDoubleClick={headerSort.toggleSort}
              isColumnFilterActive={headerFilters.isActive}
              onFilterClick={(key, anchor) => {
                const col = headerColumns.find((c) => c.key === key)
                setHeaderFilterMenu({
                  key,
                  label: col?.label ?? key,
                  rect: anchor.getBoundingClientRect(),
                })
              }}
            >
              <tbody>
                {sortedDrafts.map((d, index) => {
                  const id = d.inv_receipt_draft_id
                  const isSelected = selectedId === id
                  return (
                    <tr
                      key={id}
                      className={isSelected ? 'selected' : index % 2 === 1 ? 'row-alt' : undefined}
                      onClick={() => selectDraft(id)}
                      onDoubleClick={(event) => {
                        event.stopPropagation()
                        navigate(`${copy.newPath}?id=${id}`)
                      }}
                    >
                      {headerLayout.orderedColumns.map((col) => renderHeaderCell(col.key, d, id))}
                    </tr>
                  )
                })}
              </tbody>
            </ResizableGridTable>
          </div>
        )}

        {selectedDraft?.parse_message && selectedDraft.status === 'registered' && (
          <div className="erp-hint">
            <strong>{copy.parseMsgLabel}</strong> {selectedDraft.parse_message}
          </div>
        )}
        </div>
      </div>

      <div className="erp-panel erp-panel-grow erp-detail-panel">
        <div className="erp-panel-body erp-panel-content">
          <DraftDetailPanel
            draftId={selectedId}
            variant={variant}
            refreshToken={detailRefresh}
            onUpdated={refreshDetail}
          />
        </div>
      </div>
    </div>
  )
}
