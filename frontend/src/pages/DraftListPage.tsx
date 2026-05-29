import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppNavigate, useAppViewRoute } from '../context/AppNavigateContext'
import { api } from '../api/client'
import { ErpSuggestInput } from '../components/ErpSuggestInput'
import { Alert } from '../components/Alert'
import { DraftDetailPanel, type LineGridLayoutApi } from '../components/DraftDetailPanel'
import { DraftHeaderEditCell } from '../components/DraftHeaderEditCells'
import { useDraftEdit } from '../hooks/useDraftEdit'
import { ResizableGridTable, type GridColumnDef } from '../components/ResizableGridTable'
import { useGridColumnLayout } from '../hooks/useGridColumnLayout'
import { useGridSort } from '../hooks/useGridSort'
import { GridColumnFilterMenu } from '../components/GridColumnFilterMenu'
import { GridContextMenu, type GridContextMenuState } from '../components/GridContextMenu'
import { downloadExcelSheet, exportFilename } from '../utils/exportExcel'
import { useGridColumnFilters } from '../hooks/useGridColumnFilters'
import { applyColumnFilters, collectUniqueFilterValues } from '../utils/gridColumnFilter'
import { compareDraftListItems, getDraftListFilterValue } from '../utils/draftGridSort'
import {
  APPROVE_ITEM_CD_REQUIRED_MSG,
  findDraftLineMissingItemCd,
  findLineMissingItemCd,
} from '../utils/draftEdit'
import { StatusBadge } from '../components/StatusBadge'
import { getDraftPageCopy, type DraftVariant } from '../config/draftPages'
import type { DraftListItem, DraftStatus } from '../types'
import { formatDate, formatDateTime } from '../utils/format'
import { suggestDraftLots, suggestItems, suggestSuppliers } from '../utils/searchSuggest'

const sourceLabelByVariant = {
  receipt: { manual: 'Manual', excel: 'Excel', pdf: 'PDF' },
  delivery: { manual: 'Manual', excel: 'Excel', pdf: 'PDF' },
} as const

type SearchFilters = {
  dateFrom: string
  dateTo: string
  supplier: string
  referenceNo: string
  item: string
  lot: string
}

type Props = {
  variant?: DraftVariant
}

