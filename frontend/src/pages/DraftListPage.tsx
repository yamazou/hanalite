import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useAppNavigate, useAppViewRoute } from '../context/AppNavigateContext'
import { api } from '../api/client'
import { ErpSuggestInput } from '../components/ErpSuggestInput'
import { Alert } from '../components/Alert'
import { DraftDetailPanel, type LineGridLayoutApi } from '../components/DraftDetailPanel'
import { DraftHeaderEditCell } from '../components/DraftHeaderEditCells'
import { useDraftEdit } from '../hooks/useDraftEdit'
import { GRID_ROWNUM_COLUMN, GridRowNumCell } from '../components/GridRowNumCell'
import { SaveGridButton } from '../components/erp/SaveGridButton'
import { SearchDateInput, SearchFilterField } from '../components/erp/SearchFilterField'
import { ResizableGridTable, type GridColumnDef } from '../components/ResizableGridTable'
import { useGridColumnLayout } from '../hooks/useGridColumnLayout'
import { useExcelLikeGrid } from '../hooks/useExcelLikeGrid'
import { getDraftListFilterValue } from '../utils/draftGridSort'
import {
  APPROVE_ITEM_CD_REQUIRED_MSG,
  findDraftLineMissingItemCd,
  findLineMissingItemCd,
} from '../utils/draftEdit'
import { StatusBadge } from '../components/StatusBadge'
import { getDraftPageCopy, type DraftVariant } from '../config/draftPages'
import type { DraftListItem, DraftStatus } from '../types'
import { formatDate, formatDateTime } from '../utils/format'
import { suggestDraftLots, suggestItems } from '../utils/searchSuggest'

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

