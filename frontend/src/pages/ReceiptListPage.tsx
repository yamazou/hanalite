import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from 'react'
import {
  useAppNavigate,
  useAppViewRoute,
  useTabPanelRoute,
} from '../context/AppNavigateContext'
import { isReceiptListRoute } from '../utils/appRoute'
import { api } from '../api/client'
import { ItemSearchFilterInput } from '../components/ItemSearchFilterInput'
import { ErpSuggestInput } from '../components/ErpSuggestInput'
import { ErpScreen } from '../components/erp/ErpScreen'
import { ErpGridPanel, erpRowClass } from '../components/erp/ErpGridPanel'
import { receiptDraftListEditColumns } from '../components/erp/masterGridColumns'
import { ListDetailSplitLayout } from '../components/ListDetailSplitLayout'
import { DraftDetailPanel, type LineGridLayoutApi } from '../components/DraftDetailPanel'
import { DraftHeaderEditCell } from '../components/DraftHeaderEditCells'
import { GridRowNumCell } from '../components/GridRowNumCell'
import { GridRowSelectButtons } from '../components/GridRowSelectButtons'
import { MasterGridToolbarActions } from '../components/masters/MasterGridToolbar'
import { useRegisterToolbarHintClear } from '../context/ToolbarHintContext'
import { SearchDateInput, SearchFilterField } from '../components/erp/SearchFilterField'
import { StatusBadge } from '../components/StatusBadge'
import { getDraftPageCopy } from '../config/draftPages'
import { useDraftEdit } from '../hooks/useDraftEdit'
import { useExcelLikeGrid } from '../hooks/useExcelLikeGrid'
import { useProductionPanelSplitLayout } from '../hooks/useProductionPanelSplitLayout'
import type { GridColumnLayout } from '../hooks/useGridColumnLayout'
import { useMasterCatalog } from '../context/MasterCatalogContext'
import type { DraftDetail, DraftListItem, DraftStatus } from '../types'
import { formatDate, formatDateTime } from '../utils/format'
import { getDraftListFilterValue } from '../utils/draftGridSort'
import { ensureTrailingBlankRow } from '../utils/gridTrailingBlankRow'
import { deleteSelectedConfirm, removeSelectedGridRows, savedCountMessage } from '../utils/gridRowChange'
import {
  APPROVE_ITEM_CD_REQUIRED_MSG,
  findDraftLineMissingItemCd,
  findLineMissingItemCd,
  type HeaderEdit,
} from '../utils/draftEdit'
import { suggestDraftLots } from '../utils/searchSuggest'
import {
  buildCreateReceiptDraftPayload,
  buildUpdateReceiptDraftHeaderPayload,
  changedRegisteredHeaderDraftIds,
  emptyEditReceiptDraftHeaderRow,
  headerRowSnapshotsFromDrafts,
  isActiveReceiptDraftHeaderRow,
  isBlankReceiptDraftHeaderRow,
  listDraftToEditHeaderRow,
  receiptDraftHeaderRowSaveError,
  type EditReceiptDraftHeaderRow,
  type ReceiptDraftHeaderRowSnapshot,
} from '../utils/receiptDraftListEdit'
import {
  activeEditLines,
  type DraftLineValidationOpts,
  type EditLineRow,
} from '../utils/draftEdit'
import {
  buildHeaderListNavEntries,
  findHeaderListNavIndex,
  isFocusInHeaderListGrid,
  isHeaderListArrowKey,
  RECEIPT_HEADER_LIST_SCROLL,
  scheduleFocusHeaderListNavRow,
  shouldIgnoreHeaderListArrowKey,
  stepHeaderListNavIndex,
  type HeaderListNavEntry,
} from '../utils/headerListKeyboardNav'
import {
  buildReceiptDraftExportBodyRows,
  downloadReceiptDraftExcel,
} from '../utils/receiptDraftExcel'
import {
  mergeReceiptDraftImportPreview,
  parseReceiptDraftListExcel,
  type ReceiptExcelDraftGroup,
} from '../utils/receiptDraftExcelImport'

const RECEIPT_LIST_LINE_OPTS: DraftLineValidationOpts = { omitLocation: true }
const RECEIPT_HEADER_PREVIEW_PREFIX = 'draft-'

const variant = 'receipt' as const
const copy = getDraftPageCopy(variant)
const sourceLabel = { manual: 'Manual', excel: 'Excel', pdf: 'PDF' } as const

type SearchFilters = {
  dateFrom: string
  dateTo: string
  item: string
  lot: string
}

const emptySearchFilters: SearchFilters = {
  dateFrom: '',
  dateTo: '',
  item: '',
  lot: '',
}

function cellText(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '-'
}

function filterColKey(col: string): string {
  switch (col) {
    case 'receipt_at':
      return 'date'
    case 'reference_no':
      return 'reference'
    default:
      return col
  }
}

function toHeaderEdit(row: EditReceiptDraftHeaderRow): HeaderEdit {
  return {
    receiptAt: row.receipt_at,
    suppliersId: row.suppliers_id,
    referenceNo: row.reference_no,
    notes: row.notes,
  }
}

function patchFromHeaderEdit(patch: Partial<HeaderEdit>): Partial<EditReceiptDraftHeaderRow> {
  const next: Partial<EditReceiptDraftHeaderRow> = {}
  if (patch.receiptAt !== undefined) next.receipt_at = patch.receiptAt
  if (patch.suppliersId !== undefined) next.suppliers_id = patch.suppliersId
  if (patch.referenceNo !== undefined) next.reference_no = patch.referenceNo
  if (patch.notes !== undefined) next.notes = patch.notes
  return next
}