const emptySearchFilters: SearchFilters = {
  dateFrom: '',
  dateTo: '',
  supplier: '',
  referenceNo: '',
  item: '',
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
  const navigate = useAppNavigate()
  const { search } = useAppViewRoute()
  const [status, setStatus] = useState<'' | DraftStatus>('')
  const [searchInput, setSearchInput] = useState<SearchFilters>(emptySearchFilters)
  const [appliedSearch, setAppliedSearch] = useState<SearchFilters>(emptySearchFilters)
  const [drafts, setDrafts] = useState<DraftListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [detailRefresh, setDetailRefresh] = useState(0)
  const [headerGridMenu, setHeaderGridMenu] = useState<GridContextMenuState>(null)
  const [, setGridLayoutTick] = useState(0)
  const [lineGridLayoutApi, setLineGridLayoutApi] = useState<LineGridLayoutApi | null>(null)

  const bumpGridLayout = useCallback(() => setGridLayoutTick((n) => n + 1), [])

  const selectedId = useMemo(() => {
    const raw = new URLSearchParams(search).get('id')
    if (!raw) return null
    const id = Number(raw)
    return Number.isNaN(id) ? null : id
  }, [search])

  const selectedDraft = useMemo(
    () => drafts.find((d) => d.inv_receipt_draft_id === selectedId) ?? null,
    [drafts, selectedId]
  )

  const draftEdit = useDraftEdit(selectedId, variant, detailRefresh)

  const filters: { value: '' | DraftStatus; label: string }[] = [
    { value: '', label: copy.filterAll },
    { value: 'registered', label: copy.filterPending },
    { value: 'approved', label: copy.filterApproved },
    { value: 'cancelled', label: copy.filterCancelled },
  ]

  const fetchItemSuggestions = useCallback((q: string) => suggestItems(q), [])
  const fetchSupplierSuggestions = useCallback((q: string) => suggestSuppliers(q), [])
  const fetchLotSuggestions = useCallback((q: string) => suggestDraftLots(q, variant), [variant])

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
          supplier_q: appliedSearch.supplier.trim() || undefined,
          reference_no: appliedSearch.referenceNo.trim() || undefined,
          item_q: appliedSearch.item.trim() || undefined,
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
    navigate(copy.listPathWithId(id), { replace: true })
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
    if (draftEdit.canEdit) {
      if (findLineMissingItemCd(draftEdit.editLines)) {
        window.alert(APPROVE_ITEM_CD_REQUIRED_MSG)
        return
      }
    } else if (findDraftLineMissingItemCd(draftEdit.draft?.lines ?? [])) {
      window.alert(APPROVE_ITEM_CD_REQUIRED_MSG)
      return
    }
    if (!confirm(copy.approveConfirm)) return
    setActing(true)
    setError(null)
    setMessage(null)
    try {
      if (draftEdit.canEdit) {
        const saved = await draftEdit.save()
        if (!saved) return
      }
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

  async function handleRestore() {
    if (!selectedId || selectedDraft?.status !== 'cancelled') return
    if (!confirm(copy.restoreConfirm)) return
    setActing(true)
    setError(null)
    setMessage(null)
    try {
      await api.restoreDraft(selectedId, variant)
      setMessage(copy.restoredMsg)
      refreshDetail()
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.restoreFail)
    } finally {
      setActing(false)
    }
  }

  async function handleDelete() {
    if (!selectedId || selectedDraft?.status !== 'cancelled') return
    if (!confirm(copy.deleteConfirm)) return
    setActing(true)
    setError(null)
    setMessage(null)
    try {
      await api.deleteDraft(selectedId, variant)
      setMessage(copy.deletedMsg)
      navigate(copy.listPath, { replace: true })
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.deleteFail)
    } finally {
      setActing(false)
    }
  }

  const canApprove =
    selectedDraft?.status === 'registered' && (selectedDraft?.line_count ?? 0) > 0
  const canCancel =
    selectedDraft?.status === 'registered' || selectedDraft?.status === 'approved'
  const canRestore = selectedDraft?.status === 'cancelled'
  const canDelete = selectedDraft?.status === 'cancelled'

  const headerColumns = useMemo((): GridColumnDef[] => {
    const cols: GridColumnDef[] = [
      { key: 'date', label: copy.dateColumn, defaultWidth: 128 },
      { key: 'supplier', label: copy.supplierCol, defaultWidth: 96 },
      { key: 'reference', label: copy.referenceCol, defaultWidth: 96 },
      { key: 'source', label: copy.sourceCol, defaultWidth: 72 },
      { key: 'status', label: copy.statusCol, defaultWidth: 88 },
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

  const headerGridId = `${variant}-header-v3`
  const headerLayout = useGridColumnLayout(headerGridId, headerColumns, {
    onLayoutChange: bumpGridLayout,
  })

  const gridLayoutDirty = headerLayout.isDirty || (lineGridLayoutApi?.isDirty ?? false)

  const handleSaveGrid = () => {
    headerLayout.saveLayout()
    lineGridLayoutApi?.saveLayout()
    setMessage(copy.saveGridSuccessMsg)
    setGridLayoutTick((n) => n + 1)
  }

  const handleSaveDraft = async () => {
    setError(null)
    setMessage(null)
    const ok = await draftEdit.save()
    if (ok) {
      setMessage(copy.saveSuccessMsg)
      refreshDetail()
    } else if (draftEdit.error) {
      setError(draftEdit.error)
    }
  }
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

  const isListHeaderEditable = (draftId: number, d: DraftListItem) =>
    selectedId === draftId &&
    d.status === 'registered' &&
    draftEdit.canEdit &&
    draftEdit.headerEdit != null

  const renderHeaderCell = (colKey: string, d: DraftListItem, draftId: number) => {
    const editable = isListHeaderEditable(draftId, d)
    const header = draftEdit.headerEdit

    if (editable && header && (colKey === 'date' || colKey === 'reference' || colKey === 'supplier' || colKey === 'notes')) {
      return (
        <td
          key={colKey}
          className="erp-grid-cell-edit"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <DraftHeaderEditCell
            colKey={colKey}
            header={header}
            onPatch={draftEdit.patchHeader}
            suppliers={draftEdit.suppliers}
            copy={copy}
          />
        </td>
      )
    }

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
        return <td key={colKey}>{formatDate(d.receipt_at)}</td>
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
          <div className="erp-search-row erp-search-form-suggest">
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
            <ErpSuggestInput
              value={searchInput.supplier}
              onChange={(supplier) => setSearchInput((prev) => ({ ...prev, supplier }))}
              placeholder={copy.supplierLabel}
              ariaLabel={copy.supplierLabel}
              fieldClassName="erp-search-field-supplier"
              fetchSuggestions={fetchSupplierSuggestions}
            />
            <label className="erp-search-field erp-search-field-reference">
              <input
                type="text"
                className="erp-input"
                value={searchInput.referenceNo}
                placeholder={copy.filterReferencePh}
                aria-label={copy.filterReferencePh}
                onChange={(e) =>
                  setSearchInput((prev) => ({ ...prev, referenceNo: e.target.value }))
                }
              />
            </label>
            <ErpSuggestInput
              value={searchInput.item}
              onChange={(item) => setSearchInput((prev) => ({ ...prev, item }))}
              placeholder={`${copy.itemCdLabel} - ${copy.itemNmLabel}`}
              ariaLabel={copy.itemLabel}
              fieldClassName="erp-search-field-item"
              fetchSuggestions={fetchItemSuggestions}
            />
            <ErpSuggestInput
              value={searchInput.lot}
              onChange={(lot) => setSearchInput((prev) => ({ ...prev, lot }))}
              placeholder={copy.filterLotPh}
              ariaLabel={copy.filterLotPh}
              fieldClassName="erp-search-field-lot"
              fetchSuggestions={fetchLotSuggestions}
            />
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
                disabled={acting || draftEdit.saving}
                onClick={handleCancel}
              >
                {copy.cancelActionBtn}
              </button>
            )}
            {selectedId && draftEdit.canEdit && (
              <button
                type="button"
                className="btn erp-btn erp-btn-search"
                disabled={acting || draftEdit.saving}
                onClick={() => void handleSaveDraft()}
              >
                {draftEdit.saving ? copy.submittingCreate : copy.detailSaveBtn}
              </button>
            )}
            {selectedId && canRestore && (
              <button
                type="button"
                className="btn erp-btn erp-btn-new"
                disabled={acting}
                onClick={() => void handleRestore()}
              >
                {copy.restoreBtn}
              </button>
            )}
            {selectedId && canDelete && (
              <button
                type="button"
                className="btn erp-btn erp-btn-cancel"
                disabled={acting}
                onClick={() => void handleDelete()}
              >
                {copy.deleteBtn}
              </button>
            )}
            <button
              type="button"
              className="btn erp-btn erp-btn-search"
              disabled={!gridLayoutDirty}
              title={copy.saveGridBtn}
              onClick={handleSaveGrid}
            >
              {copy.saveGridBtn}
            </button>
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
                  const isEditingHeader = isListHeaderEditable(id, d)
                  return (
                    <tr
                      key={id}
                      className={
                        isSelected
                          ? `selected${isEditingHeader ? ' erp-grid-row-editing' : ''}`
                          : index % 2 === 1
                            ? 'row-alt'
                            : undefined
                      }
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
            edit={draftEdit}
            onSaved={refreshDetail}
            onLineGridLayout={setLineGridLayoutApi}
            onLineGridLayoutChange={bumpGridLayout}
          />
        </div>
      </div>
    </div>
  )
}