export function DraftListPage({ variant = 'receipt' }: Props) {
  const copy = getDraftPageCopy(variant)
  /** List screen: header read-only; edit header on Entry only. */
  const listSavesLinesOnly = true
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

  const draftEdit = useDraftEdit(selectedId, variant, detailRefresh, {
    listLinesOnly: listSavesLinesOnly,
  })

  const filters: { value: '' | DraftStatus; label: string }[] = [
    { value: '', label: copy.filterAll },
    { value: 'registered', label: copy.filterPending },
    { value: 'approved', label: copy.filterApproved },
    { value: 'cancelled', label: copy.filterCancelled },
  ]

  const fetchItemSuggestions = useCallback((q: string) => suggestItems(q), [])
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

  const applySearchField = useCallback(
    (...keys: (keyof SearchFilters)[]) => {
      if (keys.includes('dateFrom') || keys.includes('dateTo')) {
        if (
          searchInput.dateFrom &&
          searchInput.dateTo &&
          searchInput.dateFrom > searchInput.dateTo
        ) {
          setError(copy.filterDateRangeError)
          return
        }
      }
      setError(null)
      setAppliedSearch((prev) => {
        const next = { ...prev }
        for (const key of keys) next[key] = searchInput[key]
        return next
      })
    },
    [searchInput, copy.filterDateRangeError]
  )

  const clearSearchField = useCallback((patch: Partial<SearchFilters>) => {
    setSearchInput((prev) => ({ ...prev, ...patch }))
    setAppliedSearch((prev) => ({ ...prev, ...patch }))
    setError(null)
  }, [])

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
        const saved = await draftEdit.save({ linesOnly: true })
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
      GRID_ROWNUM_COLUMN,
      { key: 'date', label: copy.dateColumn, defaultWidth: 128 },
      { key: 'reference', label: copy.referenceCol, defaultWidth: 96 },
      { key: 'source', label: copy.sourceCol, defaultWidth: 72 },
      { key: 'status', label: copy.statusCol, defaultWidth: 88 },
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

  const headerGridId = `${variant}-header-v5`

  const handleSaveGrid = () => {
    headerLayout.saveLayout()
    lineGridLayoutApi?.saveLayout()
    setGridLayoutTick((n) => n + 1)
  }

  const handleSaveDraft = async () => {
    setError(null)
    setMessage(null)
    const ok = await draftEdit.save(listSavesLinesOnly ? { linesOnly: true } : undefined)
    if (ok) {
      setMessage(copy.saveSuccessMsg)
      refreshDetail()
    } else if (draftEdit.error) {
      setError(draftEdit.error)
    }
  }
  const getHeaderFilterValue = useCallback(
    (row: DraftListItem, col: string) =>
      getDraftListFilterValue(row, col, sourceLabel, copy.openPdfBtn ?? 'PDF'),
    [sourceLabel, copy.openPdfBtn]
  )

  const getHeaderSortValue = useCallback(
    (row: DraftListItem, col: string): unknown => {
      switch (col) {
        case 'source':
          return sourceLabel[row.source_type] ?? row.source_type
        case 'status':
          return row.status
        case 'date':
          return row.receipt_at
        case 'reference':
          return row.reference_no
        case 'supplier':
          return row.supplier_nm
        case 'notes':
          return row.notes
        case 'lines':
          return row.line_count
        case 'created':
          return row.created_at
        case 'approved':
          return row.approved_at
        case 'cancelled':
          return row.cancelled_at
        case 'pdf':
          return row.has_attachment ? 1 : 0
        default:
          return ''
      }
    },
    [sourceLabel]
  )

  const headerGrid = useExcelLikeGrid({
    columns: headerColumns,
    rows: drafts,
    getFilterValue: getHeaderFilterValue,
    getSortValue: getHeaderSortValue,
    excelLabel: copy.exportExcelLabel,
    excelExport: {
      sheetName: copy.exportHeaderSheet,
      filenamePrefix: variant === 'delivery' ? 'delivery_drafts' : 'receipt_drafts',
      getExportValue: (row, col) =>
        getDraftListFilterValue(row, col, sourceLabel, copy.openPdfBtn ?? 'PDF'),
    },
  })

  const headerLayout = useGridColumnLayout(headerGridId, headerColumns, {
    onLayoutChange: bumpGridLayout,
    pinFirst: ['rownum'],
    rowCount: headerGrid.displayRows.length,
  })

  const gridLayoutDirty = headerLayout.isDirty || (lineGridLayoutApi?.isDirty ?? false)

  useEffect(() => {
    headerGrid.onLayoutReady(headerLayout)
  }, [headerLayout, headerGrid.onLayoutReady])

  const isListHeaderEditable = (draftId: number, d: DraftListItem) =>
    !listSavesLinesOnly &&
    selectedId === draftId &&
    d.status === 'registered' &&
    draftEdit.canEdit &&
    draftEdit.headerEdit != null

  const renderHeaderCell = (colKey: string, d: DraftListItem, draftId: number) => {
    const editable = isListHeaderEditable(draftId, d)
    const header = draftEdit.headerEdit

    if (
      !listSavesLinesOnly &&
      editable &&
      header &&
      (colKey === 'date' || colKey === 'reference' || colKey === 'supplier' || colKey === 'notes')
    ) {
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
      {headerGrid.filterMenuElement}
      {headerGrid.contextMenuElement}
      {error && <Alert type="error" message={error} />}
      {message && <Alert type="success" message={message} />}

      <div className="erp-panel erp-panel-search">
        <div className="erp-panel-body erp-search-body">
          <div className="erp-search-row erp-search-form-suggest">
            <SearchFilterField
              className="erp-search-field-date"
              showApply={
                searchInput.dateFrom !== appliedSearch.dateFrom ||
                searchInput.dateTo !== appliedSearch.dateTo
              }
              applyLabel={copy.filterApply}
              onApply={() => applySearchField('dateFrom', 'dateTo')}
              showClear={Boolean(appliedSearch.dateFrom || appliedSearch.dateTo)}
              clearLabel={copy.filterClear}
              onClear={() => clearSearchField({ dateFrom: '', dateTo: '' })}
            >
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
            </SearchFilterField>
            <SearchFilterField
              className="erp-search-field-item"
              showApply={searchInput.item !== appliedSearch.item}
              applyLabel={copy.filterApply}
              onApply={() => applySearchField('item')}
              showClear={Boolean(appliedSearch.item.trim())}
              clearLabel={copy.filterClear}
              onClear={() => clearSearchField({ item: '' })}
            >
              <ErpSuggestInput
                value={searchInput.item}
                onChange={(item) => setSearchInput((prev) => ({ ...prev, item }))}
                placeholder={`${copy.itemCdLabel} - ${copy.itemNmLabel}`}
                ariaLabel={copy.itemLabel}
                variant="inline"
                fieldClassName="erp-suggest-in-filter"
                fetchSuggestions={fetchItemSuggestions}
              />
            </SearchFilterField>
            <SearchFilterField
              className="erp-search-field-lot"
              showApply={searchInput.lot !== appliedSearch.lot}
              applyLabel={copy.filterApply}
              onApply={() => applySearchField('lot')}
              showClear={Boolean(appliedSearch.lot.trim())}
              clearLabel={copy.filterClear}
              onClear={() => clearSearchField({ lot: '' })}
            >
              <ErpSuggestInput
                value={searchInput.lot}
                onChange={(lot) => setSearchInput((prev) => ({ ...prev, lot }))}
                placeholder={copy.filterLotPh}
                ariaLabel={copy.filterLotPh}
                variant="inline"
                fieldClassName="erp-suggest-in-filter"
                fetchSuggestions={fetchLotSuggestions}
              />
            </SearchFilterField>
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
            <SaveGridButton
              label={copy.saveGridBtn}
              successMessage={copy.saveGridSuccessMsg}
              disabled={!gridLayoutDirty}
              isDirty={gridLayoutDirty}
              onSave={handleSaveGrid}
            />
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
            onContextMenu={(event: MouseEvent) => {
              event.preventDefault()
              headerGrid.openContextMenu(event)
            }}
          >
            <ResizableGridTable
              layout={headerLayout}
              className="draft-list-table"
              {...headerGrid.tableProps}
            >
              <tbody>
                {headerGrid.displayRows.map((d, index) => {
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
                        event.preventDefault()
                        event.stopPropagation()
                        window.getSelection()?.removeAllRanges()
                        navigate(`${copy.newPath}?id=${id}`)
                      }}
                    >
                      {headerLayout.orderedColumns.map((col) =>
                        col.key === 'rownum' ? (
                          <GridRowNumCell key={col.key} index={index} />
                        ) : (
                          renderHeaderCell(col.key, d, id)
                        )
                      )}
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
            onSaveLines={draftEdit.canEdit ? () => void handleSaveDraft() : undefined}
            saving={draftEdit.saving}
            onLineGridLayout={setLineGridLayoutApi}
            onLineGridLayoutChange={bumpGridLayout}
          />
        </div>
      </div>
    </div>
  )
}