export function ReceiptListPage() {
  const navigate = useAppNavigate()
  const viewRoute = useAppViewRoute()
  const viewRouteRef = useRef(viewRoute)
  viewRouteRef.current = viewRoute
  const navigateReceipt = useCallback(
    (to: string, options?: { replace?: boolean }) => {
      if (!isReceiptListRoute(viewRouteRef.current)) return
      navigate(to, options)
    },
    [navigate]
  )
  const { search } = useTabPanelRoute()
  const [statusFilter, setStatusFilter] = useState<'' | DraftStatus>('registered')
  const [searchInput, setSearchInput] = useState<SearchFilters>(emptySearchFilters)
  const [appliedSearch, setAppliedSearch] = useState<SearchFilters>(emptySearchFilters)
  const [drafts, setDrafts] = useState<DraftListItem[]>([])
  const showHeaderNewRows =
    statusFilter === 'registered' || (statusFilter === '' && drafts.length === 0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [detailRefresh, setDetailRefresh] = useState(0)
  const [importLinesByDraftId, setImportLinesByDraftId] = useState<
    Map<number, EditLineRow[]>
  >(() => new Map())
  const [importLinesByNewKey, setImportLinesByNewKey] = useState<
    Map<string, EditLineRow[]>
  >(() => new Map())
  const excelImportGroupsRef = useRef<ReceiptExcelDraftGroup[] | null>(null)
  const headerGridRef = useRef<{ displayRows: DraftListItem[] } | null>(null)
  const [headerNewRows, setHeaderNewRows] = useState<EditReceiptDraftHeaderRow[]>(() => [
    emptyEditReceiptDraftHeaderRow(),
  ])
  const [selectedHeaderNewRowKeys, setSelectedHeaderNewRowKeys] = useState<Set<string>>(
    () => new Set()
  )
  const [registeredHeaderEdits, setRegisteredHeaderEdits] = useState<
    Map<number, EditReceiptDraftHeaderRow>
  >(() => new Map())
  const [savedRegisteredHeaderSnapshots, setSavedRegisteredHeaderSnapshots] = useState<
    Map<number, ReceiptDraftHeaderRowSnapshot>
  >(() => new Map())
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<number>>(() => new Set())
  const [gridHiddenDraftIds, setGridHiddenDraftIds] = useState<Set<number>>(() => new Set())
  const [headerRowError, setHeaderRowError] = useState<string | null>(null)
  const [headerSuccess, setHeaderSuccess] = useState<string | null>(null)
  const [headerPreviewKey, setHeaderPreviewKey] = useState<string | null>(null)

  const clearHeaderToolbarFeedback = useCallback(() => {
    setHeaderRowError(null)
    setHeaderSuccess(null)
  }, [])
  useRegisterToolbarHintClear(clearHeaderToolbarFeedback)
  const [lineGridLayoutApi, setLineGridLayoutApi] = useState<LineGridLayoutApi | null>(null)
  const [gridLayoutApi, setGridLayoutApi] = useState<{
    saveLayout: () => void
    isDirty: boolean
  } | null>(null)
  const [, setGridLayoutTick] = useState(0)
  const deleteHeaderRowsRef = useRef<() => void>(() => {})
  const panelSplitLayoutId = 'receipt-list-panels-v1'
  const panelSplit = useProductionPanelSplitLayout(panelSplitLayoutId)
  const { items: masterItems, locations: masterLocations, suppliers } = useMasterCatalog()

  const bumpGridLayout = useCallback(() => setGridLayoutTick((n) => n + 1), [])

  const selectedId = useMemo(() => {
    const raw = new URLSearchParams(search).get('id')
    if (!raw) return null
    const id = Number(raw)
    return Number.isNaN(id) ? null : id
  }, [search])

  const draftEdit = useDraftEdit(selectedId, variant, detailRefresh, {
    listLinesOnly: true,
    omitLineLocation: true,
  })

  useEffect(() => {
    if (selectedId == null || !draftEdit.canEdit) return
    const imported = importLinesByDraftId.get(selectedId)
    if (!imported?.length) return
    draftEdit.applyEditLines(imported)
  }, [selectedId, draftEdit.canEdit, importLinesByDraftId, draftEdit.applyEditLines])

  const selectedDraft = useMemo(
    () => drafts.find((d) => d.inv_receipt_draft_id === selectedId) ?? null,
    [drafts, selectedId]
  )

  const load = useCallback(async (alive: () => boolean) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listDrafts(
        {
          status: statusFilter || undefined,
          date_from: appliedSearch.dateFrom || undefined,
          date_to: appliedSearch.dateTo || undefined,
          item_q: appliedSearch.item.trim() || undefined,
          lot: appliedSearch.lot.trim() || undefined,
        },
        variant
      )
      if (!alive()) return
      setDrafts(data)
      setGridHiddenDraftIds(new Set())
    } catch (e) {
      if (!alive()) return
      setError(e instanceof Error ? e.message : copy.loadFail)
    } finally {
      if (alive()) setLoading(false)
    }
  }, [statusFilter, appliedSearch, copy.loadFail])

  useEffect(() => {
    let alive = true
    void load(() => alive)
    return () => {
      alive = false
    }
  }, [load])

  useEffect(() => {
    if (loading) return
    if (!isReceiptListRoute(viewRoute)) return
    const firstId = drafts[0]?.inv_receipt_draft_id ?? null
    if (firstId == null) {
      if (selectedId != null) {
        navigateReceipt(copy.listPath, { replace: true })
      }
      return
    }
    const selectionValid =
      selectedId != null &&
      drafts.some((d) => d.inv_receipt_draft_id === selectedId)
    if (!selectionValid) {
      navigateReceipt(copy.listPathWithId(firstId), { replace: true })
    }
  }, [loading, drafts, selectedId, navigateReceipt, viewRoute])

  useEffect(() => {
    const edits = new Map<number, EditReceiptDraftHeaderRow>()
    for (const draft of drafts) {
      if (draft.status !== 'registered') continue
      edits.set(draft.inv_receipt_draft_id, listDraftToEditHeaderRow(draft))
    }
    setRegisteredHeaderEdits(edits)
    setSavedRegisteredHeaderSnapshots(headerRowSnapshotsFromDrafts(drafts))
  }, [drafts])

  useEffect(() => {
    if (!showHeaderNewRows) setSelectedHeaderNewRowKeys(new Set())
  }, [showHeaderNewRows])

  useEffect(() => {
    setSelectedDraftIds(new Set())
    setHeaderRowError(null)
    setHeaderSuccess(null)
  }, [statusFilter])

  useEffect(() => {
    const prev = document.title
    document.title = copy.documentTitle
    return () => {
      document.title = prev
    }
  }, [])

  const selectDraft = useCallback(
    (id: number) => {
      setHeaderPreviewKey(`${RECEIPT_HEADER_PREVIEW_PREFIX}${id}`)
      setMessage(null)
      if (selectedId !== id) {
        navigateReceipt(copy.listPathWithId(id), { replace: true })
      }
    },
    [navigateReceipt, selectedId]
  )

  const handleSavedDraftRowFocusCapture = useCallback(
    (draftId: number) => (e: FocusEvent<HTMLTableRowElement>) => {
      const el = e.target
      if (
        !(
          el instanceof HTMLInputElement ||
          el instanceof HTMLSelectElement ||
          el instanceof HTMLTextAreaElement
        )
      ) {
        return
      }
      selectDraft(draftId)
    },
    [selectDraft]
  )

  const handleHeaderEditRowFocusCapture = useCallback(
    (row: EditReceiptDraftHeaderRow) => (e: FocusEvent<HTMLTableRowElement>) => {
      const el = e.target
      if (
        !(
          el instanceof HTMLInputElement ||
          el instanceof HTMLSelectElement ||
          el instanceof HTMLTextAreaElement
        )
      ) {
        return
      }
      const nextPreviewKey =
        row.inv_receipt_draft_id != null
          ? `${RECEIPT_HEADER_PREVIEW_PREFIX}${row.inv_receipt_draft_id}`
          : row.key
      if (nextPreviewKey !== headerPreviewKey) {
        clearHeaderToolbarFeedback()
      }
      setHeaderPreviewKey(nextPreviewKey)
      if (row.inv_receipt_draft_id != null) {
        selectDraft(row.inv_receipt_draft_id)
      }
    },
    [headerPreviewKey, selectDraft, clearHeaderToolbarFeedback]
  )

  const isSavedHeaderRowActive = useCallback(
    (draftId: number) =>
      selectedId === draftId ||
      headerPreviewKey === `${RECEIPT_HEADER_PREVIEW_PREFIX}${draftId}`,
    [selectedId, headerPreviewKey]
  )

  useEffect(() => {
    if (selectedId != null) {
      setHeaderPreviewKey(`${RECEIPT_HEADER_PREVIEW_PREFIX}${selectedId}`)
    }
  }, [selectedId])

  const refreshDetail = useCallback(() => {
    setError(null)
    setMessage(null)
    setDetailRefresh((v) => v + 1)
    void load(() => isReceiptListRoute(viewRouteRef.current))
  }, [load])

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

  const fetchLotSuggestions = useCallback((q: string) => suggestDraftLots(q, variant), [])

  const visibleDrafts = useMemo(
    () => drafts.filter((row) => !gridHiddenDraftIds.has(row.inv_receipt_draft_id)),
    [drafts, gridHiddenDraftIds]
  )

  const visibleHeaderNewRows = showHeaderNewRows ? headerNewRows : []

  const getHeaderFilterValue = useCallback(
    (row: DraftListItem, col: string) =>
      getDraftListFilterValue(row, filterColKey(col), sourceLabel, copy.openPdfBtn ?? 'PDF'),
    []
  )

  const getHeaderSortValue = useCallback((row: DraftListItem, col: string): unknown => {
    switch (col) {
      case 'source':
        return sourceLabel[row.source_type] ?? row.source_type
      case 'status':
        return row.status
      case 'receipt_at':
        return row.receipt_at
      case 'reference_no':
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
  }, [])

  const runReceiptListExport = useCallback(async () => {
    const draftsToExport = headerGridRef.current?.displayRows ?? visibleDrafts
    if (draftsToExport.length === 0) return

    setExportingExcel(true)
    setError(null)
    try {
      const detailByDraftId = new Map<number, DraftDetail>()
      const liveLinesByDraftId = new Map<number, EditLineRow[]>()

      if (selectedId != null) {
        const imported = importLinesByDraftId.get(selectedId)
        if (imported?.length) {
          liveLinesByDraftId.set(selectedId, imported)
        } else if (
          draftEdit.canEdit &&
          activeEditLines(draftEdit.editLines, RECEIPT_LIST_LINE_OPTS).length > 0
        ) {
          liveLinesByDraftId.set(selectedId, draftEdit.editLines)
        } else {
          try {
            detailByDraftId.set(selectedId, await api.getDraft(selectedId, variant))
          } catch {
            /* skip */
          }
        }
      }

      for (const draft of draftsToExport) {
        const draftId = draft.inv_receipt_draft_id
        if (detailByDraftId.has(draftId) || liveLinesByDraftId.has(draftId)) continue
        try {
          detailByDraftId.set(draftId, await api.getDraft(draftId, variant))
        } catch {
          /* header-only */
        }
      }

      const body = buildReceiptDraftExportBodyRows({
        drafts: draftsToExport,
        headerEdits: registeredHeaderEdits,
        detailByDraftId,
        liveLinesByDraftId,
        locations: masterLocations,
      })
      downloadReceiptDraftExcel(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export receipt list')
    } finally {
      setExportingExcel(false)
    }
  }, [
    visibleDrafts,
    selectedId,
    draftEdit.canEdit,
    draftEdit.editLines,
    importLinesByDraftId,
    registeredHeaderEdits,
    masterLocations,
  ])

  const headerGrid = useExcelLikeGrid({
    columns: receiptDraftListEditColumns,
    rows: visibleDrafts,
    getFilterValue: getHeaderFilterValue,
    getSortValue: getHeaderSortValue,
    excelLabel: copy.exportExcelLabel,
    excelExport: {
      sheetName: copy.exportHeaderSheet,
      filenamePrefix: 'receipt_drafts',
      runExport: () => void runReceiptListExport(),
    },
    excelImport: {
      parseFile: async (file) => {
        const groups = await parseReceiptDraftListExcel(file)
        excelImportGroupsRef.current = groups
        return []
      },
      applyParsedRows: async () => {
        const groups = excelImportGroupsRef.current
        excelImportGroupsRef.current = null
        if (!groups?.length) return
        setHeaderRowError(null)
        setHeaderSuccess(null)
        try {
          const merged = mergeReceiptDraftImportPreview(
            groups,
            drafts,
            registeredHeaderEdits,
            headerNewRows,
            masterItems,
            masterLocations,
            suppliers
          )
          setRegisteredHeaderEdits(merged.registeredEdits)
          setHeaderNewRows(merged.headerNewRows)
          setImportLinesByDraftId(merged.linesByDraftId)
          setImportLinesByNewKey(merged.linesByNewKey)
          const parts: string[] = []
          if (merged.insertedCount > 0) {
            parts.push(
              merged.insertedCount === 1
                ? '1 receipt added to grid'
                : `${merged.insertedCount} receipts added to grid`
            )
          }
          if (merged.updatedCount > 0) {
            parts.push(
              merged.updatedCount === 1
                ? '1 receipt updated in grid'
                : `${merged.updatedCount} receipts updated in grid`
            )
          }
          setHeaderSuccess(
            parts.length > 0
              ? `Import: ${parts.join(', ')}. Click Update to persist.`
              : 'Import completed. Click Update to persist.'
          )
          const firstNew = merged.headerNewRows.find(
            (row) => row.pendingExcelImport && isActiveReceiptDraftHeaderRow(row)
          )
          if (firstNew) {
            const lines = merged.linesByNewKey.get(firstNew.key)
            if (lines?.length) draftEdit.applyEditLines(lines)
          }
        } catch (e) {
          setHeaderRowError(e instanceof Error ? e.message : copy.importFail)
        }
      },
    },
    rowDelete: {
      label: 'Delete row',
      getSelectedCount: () => headerGridDeleteSelectionCount,
      onDelete: () => deleteHeaderRowsRef.current(),
    },
  })

  const handleHeaderGridLayoutReady = useCallback(
    (layout: GridColumnLayout) => {
      headerGrid.onLayoutReady(layout)
      setGridLayoutApi((prev) =>
        prev?.isDirty === layout.isDirty ? prev : { saveLayout: layout.saveLayout, isDirty: layout.isDirty }
      )
    },
    [headerGrid.onLayoutReady]
  )

  useEffect(() => {
    headerGridRef.current = { displayRows: headerGrid.displayRows }
  }, [headerGrid.displayRows])

  const headerGridDeleteSelectionCount = useMemo(() => {
    const draftCount = headerGrid.displayRows.filter((row) =>
      selectedDraftIds.has(row.inv_receipt_draft_id)
    ).length
    const newCount = showHeaderNewRows
      ? headerNewRows.filter(
          (row, hi) =>
            selectedHeaderNewRowKeys.has(row.key) &&
            !(hi === headerNewRows.length - 1 && isBlankReceiptDraftHeaderRow(row))
        ).length
      : 0
    return draftCount + newCount
  }, [
    headerGrid.displayRows,
    selectedDraftIds,
    headerNewRows,
    selectedHeaderNewRowKeys,
    showHeaderNewRows,
  ])

  const removeSelectedFromHeaderGrid = () => {
    const idsToHide = headerGrid.displayRows
      .filter((row) => selectedDraftIds.has(row.inv_receipt_draft_id))
      .map((row) => row.inv_receipt_draft_id)
    if (idsToHide.length > 0) {
      setGridHiddenDraftIds((prev) => {
        const next = new Set(prev)
        for (const id of idsToHide) next.add(id)
        return next
      })
      setRegisteredHeaderEdits((prev) => {
        const next = new Map(prev)
        for (const id of idsToHide) next.delete(id)
        return next
      })
      if (selectedId != null && idsToHide.includes(selectedId)) {
        navigateReceipt(copy.listPath, { replace: true })
      }
    }
    if (selectedHeaderNewRowKeys.size > 0) {
      setHeaderNewRows((rows) =>
        removeSelectedGridRows(
          rows,
          selectedHeaderNewRowKeys,
          isBlankReceiptDraftHeaderRow,
          () => emptyEditReceiptDraftHeaderRow()
        )
      )
    }
    setSelectedDraftIds(new Set())
    setSelectedHeaderNewRowKeys(new Set())
  }
  deleteHeaderRowsRef.current = removeSelectedFromHeaderGrid

  const updateRegisteredHeaderRow = (
    draftId: number,
    patch: Partial<EditReceiptDraftHeaderRow>
  ) => {
    clearHeaderToolbarFeedback()
    setRegisteredHeaderEdits((prev) => {
      const row = prev.get(draftId)
      if (!row) return prev
      const next = new Map(prev)
      next.set(draftId, { ...row, ...patch })
      return next
    })
  }

  const updateHeaderNewRow = (key: string, patch: Partial<EditReceiptDraftHeaderRow>) => {
    clearHeaderToolbarFeedback()
    setHeaderNewRows((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row))
    )
  }

  const headerNavEntries = useMemo(
    () =>
      buildHeaderListNavEntries(
        headerGrid.displayRows.map((row) => row.inv_receipt_draft_id),
        visibleHeaderNewRows,
        isBlankReceiptDraftHeaderRow
      ),
    [headerGrid.displayRows, visibleHeaderNewRows]
  )

  const applyHeaderNavEntry = useCallback(
    (entry: HeaderListNavEntry) => {
      if (entry.type === 'saved') {
        selectDraft(entry.id)
        return
      }
      setHeaderPreviewKey(entry.key)
      navigateReceipt(copy.listPath, { replace: true })
      setMessage(null)
    },
    [selectDraft, navigateReceipt]
  )

  const moveHeaderNav = useCallback(
    (delta: number, previousFocus?: EventTarget | null) => {
      const index = findHeaderListNavIndex(headerNavEntries, {
        savedId: selectedId,
        previewKey: headerPreviewKey,
        savedKeyPrefix: RECEIPT_HEADER_PREVIEW_PREFIX,
      })
      const nextIndex = stepHeaderListNavIndex(index, delta, headerNavEntries.length)
      if (nextIndex < 0) return
      const entry = headerNavEntries[nextIndex]
      if (entry) {
        applyHeaderNavEntry(entry)
        scheduleFocusHeaderListNavRow(entry, RECEIPT_HEADER_LIST_SCROLL, previousFocus)
      }
    },
    [headerNavEntries, selectedId, headerPreviewKey, applyHeaderNavEntry]
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isHeaderListArrowKey(e.key)) return
      if (e.defaultPrevented) return
      if (shouldIgnoreHeaderListArrowKey(e.target)) return
      if (!isFocusInHeaderListGrid(e.target)) return
      e.preventDefault()
      moveHeaderNav(e.key === 'ArrowDown' ? 1 : -1, e.target)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [moveHeaderNav])

  const commitHeaderSentinelOnEnter = useCallback((row: EditReceiptDraftHeaderRow) => {
    setHeaderNewRows((rows) => {
      if (rows[rows.length - 1]?.key !== row.key) return rows
      if (isBlankReceiptDraftHeaderRow(row)) return rows
      return ensureTrailingBlankRow(
        rows,
        isBlankReceiptDraftHeaderRow,
        () => emptyEditReceiptDraftHeaderRow()
      )
    })
  }, [])

  const handleHeaderCellKeyDown = useCallback(
    (e: KeyboardEvent, row: EditReceiptDraftHeaderRow) => {
      if (isHeaderListArrowKey(e.key)) {
        e.preventDefault()
        moveHeaderNav(e.key === 'ArrowDown' ? 1 : -1, e.target)
        return
      }
      if (e.key !== 'Enter') return
      e.preventDefault()
      commitHeaderSentinelOnEnter(row)
    },
    [commitHeaderSentinelOnEnter, moveHeaderNav]
  )

  const bulkDeleteTargetCount = useMemo(() => {
    const saved = drafts.filter(
      (r) => selectedDraftIds.has(r.inv_receipt_draft_id) && r.status === 'registered'
    ).length
    const cancelled = drafts.filter(
      (r) => selectedDraftIds.has(r.inv_receipt_draft_id) && r.status === 'cancelled'
    ).length
    const newCount = showHeaderNewRows ? selectedHeaderNewRowKeys.size : 0
    return saved + cancelled + newCount
  }, [drafts, selectedDraftIds, selectedHeaderNewRowKeys, showHeaderNewRows])

  const hasListSelection =
    selectedDraftIds.size > 0 || (showHeaderNewRows && selectedHeaderNewRowKeys.size > 0)
  const showSingleActions = selectedId != null && !hasListSelection

  const handleBulkDelete = async () => {
    const registeredTargets = drafts.filter(
      (r) => selectedDraftIds.has(r.inv_receipt_draft_id) && r.status === 'registered'
    )
    const cancelledTargets = drafts.filter(
      (r) => selectedDraftIds.has(r.inv_receipt_draft_id) && r.status === 'cancelled'
    )
    const newRowKeys = showHeaderNewRows ? [...selectedHeaderNewRowKeys] : []
    if (
      registeredTargets.length === 0 &&
      cancelledTargets.length === 0 &&
      newRowKeys.length === 0
    ) {
      return
    }
    const total =
      registeredTargets.length + cancelledTargets.length + newRowKeys.length
    if (!confirm(deleteSelectedConfirm(total, 'receipt row(s)'))) return
    setActing(true)
    setError(null)
    setMessage(null)
    setHeaderRowError(null)
    try {
      if (newRowKeys.length > 0) {
        setHeaderNewRows((rows) =>
          ensureTrailingBlankRow(
            rows.filter((row) => !newRowKeys.includes(row.key)),
            isBlankReceiptDraftHeaderRow,
            () => emptyEditReceiptDraftHeaderRow()
          )
        )
        setSelectedHeaderNewRowKeys(new Set())
      }
      for (const row of [...registeredTargets, ...cancelledTargets]) {
        await api.deleteDraft(row.inv_receipt_draft_id, variant)
      }
      setSelectedDraftIds(new Set())
      if (registeredTargets.length + cancelledTargets.length > 0) {
        setHeaderSuccess(`Deleted ${total} receipt row(s).`)
        if (
          selectedId &&
          [...registeredTargets, ...cancelledTargets].some(
            (r) => r.inv_receipt_draft_id === selectedId
          )
        ) {
          navigateReceipt(copy.listPath, { replace: true })
        }
        await load(() => isReceiptListRoute(viewRouteRef.current))
      } else {
        setHeaderSuccess(`Removed ${newRowKeys.length} unsaved row(s).`)
      }
    } catch (e) {
      setHeaderRowError(e instanceof Error ? e.message : copy.deleteFail)
    } finally {
      setActing(false)
    }
  }

  const handleDeleteSingle = async () => {
    if (!selectedId || !selectedDraft) return
    if (selectedDraft.status !== 'registered' && selectedDraft.status !== 'cancelled') return
    const msg =
      selectedDraft.status === 'registered'
        ? 'Delete this receipt?'
        : copy.deleteConfirm
    if (!confirm(msg)) return
    setActing(true)
    setError(null)
    setMessage(null)
    try {
      await api.deleteDraft(selectedId, variant)
      setMessage(copy.deletedMsg)
      navigateReceipt(copy.listPath, { replace: true })
      await load(() => isReceiptListRoute(viewRouteRef.current))
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.deleteFail)
    } finally {
      setActing(false)
    }
  }

  const linesPayloadFromDetail = useCallback(
    (lines: Awaited<ReturnType<typeof api.getDraft>>['lines']) =>
      lines.map((ln) => ({
        ...(ln.item_id != null ? { item_id: ln.item_id } : { item_id: null }),
        item_cd: ln.item_cd,
        item_nm: ln.item_nm,
        location_id: ln.location_id!,
        lot: ln.lot,
        qty: Number(ln.qty),
        line_no: ln.line_no,
        inv_receipt_draft_line_id: ln.inv_receipt_draft_line_id,
      })),
    []
  )

  const linesPayloadFromEditRows = useCallback((rows: EditLineRow[]) => {
    return activeEditLines(rows, RECEIPT_LIST_LINE_OPTS)
      .filter((row) => row.location_id !== '')
      .map((row, index) => ({
      ...(row.item_id !== '' ? { item_id: Number(row.item_id) } : { item_id: null }),
      item_cd: row.item_cd.trim() || null,
      item_nm: row.item_nm.trim() || null,
      location_id: Number(row.location_id),
      lot: row.lot.trim(),
      qty: Number(row.qty),
      line_no: index + 1,
      ...(row.inv_receipt_draft_line_id
        ? { inv_receipt_draft_line_id: row.inv_receipt_draft_line_id }
        : {}),
    }))
  }, [])

  const linesPayloadFromEdit = useCallback(
    () => linesPayloadFromEditRows(draftEdit.editLines),
    [draftEdit.editLines, linesPayloadFromEditRows]
  )

  const resolveLinesForDraft = useCallback(
    async (draftId: number): Promise<ReturnType<typeof linesPayloadFromDetail>> => {
      const imported = importLinesByDraftId.get(draftId)
      if (imported?.length) return linesPayloadFromEditRows(imported)
      if (
        draftId === selectedId &&
        draftEdit.canEdit &&
        activeEditLines(draftEdit.editLines, RECEIPT_LIST_LINE_OPTS).length > 0
      ) {
        return linesPayloadFromEdit()
      }
      const existing = await api.getDraft(draftId, variant)
      return linesPayloadFromDetail(existing.lines)
    },
    [
      importLinesByDraftId,
      selectedId,
      draftEdit.canEdit,
      draftEdit.editLines,
      linesPayloadFromEditRows,
      linesPayloadFromEdit,
      linesPayloadFromDetail,
    ]
  )

  const handleUpdateHeaders = useCallback(async () => {
    const saveError = showHeaderNewRows
      ? receiptDraftHeaderRowSaveError(headerNewRows)
      : null
    if (saveError) {
      setHeaderRowError(saveError)
      return
    }
    const newActive = showHeaderNewRows
      ? headerNewRows.filter(isActiveReceiptDraftHeaderRow)
      : []
    const toUpdate = changedRegisteredHeaderDraftIds(
      registeredHeaderEdits,
      savedRegisteredHeaderSnapshots
    )
    const toUpdateIds = new Set(toUpdate)
    for (const draftId of importLinesByDraftId.keys()) {
      if (drafts.some((d) => d.inv_receipt_draft_id === draftId && d.status === 'registered')) {
        toUpdateIds.add(draftId)
      }
    }
    const selectedHeaderChanged =
      selectedId != null && toUpdateIds.has(selectedId)
    const selectedHasLineEdits =
      selectedId != null &&
      draftEdit.canEdit &&
      activeEditLines(draftEdit.editLines, RECEIPT_LIST_LINE_OPTS).length > 0
    const selectedHasImportedLines =
      selectedId != null && (importLinesByDraftId.get(selectedId)?.length ?? 0) > 0

    if (
      newActive.length === 0 &&
      [...toUpdateIds].filter((id) => id !== selectedId).length === 0 &&
      !selectedHeaderChanged &&
      !selectedHasLineEdits &&
      !selectedHasImportedLines
    ) {
      setHeaderRowError(null)
      setHeaderSuccess(savedCountMessage(0, 'receipt'))
      return
    }

    setActing(true)
    setHeaderRowError(null)
    setHeaderSuccess(null)
    setError(null)
    setMessage(null)
    try {
      let savedCount = 0
      let lastId: number | null = null
      for (const draftId of toUpdateIds) {
        if (draftId === selectedId) continue
        const row = registeredHeaderEdits.get(draftId)!
        const lines = await resolveLinesForDraft(draftId)
        await api.updateDraft(
          draftId,
          buildUpdateReceiptDraftHeaderPayload(row, lines),
          variant
        )
        savedCount += 1
        lastId = draftId
      }
      for (const row of newActive) {
        const importedLines = importLinesByNewKey.get(row.key) ?? []
        const created = await api.createDraft(
          buildCreateReceiptDraftPayload(
            row,
            importedLines.length > 0 ? linesPayloadFromEditRows(importedLines) : []
          ),
          variant
        )
        savedCount += 1
        lastId = created.inv_receipt_draft_id
      }
      if (
        selectedId != null &&
        (selectedHeaderChanged || selectedHasLineEdits || selectedHasImportedLines)
      ) {
        const row = registeredHeaderEdits.get(selectedId)
        if (!row) return
        const lines = await resolveLinesForDraft(selectedId)
        await api.updateDraft(
          selectedId,
          buildUpdateReceiptDraftHeaderPayload(row, lines),
          variant
        )
        savedCount += 1
        lastId = selectedId
        setDetailRefresh((v) => v + 1)
      }
      setHeaderNewRows([emptyEditReceiptDraftHeaderRow()])
      setSelectedHeaderNewRowKeys(new Set())
      setImportLinesByDraftId(new Map())
      setImportLinesByNewKey(new Map())
      setHeaderSuccess(savedCountMessage(savedCount, 'receipt'))
      await load(() => isReceiptListRoute(viewRouteRef.current))
      if (lastId != null) selectDraft(lastId)
    } catch (e) {
      setHeaderRowError(e instanceof Error ? e.message : copy.createFail)
    } finally {
      setActing(false)
    }
  }, [
    headerNewRows,
    registeredHeaderEdits,
    savedRegisteredHeaderSnapshots,
    selectedId,
    draftEdit.canEdit,
    draftEdit.editLines,
    importLinesByDraftId,
    importLinesByNewKey,
    importLinesByDraftId,
    drafts,
    linesPayloadFromEditRows,
    resolveLinesForDraft,
    showHeaderNewRows,
    load,
  ])

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

  const canApprove =
    selectedDraft?.status === 'registered' && (selectedDraft?.line_count ?? 0) > 0
  const canCancel =
    selectedDraft?.status === 'registered' || selectedDraft?.status === 'approved'
  const canRestore = selectedDraft?.status === 'cancelled'
  const canDeleteSingle =
    selectedDraft?.status === 'registered' || selectedDraft?.status === 'cancelled'

  const filters: { value: '' | DraftStatus; label: string }[] = [
    { value: '', label: copy.filterAll },
    { value: 'registered', label: copy.filterPending },
    { value: 'approved', label: copy.filterApproved },
    { value: 'cancelled', label: copy.filterCancelled },
  ]

  const headerListRowCount =
    headerGrid.displayRows.length + visibleHeaderNewRows.length
  const selectableDraftRows = headerGrid.displayRows
  const selectableHeaderNewRows = visibleHeaderNewRows.filter(
    (row, hi) =>
      !(hi === visibleHeaderNewRows.length - 1 && isBlankReceiptDraftHeaderRow(row))
  )
  const selectableListRowsCount = selectableDraftRows.length + selectableHeaderNewRows.length
  const selectableListSelectedCount =
    selectableDraftRows.filter((r) => selectedDraftIds.has(r.inv_receipt_draft_id)).length +
    (showHeaderNewRows ? selectedHeaderNewRowKeys.size : 0)

  const handleSaveGrid = () => {
    gridLayoutApi?.saveLayout()
    lineGridLayoutApi?.saveLayout()
    panelSplit.saveLayout()
    setGridLayoutTick((n) => n + 1)
  }

  const gridLayoutDirty =
    (gridLayoutApi?.isDirty ?? false) ||
    (lineGridLayoutApi?.isDirty ?? false) ||
    panelSplit.isDirty

  const renderEditableHeaderCell = (
    colKey: string,
    editRow: EditReceiptDraftHeaderRow,
    onPatch: (patch: Partial<EditReceiptDraftHeaderRow>) => void
  ) => {
    const editCol =
      colKey === 'receipt_at'
        ? 'date'
        : colKey === 'reference_no'
          ? 'reference'
          : colKey
    if (editCol === 'date' || editCol === 'reference' || editCol === 'supplier' || editCol === 'notes') {
      return (
        <td
          key={colKey}
          className="erp-grid-cell-edit"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <DraftHeaderEditCell
            colKey={editCol}
            header={toHeaderEdit(editRow)}
            onPatch={(patch) => onPatch(patchFromHeaderEdit(patch))}
            suppliers={suppliers}
            copy={copy}
          />
        </td>
      )
    }
    return null
  }

  const renderReadonlyHeaderCell = (colKey: string, d: DraftListItem, draftId: number) => {
    switch (colKey) {
      case 'source':
        return <td key={colKey}>{sourceLabel[d.source_type] ?? d.source_type}</td>
      case 'status':
        return (
          <td key={colKey}>
            <StatusBadge status={d.status} />
          </td>
        )
      case 'receipt_at':
        return <td key={colKey}>{formatDate(d.receipt_at)}</td>
      case 'reference_no':
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
    <ErpScreen
      error={error}
      success={message}
      title={copy.listTitle}
      className="erp-screen-stacked"
      onRefresh={() => refreshDetail()}
      showSaveGridButton
      onSaveGrid={handleSaveGrid}
      saveGridIsDirty={gridLayoutDirty}
      saveGridDisabled={!gridLayoutDirty}
      saveGridLabel={copy.saveGridBtn}
      saveGridSuccessMessage={copy.saveGridSuccessMsg}
    >
      {headerGrid.filterMenuElement}
      {headerGrid.contextMenuElement}

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
              <ItemSearchFilterInput
                value={searchInput.item}
                onChange={(item) => setSearchInput((prev) => ({ ...prev, item }))}
                placeholder={`${copy.itemCdLabel} - ${copy.itemNmLabel}`}
                ariaLabel={copy.itemLabel}
                variant="inline"
                fieldClassName="erp-suggest-in-filter"
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

      <ListDetailSplitLayout
        listHeightRatio={panelSplit.layout.listHeightRatio}
        onListHeightRatioChange={panelSplit.setListHeightRatio}
        list={
          <ErpGridPanel
            gridId="receipt-list-header-v1"
            titleBarStyle="section"
            panelClassName="erp-panel-list-header"
            columns={receiptDraftListEditColumns}
            loading={loading}
            isEmpty={!loading && headerListRowCount === 0}
            selectColumnHeader={
              <GridRowSelectButtons
                rowCount={selectableListRowsCount}
                selectedCount={selectableListSelectedCount}
                onSelectAll={() => {
                  setSelectedDraftIds(
                    new Set(selectableDraftRows.map((r) => r.inv_receipt_draft_id))
                  )
                  if (showHeaderNewRows) {
                    setSelectedHeaderNewRowKeys(
                      new Set(selectableHeaderNewRows.map((r) => r.key))
                    )
                  }
                }}
                onClearSelection={() => {
                  setSelectedDraftIds(new Set())
                  setSelectedHeaderNewRowKeys(new Set())
                }}
              />
            }
            titleActions={
              <div className="erp-production-order-header-actions">
                <div className="erp-production-order-header-actions-left">
                  {filters.map((f) => (
                    <button
                      key={f.value || 'all'}
                      type="button"
                      className={`erp-tab ${statusFilter === f.value ? 'active' : ''}`}
                      onClick={() => setStatusFilter(f.value)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="erp-production-order-header-actions-right">
                  <MasterGridToolbarActions
                    submitting={acting || exportingExcel}
                    rowError={headerRowError}
                    statusMessage={headerSuccess}
                    onSave={() => void handleUpdateHeaders()}
                  />
                  {hasListSelection && bulkDeleteTargetCount > 0 && (
                    <button
                      type="button"
                      className="btn erp-btn erp-btn-cancel"
                      disabled={acting || exportingExcel}
                      onClick={() => void handleBulkDelete()}
                    >
                      {copy.deleteBtn}
                    </button>
                  )}
                  {showSingleActions && canApprove && (
                    <button
                      type="button"
                      className="btn erp-btn erp-btn-approve"
                      disabled={acting}
                      onClick={() => void handleApprove()}
                    >
                      {copy.approveBtn}
                    </button>
                  )}
                  {showSingleActions && canCancel && (
                    <button
                      type="button"
                      className="btn erp-btn erp-btn-cancel"
                      disabled={acting || draftEdit.saving}
                      onClick={() => void handleCancel()}
                    >
                      {copy.cancelActionBtn}
                    </button>
                  )}
                  {showSingleActions && canRestore && (
                    <button
                      type="button"
                      className="btn erp-btn erp-btn-new"
                      disabled={acting}
                      onClick={() => void handleRestore()}
                    >
                      {copy.restoreBtn}
                    </button>
                  )}
                  {showSingleActions && canDeleteSingle && (
                    <button
                      type="button"
                      className="btn erp-btn erp-btn-cancel"
                      disabled={acting}
                      onClick={() => void handleDeleteSingle()}
                    >
                      {copy.deleteBtn}
                    </button>
                  )}
                </div>
              </div>
            }
            onLayoutReady={handleHeaderGridLayoutReady}
            onGridContextMenu={headerGrid.openContextMenu}
            layoutOptions={{ pinFirst: ['rownum', 'select'] }}
            rowCount={headerListRowCount}
            {...headerGrid.tableProps}
          >
            {(layout) => (
              <tbody>
                {headerGrid.displayRows.map((row, index) => {
                  const editRow =
                    row.status === 'registered'
                      ? registeredHeaderEdits.get(row.inv_receipt_draft_id)
                      : undefined
                  const headerEditable = editRow != null
                  const draftId = row.inv_receipt_draft_id
                  return (
                    <tr
                      key={draftId}
                      data-receipt-draft-id={draftId}
                      className={`${erpRowClass(index, isSavedHeaderRowActive(draftId))}${
                        headerEditable ? ' erp-grid-row-editing' : ''
                      }`}
                      tabIndex={-1}
                      onFocusCapture={
                        headerEditable && editRow
                          ? handleHeaderEditRowFocusCapture(editRow)
                          : handleSavedDraftRowFocusCapture(draftId)
                      }
                      onKeyDown={(e) => {
                        if (editRow) {
                          handleHeaderCellKeyDown(e, editRow)
                          return
                        }
                        if (isHeaderListArrowKey(e.key)) {
                          e.preventDefault()
                          moveHeaderNav(e.key === 'ArrowDown' ? 1 : -1, e.target)
                        }
                      }}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button, input, select, .erp-col-check'))
                          return
                        selectDraft(draftId)
                        e.currentTarget.focus()
                      }}
                    >
                      {layout.orderedColumns.map((col) => {
                        if (col.key === 'rownum') {
                          return <GridRowNumCell key={col.key} index={index} />
                        }
                        if (col.key === 'select') {
                          return (
                            <td
                              key={col.key}
                              className="erp-col-check"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={selectedDraftIds.has(draftId)}
                                aria-label={`Select receipt ${draftId}`}
                                onChange={(e) => {
                                  setSelectedDraftIds((prev) => {
                                    const next = new Set(prev)
                                    if (e.target.checked) next.add(draftId)
                                    else next.delete(draftId)
                                    return next
                                  })
                                  if (e.target.checked) selectDraft(draftId)
                                }}
                              />
                            </td>
                          )
                        }
                        if (headerEditable && editRow) {
                          const editable = renderEditableHeaderCell(
                            col.key,
                            editRow,
                            (patch) => updateRegisteredHeaderRow(draftId, patch)
                          )
                          if (editable) return editable
                          if (col.key === 'source') {
                            return (
                              <td key={col.key}>
                                {sourceLabel[row.source_type] ?? row.source_type}
                              </td>
                            )
                          }
                          if (col.key === 'status') {
                            return (
                              <td key={col.key}>
                                <StatusBadge status={row.status} />
                              </td>
                            )
                          }
                          if (col.key === 'lines') {
                            return (
                              <td key={col.key} className="erp-col-num">
                                {row.line_count}
                              </td>
                            )
                          }
                          if (col.key === 'created') {
                            return <td key={col.key}>{formatDateTime(row.created_at)}</td>
                          }
                          if (col.key === 'approved') {
                            return <td key={col.key}>{formatDateTime(row.approved_at)}</td>
                          }
                          if (col.key === 'cancelled') {
                            return <td key={col.key}>{formatDateTime(row.cancelled_at)}</td>
                          }
                          if (col.key === 'pdf') {
                            return renderReadonlyHeaderCell(col.key, row, draftId)
                          }
                        }
                        return renderReadonlyHeaderCell(col.key, row, draftId)
                      })}
                    </tr>
                  )
                })}
                {visibleHeaderNewRows.map((editRow, index) => {
                  const displayIndex = headerGrid.displayRows.length + index
                  const isBlankSentinel =
                    index === visibleHeaderNewRows.length - 1 &&
                    isBlankReceiptDraftHeaderRow(editRow)
                  return (
                    <tr
                      key={editRow.key}
                      data-header-new-key={editRow.key}
                      className={`${erpRowClass(displayIndex, headerPreviewKey === editRow.key)} erp-grid-row-editing`}
                      tabIndex={-1}
                      onFocusCapture={handleHeaderEditRowFocusCapture(editRow)}
                      onKeyDown={(e) => handleHeaderCellKeyDown(e, editRow)}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button, input, select, .erp-col-check')) return
                        setHeaderPreviewKey(editRow.key)
                        e.currentTarget.focus()
                      }}
                    >
                      {layout.orderedColumns.map((col) => {
                        if (col.key === 'rownum') {
                          return <GridRowNumCell key={col.key} index={displayIndex} />
                        }
                        if (col.key === 'select') {
                          if (isBlankSentinel) {
                            return <td key={col.key} className="erp-col-check" />
                          }
                          return (
                            <td
                              key={col.key}
                              className="erp-col-check"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={selectedHeaderNewRowKeys.has(editRow.key)}
                                aria-label="Select new receipt row"
                                onChange={(e) => {
                                  setSelectedHeaderNewRowKeys((prev) => {
                                    const next = new Set(prev)
                                    if (e.target.checked) next.add(editRow.key)
                                    else next.delete(editRow.key)
                                    return next
                                  })
                                }}
                              />
                            </td>
                          )
                        }
                        if (col.key === 'source') {
                          return <td key={col.key}>Manual</td>
                        }
                        if (col.key === 'status') {
                          return (
                            <td key={col.key}>
                              <StatusBadge status="registered" />
                            </td>
                          )
                        }
                        if (col.key === 'lines') {
                          return (
                            <td key={col.key} className="erp-col-num">
                              0
                            </td>
                          )
                        }
                        if (
                          col.key === 'created' ||
                          col.key === 'approved' ||
                          col.key === 'cancelled' ||
                          col.key === 'pdf'
                        ) {
                          return <td key={col.key}>-</td>
                        }
                        const editable = renderEditableHeaderCell(
                          col.key,
                          editRow,
                          (patch) => updateHeaderNewRow(editRow.key, patch)
                        )
                        return editable ?? <td key={col.key} />
                      })}
                    </tr>
                  )
                })}
              </tbody>
            )}
          </ErpGridPanel>
        }
        detail={
          <div className="erp-panel erp-panel-grow erp-detail-panel">
            <div className="erp-panel-body erp-panel-content">
              <DraftDetailPanel
                draftId={selectedId}
                variant={variant}
                edit={draftEdit}
                onSaved={refreshDetail}
                saving={draftEdit.saving}
                onLineGridLayout={setLineGridLayoutApi}
                onLineGridLayoutChange={bumpGridLayout}
              />
            </div>
          </div>
        }
      />
    </ErpScreen>
  )
}
