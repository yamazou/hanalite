import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { BomTreePanel } from '../../components/BomTreePanel'
import { ProductionDetailSplit } from '../../components/ProductionDetailSplit'
import { OutputItemProcessSplitLayout } from '../../components/OutputItemProcessSplitLayout'
import { ProductionProcessInputPanels } from '../../components/ProductionProcessInputPanels'
import { useProductionPanelSplitLayout } from '../../hooks/useProductionPanelSplitLayout'
import { ProductionTreeSidebar } from '../../components/ProductionTreeSidebar'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { GridRowSelectButtons } from '../../components/GridRowSelectButtons'
import { MasterGridToolbarActions } from '../../components/masters/MasterGridToolbar'
import { erpRowClass } from '../../components/erp/ErpGridPanel'
import { itemProcessFinalItemColumns } from '../../components/erp/masterGridColumns'
import { GridRowNumCell } from '../../components/GridRowNumCell'
import { ResizableGridTable } from '../../components/ResizableGridTable'
import type { ItemSearchRow, ItemListRow } from '../../types/masters'
import type { ProductionOrderDetail } from '../../types/production'
import type { BomTreeLine, ProcessTreeHighlight } from '../../utils/bomTree'
import {
  useMasterCatalog,
  useRefreshMasterCatalogAfterSave,
} from '../../context/MasterCatalogContext'
import { useItemTypColors } from '../../context/ItemTypColorContext'
import { useExcelLikeGrid } from '../../hooks/useExcelLikeGrid'
import { useGridColumnLayout } from '../../hooks/useGridColumnLayout'
import { gridColumnLayoutOptions } from '../../hooks/useGridColumnLayoutOptions'
import { toFilterCellValue } from '../../utils/gridColumnFilter'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../../utils/gridTrailingBlankRow'
import {
  buildFinalItemCatalogLookups,
  editRowsToItemProcessesSave,
  emptyEditFinalItemRow,
  ensureItemProcessEditRows,
  finalItemCdFieldPatch,
  finalItemFieldsFromCatalogItem,
  finalItemNmFieldPatch,
  finalItemRowSnapshot,
  finalItemRowSnapshotsFromEditRows,
  isItemProcessEditDirty,
  isOutputItemListDirty,
  itemProcessInputSaveValidationMessage,
  prepareItemProcessDraftForSave,
  resolveItemProcessInputRowsFromCatalog,
  mergeFinalItemRowsForDisplay,
  isActiveFinalItemRow,
  isBlankFinalItemRow,
  isBlankItemProcessRow,
  isDraftFinalItemKey,
  itemProcessesToEditInputRows,
  itemProcessesToEditProcessRows,
  serializeItemProcessEditDraft,
  stableFinalItemKey,
  type EditFinalItemRow,
  type FinalItemRowSnapshot,
} from '../../utils/itemProcessEdit'
import { deleteSelectedConfirm, removeSelectedGridRows } from '../../utils/gridRowChange'
import { selectableDisplayRows, selectedSelectableCount } from '../../utils/gridRowSelection'
import { GridItemDatalistField, GridItemResolvedInput } from '../../components/GridItemDatalistField'
import { showItemMasterDatalist } from '../../utils/gridPlaceholder'
import {
  allowedItemtypIds,
  filterItemListRowsByItemtypIds,
  findItemtypByKind,
  ITEM_PROCESS_INPUT_ITEMTYP_CDS,
  ITEM_PROCESS_OUTPUT_ITEMTYP_CDS,
  itemTypTabLabel,
  type OutputItemTypFilter,
} from '../../utils/itemTypDisplay'
import { itemTextColorStyle } from '../../utils/itemTypColor'
import {
  createBlankProcessRowForDetail,
  type EditInputRow,
  type EditProcessRow,
} from '../../utils/productionEdit'
import type { ItemProcessesOut } from '../../types/itemprocs'
import {
  buildOutputItemFinalItemCodeMap,
  collectWipItemProcessIds,
  isWipItem,
} from '../../utils/itemProcessTree'
import { isSameProductionTreeData, type ProductionTreeData } from '../../utils/productionOrderTree'
import { parentTreeHighlight } from '../../utils/productionTreeHighlight'
import {
  buildItemProcessExportBodyRows,
  downloadItemProcessExcel,
  mergeItemProcessImportRows,
  parseItemProcessExcelFile,
  type ItemProcessExcelRow,
} from '../../utils/itemProcessExcel'

const FINAL_ITEM_LAYOUT_OPTS = gridColumnLayoutOptions({
  headerFilterable: true,
  pinFirst: ['rownum', 'select'],
})

function itemToSearchRow(item: ItemListRow): ItemSearchRow {
  return {
    item_id: item.item_id,
    item_cd: item.item_cd,
    item_nm: item.item_nm,
    itemtyp_id: item.itemtyp_id,
    itemtyp_nm: item.itemtyp_nm,
  }
}

function itemProcessDetail(item: ItemSearchRow): ProductionOrderDetail {
  return {
    production_order_id: 0,
    status: 'registered',
    production_date: '',
    reference_no: null,
    source_type: 'manual',
    parent_item_id: item.item_id,
    parent_item_cd: item.item_cd,
    parent_item_nm: item.item_nm,
    planned_qty: 1,
    actual_qty: null,
    lot: '',
    line_count: 0,
    completed_line_count: 0,
    created_at: null,
    approved_at: null,
    cancelled_at: null,
    notes: null,
    updated_at: null,
    lines: [],
    inputs: [],
    outputs: [],
  }
}

const PANEL_SPLIT_LAYOUT_ID = 'item-process-panels-v1'

function itemProcessUpdateSuccessMessage(
  outputListSaved: boolean,
  processSavedCount: number
): string {
  const parts: string[] = []
  if (outputListSaved) parts.push('output item list')
  if (processSavedCount > 0) {
    parts.push(
      processSavedCount === 1 ? '1 item process' : `${processSavedCount} item processes`
    )
  }
  if (parts.length === 0) return 'Update successful.'
  return `Update successful (${parts.join(', ')}).`
}

function itemProcessUpdateFailedMessage(reason: string): string {
  const trimmed = reason.trim()
  if (trimmed.toLowerCase().startsWith('update failed:')) return trimmed
  return `Update failed: ${trimmed}`
}

export function ItemProcessesPage() {
  const {
    itemsMaster,
    locations: catalogLocations,
    itemtyps,
    customers,
    refresh: refreshCatalog,
    ready: catalogReady,
  } = useMasterCatalog()
  const refreshMasterCatalog = useRefreshMasterCatalogAfterSave()
  const { colorForItem } = useItemTypColors()
  const mastersReadyRef = useRef(false)
  const [finalItemRows, setFinalItemRows] = useState<EditFinalItemRow[]>(() => [
    emptyEditFinalItemRow(),
  ])
  const [selectedFinalItemKey, setSelectedFinalItemKey] = useState<string | null>(null)
  const [selectedOutputItemKeys, setSelectedOutputItemKeys] = useState<Set<string>>(
    () => new Set()
  )
  const [savedFinalItemSnapshots, setSavedFinalItemSnapshots] = useState<
    Map<number, FinalItemRowSnapshot>
  >(() => new Map())
  const [savedProcessSnapshots, setSavedProcessSnapshots] = useState<Map<number, string>>(
    () => new Map()
  )
  const [items, setItems] = useState<ItemListRow[]>([])
  const [locations, setLocations] = useState<Awaited<ReturnType<typeof api.listLocationsMaster>>>([])
  const [processRows, setProcessRows] = useState<EditProcessRow[]>([])
  const [inputRows, setInputRows] = useState<EditInputRow[]>([])
  const processRowsRef = useRef(processRows)
  const inputRowsRef = useRef(inputRows)
  processRowsRef.current = processRows
  inputRowsRef.current = inputRows
  const [pageLoading, setPageLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [updateStatusMessage, setUpdateStatusMessage] = useState<string | null>(null)
  const [updateErrorMessage, setUpdateErrorMessage] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [treeTitle, setTreeTitle] = useState<string | null>(null)
  const [treeLines, setTreeLines] = useState<BomTreeLine[]>([])
  const [outputItemFilter, setOutputItemFilter] = useState<OutputItemTypFilter>('FG')
  const [treeOnSelect, setTreeOnSelect] = useState(true)
  const [treeHighlight, setTreeHighlight] = useState<ProcessTreeHighlight | null>(null)
  const [itemProcessCache, setItemProcessCache] = useState<Map<number, ItemProcessesOut>>(
    () => new Map()
  )
  const [processDraftByItemId, setProcessDraftByItemId] = useState<
    Map<number, { processRows: EditProcessRow[]; inputRows: EditInputRow[] }>
  >(() => new Map())
  const processDraftByItemIdRef = useRef(processDraftByItemId)
  const [exportingExcel, setExportingExcel] = useState(false)
  const deleteOutputRowsRef = useRef<() => void>(() => {})

  useEffect(() => {
    processDraftByItemIdRef.current = processDraftByItemId
  }, [processDraftByItemId])

  const selectedFinalItemRow = useMemo(
    () => finalItemRows.find((row) => row.key === selectedFinalItemKey) ?? null,
    [finalItemRows, selectedFinalItemKey]
  )

  const selectedItem = useMemo((): ItemSearchRow | null => {
    if (!selectedFinalItemRow || !isActiveFinalItemRow(selectedFinalItemRow)) return null
    const item = items.find((row) => row.item_id === selectedFinalItemRow.item_id)
    if (item) return itemToSearchRow(item)
    const catalog = items.find((row) => row.item_id === selectedFinalItemRow.item_id)
    return {
      item_id: Number(selectedFinalItemRow.item_id),
      item_cd: selectedFinalItemRow.item_cd,
      item_nm: selectedFinalItemRow.item_nm,
      itemtyp_id: catalog?.itemtyp_id ?? 0,
      itemtyp_nm: selectedFinalItemRow.itemtyp_nm || catalog?.itemtyp_nm || '',
    }
  }, [selectedFinalItemRow, items])

  const detail = useMemo(
    () => (selectedItem ? itemProcessDetail(selectedItem) : null),
    [selectedItem]
  )

  const finalItemLookups = useMemo(
    () => buildFinalItemCatalogLookups(itemtyps, customers),
    [itemtyps, customers]
  )

  const outputItemtypIds = useMemo(
    () => allowedItemtypIds(itemtyps, ITEM_PROCESS_OUTPUT_ITEMTYP_CDS),
    [itemtyps]
  )
  const inputItemtypIds = useMemo(
    () => allowedItemtypIds(itemtyps, ITEM_PROCESS_INPUT_ITEMTYP_CDS),
    [itemtyps]
  )

  const outputItemDatalistCatalog = useMemo(
    () =>
      filterItemListRowsByItemtypIds(itemsMaster, outputItemtypIds).map((row) => ({
        item_id: row.item_id,
        item_cd: row.item_cd,
        item_nm: row.item_nm,
      })),
    [itemsMaster, outputItemtypIds]
  )

  const inputItemDatalistCatalog = useMemo(
    () =>
      filterItemListRowsByItemtypIds(itemsMaster, inputItemtypIds).map((row) => ({
        item_id: row.item_id,
        item_cd: row.item_cd,
        item_nm: row.item_nm,
      })),
    [itemsMaster, inputItemtypIds]
  )

  const wipItemtyp = useMemo(() => findItemtypByKind(itemtyps, 'WIP'), [itemtyps])
  const fgItemtyp = useMemo(() => findItemtypByKind(itemtyps, 'FG'), [itemtyps])

  const matchesOutputItemTab = useCallback(
    (row: EditFinalItemRow): boolean => {
      if (outputItemFilter === 'ALL') return true
      if (row.item_id === '') return false
      const item = items.find((entry) => entry.item_id === row.item_id)
      const targetId =
        outputItemFilter === 'WIP' ? wipItemtyp?.itemtyp_id : fgItemtyp?.itemtyp_id
      if (item && targetId != null) return item.itemtyp_id === targetId
      const cd = row.itemtyp_cd.trim().toUpperCase()
      if (outputItemFilter === 'WIP') return cd === 'WIP'
      return cd === 'FG'
    },
    [outputItemFilter, items, wipItemtyp?.itemtyp_id, fgItemtyp?.itemtyp_id]
  )

  const tabFilteredFinalItemRows = useMemo(() => {
    if (finalItemRows.length === 0) return []
    const last = finalItemRows[finalItemRows.length - 1]
    const hasSentinel = isBlankFinalItemRow(last)
    const dataRows = hasSentinel ? finalItemRows.slice(0, -1) : finalItemRows
    const sentinel = hasSentinel ? last : null
    const matched = dataRows.filter((row) => matchesOutputItemTab(row))
    if (!sentinel) return matched
    return [...matched, sentinel]
  }, [finalItemRows, matchesOutputItemTab])

  useEffect(() => {
    if (!selectedFinalItemKey) return
    const selected = tabFilteredFinalItemRows.find((row) => row.key === selectedFinalItemKey)
    if (selected && !isBlankFinalItemRow(selected)) return
    const firstActive = tabFilteredFinalItemRows.find((row) => isActiveFinalItemRow(row))
    setSelectedFinalItemKey(firstActive?.key ?? null)
  }, [outputItemFilter, tabFilteredFinalItemRows, selectedFinalItemKey])

  useEffect(() => {
    const valid = new Set(finalItemRows.map((row) => row.key))
    setSelectedOutputItemKeys((prev) => {
      const next = new Set([...prev].filter((key) => valid.has(key)))
      return next.size === prev.size ? prev : next
    })
  }, [finalItemRows])

  const outputItemRoots = useMemo(
    () =>
      finalItemRows
        .filter(isActiveFinalItemRow)
        .map((row) => ({ item_id: Number(row.item_id), item_cd: row.item_cd })),
    [finalItemRows]
  )

  const finalItemCodeByItemId = useMemo(
    () =>
      buildOutputItemFinalItemCodeMap({
        roots: outputItemRoots,
        items,
        cache: itemProcessCache,
        activeRootId: selectedItem?.item_id,
        activeProcessRows:
          selectedItem?.item_id != null ? processRows : undefined,
        activeInputRows: selectedItem?.item_id != null ? inputRows : undefined,
      }),
    [
      outputItemRoots,
      items,
      itemProcessCache,
      selectedItem?.item_id,
      processRows,
      inputRows,
    ]
  )

  const resolveFinalItemCd = useCallback(
    (row: EditFinalItemRow) => {
      if (row.item_id === '') return ''
      const id = Number(row.item_id)
      return finalItemCodeByItemId.get(id) ?? row.item_cd
    },
    [finalItemCodeByItemId]
  )

  const finalItemFilterValue = useCallback(
    (row: EditFinalItemRow, col: string) => {
      switch (col) {
        case 'item_cd':
          return toFilterCellValue(row.item_cd)
        case 'item_nm':
          return toFilterCellValue(row.item_nm)
        case 'final_item_cd':
          return toFilterCellValue(resolveFinalItemCd(row))
        case 'itemtyp_cd':
          return toFilterCellValue(row.itemtyp_cd)
        case 'customer_cd':
          return toFilterCellValue(row.customer_cd)
        default:
          return toFilterCellValue('')
      }
    },
    [resolveFinalItemCd]
  )

  const { finalItemDataRows, finalItemTrailingRow } = useMemo(() => {
    if (tabFilteredFinalItemRows.length === 0) {
      return { finalItemDataRows: [], finalItemTrailingRow: null as EditFinalItemRow | null }
    }
    const last = tabFilteredFinalItemRows[tabFilteredFinalItemRows.length - 1]
    if (isBlankFinalItemRow(last)) {
      return {
        finalItemDataRows: tabFilteredFinalItemRows.slice(0, -1),
        finalItemTrailingRow: last,
      }
    }
    return { finalItemDataRows: tabFilteredFinalItemRows, finalItemTrailingRow: null }
  }, [tabFilteredFinalItemRows])

  const loadedProcessItemIdRef = useRef<number | null>(null)

  const syncFinalItemRowsWithCatalog = useCallback(
    (catalog: ItemListRow[], prev: EditFinalItemRow[], lookups: typeof finalItemLookups) =>
      prev.map((row) => {
        if (row.item_id === '') return row
        const item = catalog.find((entry) => entry.item_id === row.item_id)
        if (!item) return row
        return {
          key: isDraftFinalItemKey(row.key) ? row.key : stableFinalItemKey(item.item_id),
          ...finalItemFieldsFromCatalogItem(item, lookups),
        }
      }),
    []
  )

  const applyFinalItemRowsFromApi = useCallback(
    (
      apiRows: Awaited<ReturnType<typeof api.listItemProcessFinalItems>>,
      catalog: ItemListRow[],
      localRows: EditFinalItemRow[],
      lookups: typeof finalItemLookups,
      selectItemId?: number
    ) => {
      const merged = mergeFinalItemRowsForDisplay(apiRows, localRows, catalog, lookups)
      const withBlank = ensureTrailingBlankRow(
        merged,
        isBlankFinalItemRow,
        emptyEditFinalItemRow
      )
      let nextKey: string | null = null
      if (selectItemId != null) {
        const key = stableFinalItemKey(selectItemId)
        if (withBlank.some((row) => row.key === key)) nextKey = key
      }
      if (nextKey == null) {
        const firstActive = withBlank.find((row) => isActiveFinalItemRow(row))
        nextKey = firstActive?.key ?? null
      }
      setFinalItemRows(withBlank)
      setSavedFinalItemSnapshots(
        finalItemRowSnapshotsFromEditRows(withBlank.filter(isActiveFinalItemRow))
      )
      setSelectedFinalItemKey(nextKey)
    },
    []
  )

  const initialPageLoadRef = useRef(false)

  useEffect(() => {
    if (!catalogReady || initialPageLoadRef.current) return
    initialPageLoadRef.current = true
    const load = async () => {
      setPageLoading(true)
      setError(null)
      try {
        const apiFinalItems = await api.listItemProcessFinalItems()
        setItems(itemsMaster)
        setLocations(catalogLocations)
        applyFinalItemRowsFromApi(
          apiFinalItems,
          itemsMaster,
          [],
          buildFinalItemCatalogLookups(itemtyps, customers),
          undefined
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load item processes')
      } finally {
        setPageLoading(false)
        mastersReadyRef.current = true
      }
    }
    void load()
  }, [catalogReady, itemsMaster, catalogLocations, itemtyps, customers, applyFinalItemRowsFromApi])

  useEffect(() => {
    if (!mastersReadyRef.current || refreshing) return
    setItems(itemsMaster)
    setLocations(catalogLocations)
    setFinalItemRows((prev) =>
      ensureTrailingBlankRow(
        syncFinalItemRowsWithCatalog(itemsMaster, prev, finalItemLookups),
        isBlankFinalItemRow,
        emptyEditFinalItemRow
      )
    )
  }, [itemsMaster, catalogLocations, syncFinalItemRowsWithCatalog, finalItemLookups, refreshing])

  const itemIdUsedInOtherRow = useCallback(
    (itemId: number, exceptKey: string) =>
      finalItemRows.some((row) => row.key !== exceptKey && row.item_id === itemId),
    [finalItemRows]
  )

  const updateFinalItemRow = useCallback((key: string, patch: Partial<EditFinalItemRow>) => {
    setFinalItemRows((rows) =>
      updateRowWithTrailingBlank(rows, key, patch, isBlankFinalItemRow, emptyEditFinalItemRow)
    )
  }, [])

  const applyFinalItemPatch = useCallback(
    (
      key: string,
      patch: Partial<
        Pick<EditFinalItemRow, 'item_id' | 'item_cd' | 'item_nm' | 'itemtyp_cd' | 'customer_cd'>
      >
    ) => {
      if (patch.item_id !== '' && itemIdUsedInOtherRow(Number(patch.item_id), key)) {
        setRowError('final_item_duplicate')
        return
      }
      setRowError(null)
      const nextKey =
        patch.item_id !== '' ? stableFinalItemKey(Number(patch.item_id)) : key
      updateFinalItemRow(key, { ...patch, key: nextKey })
      if (patch.item_id !== '') {
        setSelectedFinalItemKey(nextKey)
      }
    },
    [itemIdUsedInOtherRow, updateFinalItemRow]
  )

  const activateFinalItemRow = useCallback(
    (row: EditFinalItemRow) => {
      if (row.key !== selectedFinalItemKey) {
        const itemId = selectedItem?.item_id
        if (itemId != null) {
          setProcessDraftByItemId((prev) => {
            const next = new Map(prev)
            next.set(itemId, {
              processRows: processRowsRef.current,
              inputRows: inputRowsRef.current,
            })
            return next
          })
        }
      }
      setSelectedFinalItemKey(row.key)
    },
    [selectedFinalItemKey, selectedItem?.item_id]
  )

  const applyProcessesToGrids = useCallback(
    (data: Awaited<ReturnType<typeof api.getItemProcesses>>, itemId?: number) => {
      const procRows = itemProcessesToEditProcessRows(data.processes)
      const inputData = itemProcessesToEditInputRows(data.processes)
      const lineNos = data.processes.map((proc) => proc.line_no)
      const normalized = ensureItemProcessEditRows(procRows, inputData, lineNos)
      const processRowsFinal = ensureTrailingBlankRow(
        normalized.processRows,
        isBlankItemProcessRow,
        (rows) => createBlankProcessRowForDetail(rows)
      )
      setProcessRows(processRowsFinal)
      setInputRows(normalized.inputRows)
      setRowError(null)
      const snapshotItemId = itemId ?? data.item_id
      setSavedProcessSnapshots((prev) => {
        const next = new Map(prev)
        next.set(
          snapshotItemId,
          serializeItemProcessEditDraft(
            processRowsFinal,
            normalized.inputRows,
            snapshotItemId
          )
        )
        return next
      })
    },
    []
  )

  const loadProcesses = useCallback(
    async (itemId: number) => {
      setLoading(true)
      setError(null)
      try {
        const data = await api.getItemProcesses(itemId)
        applyProcessesToGrids(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load item processes')
        setProcessRows([])
        setInputRows([])
      } finally {
        setLoading(false)
      }
    },
    [applyProcessesToGrids]
  )

  const applyDraftToGrids = useCallback(
    (
      draft: { processRows: EditProcessRow[]; inputRows: EditInputRow[] },
      itemId: number
    ) => {
      const lineNos = draft.processRows
        .filter((row) => !isBlankItemProcessRow(row))
        .map((row) => row.line_no)
      const normalized = ensureItemProcessEditRows(
        draft.processRows,
        draft.inputRows,
        lineNos
      )
      const processRowsFinal = ensureTrailingBlankRow(
        normalized.processRows,
        isBlankItemProcessRow,
        (rows) => createBlankProcessRowForDetail(rows)
      )
      setProcessRows(processRowsFinal)
      setInputRows(normalized.inputRows)
      setRowError(null)
      loadedProcessItemIdRef.current = itemId
    },
    []
  )

  const stashCurrentProcessEdits = useCallback(() => {
    const itemId = selectedItem?.item_id
    if (itemId == null) return
    setProcessDraftByItemId((prev) => {
      const next = new Map(prev)
      next.set(itemId, {
        processRows: processRowsRef.current,
        inputRows: inputRowsRef.current,
      })
      return next
    })
  }, [selectedItem?.item_id])

  const resolveProcessDraft = useCallback(
    (itemId: number) => {
      if (selectedItem?.item_id === itemId) {
        return {
          processRows: processRowsRef.current,
          inputRows: inputRowsRef.current,
        }
      }
      return processDraftByItemIdRef.current.get(itemId)
    },
    [selectedItem?.item_id]
  )

  const finalItemGrid = useExcelLikeGrid({
    columns: itemProcessFinalItemColumns,
    rows: finalItemDataRows,
    getFilterValue: finalItemFilterValue,
    rowDelete: {
      label: 'Delete row',
      getSelectedCount: () => selectedOutputItemKeys.size,
      onDelete: () => deleteOutputRowsRef.current(),
    },
    excelExport: {
      sheetName: 'Item Processes',
      filenamePrefix: 'item_processes',
      runExport: async () => {
        setExportingExcel(true)
        setError(null)
        try {
          stashCurrentProcessEdits()
          const activeRows = finalItemRows.filter(isActiveFinalItemRow)
          const liveEdits = new Map(processDraftByItemIdRef.current)
          if (selectedItem?.item_id != null) {
            liveEdits.set(selectedItem.item_id, { processRows, inputRows })
          }
          const processDataByItemId = new Map(itemProcessCache)
          for (const row of activeRows) {
            const itemId = Number(row.item_id)
            if (liveEdits.has(itemId)) continue
            if (processDataByItemId.has(itemId)) continue
            try {
              const data = await api.getItemProcesses(itemId)
              processDataByItemId.set(itemId, data)
            } catch {
              processDataByItemId.set(itemId, { item_id: itemId, processes: [] })
            }
          }
          const body = buildItemProcessExportBodyRows({
            finalItems: activeRows,
            processDataByItemId,
            liveEditsByItemId: liveEdits,
          })
          downloadItemProcessExcel(body)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to export item processes')
        } finally {
          setExportingExcel(false)
        }
      },
    },
    excelImport: {
      parseFile: async (file) => {
        const rows = await parseItemProcessExcelFile(file)
        return rows as unknown as Record<string, string>[]
      },
      applyParsedRows: async (parsed) => {
        stashCurrentProcessEdits()
        setError(null)
        setSuccess(null)
        setUpdateStatusMessage(null)
        setUpdateErrorMessage(null)
        setRowError(null)
        try {
          const apiFinalItems = await api.listItemProcessFinalItems()
          const result = mergeItemProcessImportRows({
            parsed: parsed as unknown as ItemProcessExcelRow[],
            existingFinalItems: finalItemRows,
            apiFinalItems,
            items,
            locations,
            lookups: finalItemLookups,
          })
          setFinalItemRows(result.finalItemRows)
          setProcessDraftByItemId((prev) => {
            const next = new Map(prev)
            for (const [itemId, draft] of result.processDraftByItemId) {
              next.set(itemId, draft)
            }
            return next
          })
          const importedIds = [...result.processDraftByItemId.keys()]
          if (importedIds.length > 0) {
            const firstId = importedIds[0]
            const key = stableFinalItemKey(firstId)
            setSelectedFinalItemKey(key)
            applyDraftToGrids(result.processDraftByItemId.get(firstId)!, firstId)
          }
          const parts: string[] = []
          if (result.addedOutputItems > 0) {
            parts.push(`${result.addedOutputItems} output item(s) added`)
          }
          if (result.updatedOutputItems > 0) {
            parts.push(`${result.updatedOutputItems} output item(s) updated`)
          }
          if (result.importedProcessItems > 0) {
            parts.push(`${result.importedProcessItems} process definition(s) loaded`)
          }
          setSuccess(
            parts.length > 0
              ? `Import: ${parts.join(', ')}. Click Save to persist.`
              : 'Import completed. Click Save to persist output item list changes.'
          )
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to import item processes')
        }
      },
    },
  })

  const finalItemDisplayRows = useMemo(
    () =>
      finalItemTrailingRow
        ? [...finalItemGrid.displayRows, finalItemTrailingRow]
        : finalItemGrid.displayRows,
    [finalItemGrid.displayRows, finalItemTrailingRow]
  )

  const selectableOutputRows = useMemo(
    () => selectableDisplayRows(finalItemDisplayRows, isBlankFinalItemRow),
    [finalItemDisplayRows]
  )

  const selectedOutputCount = useMemo(
    () =>
      selectedSelectableCount(selectableOutputRows, selectedOutputItemKeys, (row) => row.key),
    [selectableOutputRows, selectedOutputItemKeys]
  )

  const finalItemLayout = useGridColumnLayout(
    'item-process-final-item-v5',
    itemProcessFinalItemColumns,
    { ...FINAL_ITEM_LAYOUT_OPTS, rowCount: finalItemDisplayRows.length }
  )

  useEffect(() => {
    finalItemGrid.onLayoutReady(finalItemLayout)
  }, [finalItemLayout, finalItemGrid.onLayoutReady])

  useEffect(() => {
    if (outputItemRoots.length === 0) {
      setItemProcessCache(new Map())
      return
    }
    let cancelled = false
    void (async () => {
      const loaded = new Map<number, ItemProcessesOut>()
      const fetched = new Set<number>()
      const queue = outputItemRoots.map((root) => root.item_id)
      while (queue.length > 0) {
        const itemId = queue.shift()!
        if (fetched.has(itemId)) continue
        fetched.add(itemId)
        try {
          const data = await api.getItemProcesses(itemId)
          loaded.set(itemId, data)
          for (const proc of data.processes) {
            for (const inp of proc.inputs) {
              if (isWipItem(items, inp.item_id) && !fetched.has(inp.item_id)) {
                queue.push(inp.item_id)
              }
            }
          }
        } catch {
          // no subprocess definition
        }
      }
      if (!cancelled) {
        setItemProcessCache((prev) => {
          const merged = new Map(prev)
          for (const [id, data] of loaded) merged.set(id, data)
          return merged
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [outputItemRoots, items])

  useEffect(() => {
    if (!selectedItem) return
    let cancelled = false
    void (async () => {
      const queue = collectWipItemProcessIds(inputRows, items, itemProcessCache)
      const loaded = new Map<number, ItemProcessesOut>()
      const fetched = new Set<number>()
      while (queue.length > 0) {
        const itemId = queue.shift()!
        if (fetched.has(itemId)) continue
        fetched.add(itemId)
        try {
          const data = await api.getItemProcesses(itemId)
          loaded.set(itemId, data)
          for (const proc of data.processes) {
            for (const inp of proc.inputs) {
              if (isWipItem(items, inp.item_id) && !fetched.has(inp.item_id)) {
                queue.push(inp.item_id)
              }
            }
          }
        } catch {
          // no subprocess definition
        }
      }
      if (!cancelled) {
        setItemProcessCache((prev) => {
          const merged = new Map(prev)
          for (const [id, data] of loaded) merged.set(id, data)
          return merged
        })
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- merge extra WIP subprocess defs for selected tree
  }, [selectedItem?.item_id, inputRows, items])

  useEffect(() => {
    if (!selectedItem) {
      loadedProcessItemIdRef.current = null
      setProcessRows([])
      setInputRows([])
      setTreeTitle(null)
      setTreeLines([])
      setTreeHighlight(null)
      return
    }
    setTreeHighlight(parentTreeHighlight(selectedItem.item_id))
    if (loadedProcessItemIdRef.current === selectedItem.item_id) return
    const draft = processDraftByItemIdRef.current.get(selectedItem.item_id)
    if (draft) {
      applyDraftToGrids(draft, selectedItem.item_id)
      return
    }
    setProcessRows([])
    setInputRows([])
    loadedProcessItemIdRef.current = selectedItem.item_id
    void loadProcesses(selectedItem.item_id)
  }, [selectedItem?.item_id, loadProcesses, applyDraftToGrids])

  const handleReload = useCallback(async () => {
    const selectId = selectedItem?.item_id
    setRefreshing(true)
    setError(null)
    setSuccess(null)
    setUpdateStatusMessage(null)
    setUpdateErrorMessage(null)
    setRowError(null)
    try {
      const snapshot = await refreshCatalog()
      const apiFinalItems = await api.listItemProcessFinalItems()
      setItems(snapshot.itemsMaster)
      setLocations(snapshot.locations)
      applyFinalItemRowsFromApi(
        apiFinalItems,
        snapshot.itemsMaster,
        [],
        buildFinalItemCatalogLookups(snapshot.itemtyps, snapshot.customers),
        selectId
      )
      setItemProcessCache(new Map())
      setProcessDraftByItemId(new Map())
      if (selectId != null) {
        loadedProcessItemIdRef.current = null
        await loadProcesses(selectId)
      } else {
        loadedProcessItemIdRef.current = null
        setProcessRows([])
        setInputRows([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reload')
    } finally {
      setRefreshing(false)
    }
  }, [selectedItem?.item_id, applyFinalItemRowsFromApi, loadProcesses, refreshCatalog])

  const handleTreeDataChange = useCallback((data: ProductionTreeData) => {
    setTreeTitle((prev) => (prev === data.title ? prev : data.title))
    setTreeLines((prev) => (isSameProductionTreeData(data, data.title, prev) ? prev : data.lines))
  }, [])

  const handleSave = async () => {
    setUpdateStatusMessage(null)
    setUpdateErrorMessage(null)
    setSuccess(null)
    setRowError(null)

    const resolveDraftForDirtyCheck = (itemId: number) => {
      const draft = resolveProcessDraft(itemId)
      if (!draft) return null
      return {
        processRows: draft.processRows,
        inputRows: resolveItemProcessInputRowsFromCatalog(items, draft.inputRows),
      }
    }

    const resolveDraftForSave = (itemId: number) => {
      const draft = resolveProcessDraft(itemId)
      if (!draft) return null
      return prepareItemProcessDraftForSave(
        draft.processRows,
        draft.inputRows,
        itemId,
        items
      )
    }

    const activeFinalRows = finalItemRows.filter(isActiveFinalItemRow)
    const seenItemIds = new Set<number>()
    for (const row of activeFinalRows) {
      const itemId = Number(row.item_id)
      if (seenItemIds.has(itemId)) {
        setRowError('final_item_duplicate')
        setUpdateErrorMessage(
          itemProcessUpdateFailedMessage('This item is already listed in Output Item.')
        )
        return
      }
      seenItemIds.add(itemId)
    }

    const outputDirty = isOutputItemListDirty(finalItemRows, savedFinalItemSnapshots)

    stashCurrentProcessEdits()

    const dirtyProcessItemIds = activeFinalRows
      .map((row) => Number(row.item_id))
      .filter((itemId) => {
        const draft = resolveDraftForDirtyCheck(itemId)
        if (!draft) return false
        return isItemProcessEditDirty(
          itemId,
          draft.processRows,
          draft.inputRows,
          savedProcessSnapshots
        )
      })

    if (!outputDirty && dirtyProcessItemIds.length === 0) {
      if (selectedItem) {
        const selectedDraft = resolveDraftForDirtyCheck(selectedItem.item_id)
        const hasProcesses =
          selectedDraft?.processRows.some((row) => !isBlankItemProcessRow(row)) ?? false
        if (hasProcesses && selectedDraft) {
          const inputValidationError = itemProcessInputSaveValidationMessage(
            selectedDraft.processRows,
            selectedDraft.inputRows,
            items,
            { requireInputsWhenProcessesExist: true }
          )
          if (inputValidationError) {
            setUpdateErrorMessage(itemProcessUpdateFailedMessage(inputValidationError))
            return
          }
        }
      }
      setUpdateErrorMessage(itemProcessUpdateFailedMessage('No changes to save.'))
      return
    }

    for (const itemId of dirtyProcessItemIds) {
      const draft = resolveDraftForSave(itemId)
      if (!draft) continue
      const inputValidationError = itemProcessInputSaveValidationMessage(
        draft.processRows,
        draft.inputRows,
        items
      )
      if (inputValidationError) {
        setUpdateErrorMessage(itemProcessUpdateFailedMessage(inputValidationError))
        return
      }
      const payload = editRowsToItemProcessesSave(draft.processRows, draft.inputRows, itemId)
      if (payload.processes.length === 0) {
        setUpdateErrorMessage(
          itemProcessUpdateFailedMessage('Enter at least one process location before saving.')
        )
        return
      }
    }

    setSubmitting(true)
    setError(null)
    try {
      let savedCount = 0
      let outputListSaved = false

      if (outputDirty) {
        await api.saveItemProcessFinalItems({
          item_ids: activeFinalRows.map((row) => Number(row.item_id)),
        })
        outputListSaved = true
        setFinalItemRows((rows) => {
          const active = rows.filter(isActiveFinalItemRow)
          const normalized = active.map((row) => ({
            key: stableFinalItemKey(Number(row.item_id)),
            item_id: Number(row.item_id),
            item_cd: row.item_cd.trim(),
            item_nm: row.item_nm.trim(),
            itemtyp_cd: row.itemtyp_cd.trim(),
            customer_cd: row.customer_cd.trim(),
          }))
          const withBlank = ensureTrailingBlankRow(
            normalized,
            isBlankFinalItemRow,
            emptyEditFinalItemRow
          )
          setSavedFinalItemSnapshots(
            finalItemRowSnapshotsFromEditRows(withBlank.filter(isActiveFinalItemRow))
          )
          return withBlank
        })
      }

      for (const itemId of dirtyProcessItemIds) {
        const draft = resolveDraftForSave(itemId)!
        const payload = editRowsToItemProcessesSave(draft.processRows, draft.inputRows, itemId)
        const saved = await api.saveItemProcesses(itemId, payload)
        setItemProcessCache((prev) => {
          const next = new Map(prev)
          next.set(saved.item_id, saved)
          return next
        })
        setSavedProcessSnapshots((prev) => {
          const next = new Map(prev)
          const procRows = itemProcessesToEditProcessRows(saved.processes)
          const inputData = itemProcessesToEditInputRows(saved.processes)
          const lineNos = saved.processes.map((proc) => proc.line_no)
          const normalized = ensureItemProcessEditRows(procRows, inputData, lineNos)
          const processRowsFinal = ensureTrailingBlankRow(
            normalized.processRows,
            isBlankItemProcessRow,
            (rows) => createBlankProcessRowForDetail(rows)
          )
          next.set(
            itemId,
            serializeItemProcessEditDraft(processRowsFinal, normalized.inputRows, itemId)
          )
          return next
        })
        setProcessDraftByItemId((prev) => {
          const next = new Map(prev)
          next.delete(itemId)
          return next
        })
        if (selectedItem?.item_id === itemId) {
          applyProcessesToGrids(saved, itemId)
          loadedProcessItemIdRef.current = itemId
        }
        savedCount += 1
      }

      setUpdateStatusMessage(
        itemProcessUpdateSuccessMessage(outputListSaved, savedCount)
      )
      refreshMasterCatalog()
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Failed to save item processes'
      setUpdateErrorMessage(itemProcessUpdateFailedMessage(reason))
    } finally {
      setSubmitting(false)
    }
  }

  const removeSelectedOutputItemsFromGrid = () => {
    if (selectedOutputItemKeys.size === 0) return
    const clearedActiveSelection =
      selectedFinalItemKey != null && selectedOutputItemKeys.has(selectedFinalItemKey)
    setFinalItemRows((rows) =>
      removeSelectedGridRows(
        rows,
        selectedOutputItemKeys,
        isBlankFinalItemRow,
        emptyEditFinalItemRow
      )
    )
    setSelectedOutputItemKeys(new Set())
    if (clearedActiveSelection) {
      setSelectedFinalItemKey(null)
      loadedProcessItemIdRef.current = null
      setProcessRows([])
      setInputRows([])
    }
  }
  deleteOutputRowsRef.current = removeSelectedOutputItemsFromGrid

  const deleteSelectedOutputItems = async () => {
    if (selectedOutputItemKeys.size === 0) return
    if (!confirm(deleteSelectedConfirm(selectedOutputItemKeys.size, 'output item(s)'))) return

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    setRowError(null)
    try {
      const targets = finalItemRows.filter(
        (row) => selectedOutputItemKeys.has(row.key) && isActiveFinalItemRow(row)
      )
      const deletedKeys = new Set(targets.map((row) => row.key))
      const deletedIds = new Set(targets.map((row) => Number(row.item_id)))

      for (const row of targets) {
        await api.saveItemProcesses(Number(row.item_id), { processes: [] })
      }

      setFinalItemRows((rows) => {
        const next = ensureTrailingBlankRow(
          rows.filter((row) => !deletedKeys.has(row.key)),
          isBlankFinalItemRow,
          emptyEditFinalItemRow
        )
        setSavedFinalItemSnapshots(
          finalItemRowSnapshotsFromEditRows(next.filter(isActiveFinalItemRow))
        )
        return next
      })
      setSelectedOutputItemKeys(new Set())
      if (selectedFinalItemKey && deletedKeys.has(selectedFinalItemKey)) {
        setSelectedFinalItemKey(null)
        loadedProcessItemIdRef.current = null
        setProcessRows([])
        setInputRows([])
      }
      setItemProcessCache((prev) => {
        const next = new Map(prev)
        for (const id of deletedIds) next.delete(id)
        return next
      })
      setSavedProcessSnapshots((prev) => {
        const next = new Map(prev)
        for (const id of deletedIds) next.delete(id)
        return next
      })
      setProcessDraftByItemId((prev) => {
        const next = new Map(prev)
        for (const id of deletedIds) next.delete(id)
        return next
      })
      setSuccess(
        targets.length === 1 ? '1 output item deleted.' : `${targets.length} output items deleted.`
      )
      refreshMasterCatalog()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete output items')
    } finally {
      setSubmitting(false)
    }
  }

  const saveErrorMessage = (() => {
    if (!rowError) return null
    if (rowError === 'final_item_duplicate') {
      return 'This item is already listed in Output Item.'
    }
    if (rowError === 'process_validation') {
      return 'Enter at least one process location before saving.'
    }
    if (rowError === 'input_validation') {
      return 'Enter at least one valid input line before saving.'
    }
    return rowError
  })()

  const saveFeedbackMessage = updateErrorMessage ?? saveErrorMessage

  const processInputLayoutApiRef = useRef<{
    saveLayouts: () => void
    isDirty: boolean
  } | null>(null)
  const panelSplit = useProductionPanelSplitLayout(PANEL_SPLIT_LAYOUT_ID)
  const [processInputGridDirty, setProcessInputGridDirty] = useState(false)

  const handleProcessInputGridLayoutsReady = useCallback(
    (api: { saveLayouts: () => void; isDirty: boolean }) => {
      processInputLayoutApiRef.current = api
      setProcessInputGridDirty(api.isDirty)
    },
    []
  )

  const handleSaveAllGridLayouts = useCallback(() => {
    finalItemLayout.saveLayout()
    panelSplit.saveLayout()
    processInputLayoutApiRef.current?.saveLayouts()
  }, [finalItemLayout.saveLayout, panelSplit.saveLayout])

  const saveGridIsDirty =
    panelSplit.isDirty ||
    processInputGridDirty ||
    finalItemLayout.isDirty

  return (
    <ErpScreen
      error={error}
      className="erp-screen-stacked"
      title="Item Processes"
      onRefresh={() => void handleReload()}
      onSaveGrid={handleSaveAllGridLayouts}
      saveGridIsDirty={saveGridIsDirty}
    >
      {finalItemGrid.filterMenuElement}
      {finalItemGrid.contextMenuElement}
      {pageLoading ? (
        <p className="muted erp-grid-empty">Loading…</p>
      ) : (
      <ProductionDetailSplit
        hasTree={treeOnSelect}
        treeWidthRatio={panelSplit.layout.treeWidthRatio}
        onTreeWidthRatioChange={panelSplit.setTreeWidthRatio}
        tree={
          treeTitle && treeLines.length > 0 ? (
            <BomTreePanel
              sidebar
              title={treeTitle}
              lines={treeLines}
              highlight={treeHighlight}
            />
          ) : (
            <ProductionTreeSidebar title="Tree">
              <p className="muted erp-grid-empty">
                {selectedItem
                  ? 'Enter process steps to show tree.'
                  : 'Select an output item to show tree.'}
              </p>
            </ProductionTreeSidebar>
          )
        }
      >
          <div className="erp-panel erp-panel-grow erp-detail-panel">
            <div className="erp-panel-content erp-detail-content erp-detail-content-split">
              <OutputItemProcessSplitLayout
                outputItemHeightRatio={panelSplit.layout.outputItemHeightRatio}
                onOutputItemHeightRatioChange={panelSplit.setOutputItemHeightRatio}
                outputItem={
              <section
                className="erp-production-detail-section erp-production-detail-section-split"
                data-production-grid="final-item"
              >
                <div className="erp-production-detail-section-title">Output Item</div>
                <div className="erp-detail-toolbar erp-production-detail-toolbar">
                  <div className="erp-toolbar-left">
                    <button
                      type="button"
                      className={`erp-tab${outputItemFilter === 'ALL' ? ' active' : ''}`}
                      onClick={() => setOutputItemFilter('ALL')}
                    >
                      All
                    </button>
                    {wipItemtyp ? (
                      <button
                        type="button"
                        className={`erp-tab${outputItemFilter === 'WIP' ? ' active' : ''}`}
                        onClick={() => setOutputItemFilter('WIP')}
                      >
                        {itemTypTabLabel(wipItemtyp)}
                      </button>
                    ) : null}
                    {fgItemtyp ? (
                      <button
                        type="button"
                        className={`erp-tab${outputItemFilter === 'FG' ? ' active' : ''}`}
                        onClick={() => setOutputItemFilter('FG')}
                      >
                        {itemTypTabLabel(fgItemtyp)}
                      </button>
                    ) : null}
                    <label className="erp-toolbar-tree-toggle">
                      Tree
                      <input
                        type="checkbox"
                        checked={treeOnSelect}
                        onChange={(e) => setTreeOnSelect(e.target.checked)}
                      />
                    </label>
                  </div>
                  <div className="erp-detail-toolbar-actions">
                    <MasterGridToolbarActions
                      submitting={submitting || refreshing || exportingExcel}
                      rowError={saveFeedbackMessage}
                      statusMessage={updateStatusMessage ?? success}
                      selectedCount={selectedOutputCount}
                      onSave={() => void handleSave()}
                      onDelete={() => void deleteSelectedOutputItems()}
                    />
                  </div>
                </div>
                <div
                  className="erp-grid-wrap erp-grid-wrap-detail"
                  onContextMenu={finalItemGrid.openContextMenu}
                >
                  <ResizableGridTable
                    layout={finalItemLayout}
                    selectColumnHeader={
                      <GridRowSelectButtons
                        rowCount={selectableOutputRows.length}
                        selectedCount={selectedOutputCount}
                        onSelectAll={() =>
                          setSelectedOutputItemKeys(
                            new Set(selectableOutputRows.map((row) => row.key))
                          )
                        }
                        onClearSelection={() => setSelectedOutputItemKeys(new Set())}
                      />
                    }
                    {...finalItemGrid.tableProps}
                  >
                    <tbody>
                      {finalItemDisplayRows.map((row, index) => {
                        const isSentinel = isBlankFinalItemRow(row)
                        const isRowSelected = selectedOutputItemKeys.has(row.key)
                        const isActiveRow = selectedFinalItemKey === row.key
                        return (
                        <tr
                          key={row.key}
                          className={
                            [
                              erpRowClass(index, isActiveRow),
                              isRowSelected ? ' selected' : '',
                              isSentinel ? ' erp-grid-row-sentinel' : '',
                            ]
                              .filter(Boolean)
                              .join('') || undefined
                          }
                          onClick={() => activateFinalItemRow(row)}
                        >
                          {finalItemLayout.orderedColumns.map((col) => {
                            switch (col.key) {
                              case 'rownum':
                                return <GridRowNumCell key={col.key} index={index} />
                              case 'select':
                                if (isSentinel) {
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
                                      checked={isRowSelected}
                                      aria-label={`Select ${row.item_cd || 'row'}`}
                                      onChange={(e) => {
                                        setSelectedOutputItemKeys((prev) => {
                                          const next = new Set(prev)
                                          if (e.target.checked) next.add(row.key)
                                          else next.delete(row.key)
                                          return next
                                        })
                                      }}
                                    />
                                  </td>
                                )
                              case 'item_cd':
                                return (
                                  <td key={col.key} className="erp-grid-cell-edit">
                                    {showItemMasterDatalist(row.item_id) ? (
                                      <GridItemDatalistField
                                        mode="cd"
                                        items={outputItemDatalistCatalog}
                                        listId={`item-process-final-item-cd-${row.key}`}
                                        value={row.item_cd}
                                        style={itemTextColorStyle(
                                          colorForItem(
                                            row.item_id === '' ? null : row.item_id
                                          )
                                        )}
                                        onFocus={() => activateFinalItemRow(row)}
                                        onChange={(value) => {
                                          const patch = finalItemCdFieldPatch(
                                            itemsMaster,
                                            finalItemLookups,
                                            value
                                          )
                                          applyFinalItemPatch(row.key, patch)
                                        }}
                                      />
                                    ) : (
                                      <GridItemResolvedInput
                                        value={row.item_cd}
                                        style={itemTextColorStyle(
                                          colorForItem(
                                            row.item_id === '' ? null : row.item_id
                                          )
                                        )}
                                        onFocus={() => activateFinalItemRow(row)}
                                        onChange={(value) => {
                                          const patch = finalItemCdFieldPatch(
                                            itemsMaster,
                                            finalItemLookups,
                                            value
                                          )
                                          applyFinalItemPatch(row.key, patch)
                                        }}
                                      />
                                    )}
                                  </td>
                                )
                              case 'item_nm':
                                return (
                                  <td key={col.key} className="erp-grid-cell-edit">
                                    {showItemMasterDatalist(row.item_id) ? (
                                      <GridItemDatalistField
                                        mode="nm"
                                        items={outputItemDatalistCatalog}
                                        listId={`item-process-final-item-nm-${row.key}`}
                                        value={row.item_nm}
                                        style={itemTextColorStyle(
                                          colorForItem(
                                            row.item_id === '' ? null : row.item_id
                                          )
                                        )}
                                        onFocus={() => activateFinalItemRow(row)}
                                        onChange={(value) => {
                                          const patch = finalItemNmFieldPatch(
                                            itemsMaster,
                                            finalItemLookups,
                                            value
                                          )
                                          applyFinalItemPatch(row.key, patch)
                                        }}
                                      />
                                    ) : (
                                      <GridItemResolvedInput
                                        value={row.item_nm}
                                        style={itemTextColorStyle(
                                          colorForItem(
                                            row.item_id === '' ? null : row.item_id
                                          )
                                        )}
                                        onFocus={() => activateFinalItemRow(row)}
                                        onChange={(value) => {
                                          const patch = finalItemNmFieldPatch(
                                            itemsMaster,
                                            finalItemLookups,
                                            value
                                          )
                                          applyFinalItemPatch(row.key, patch)
                                        }}
                                      />
                                    )}
                                  </td>
                                )
                              case 'final_item_cd':
                                return (
                                  <td key={col.key} className="erp-grid-cell-readonly">
                                    {resolveFinalItemCd(row)}
                                  </td>
                                )
                              case 'itemtyp_cd':
                                return (
                                  <td key={col.key}>
                                    <span
                                      style={itemTextColorStyle(
                                        colorForItem(row.item_id === '' ? null : row.item_id)
                                      )}
                                    >
                                      {row.itemtyp_cd}
                                    </span>
                                  </td>
                                )
                              case 'customer_cd':
                                return (
                                  <td key={col.key}>{row.customer_cd}</td>
                                )
                              default:
                                return <td key={col.key} />
                            }
                          })}
                        </tr>
                        )
                      })}
                    </tbody>
                  </ResizableGridTable>
                </div>
              </section>
                }
                process={
              selectedItem ? (
                <div className="erp-output-process-pane">
                <ProductionProcessInputPanels
                  embedded
                  processColumnsMode="location-only"
                  detail={detail}
                  loading={loading}
                  canEdit
                  autoSelectProcess="last"
                  items={items}
                  outputItemDatalistCatalog={outputItemDatalistCatalog}
                  inputItemDatalistCatalog={inputItemDatalistCatalog}
                  locations={locations}
                  processRows={processRows}
                  inputRows={inputRows}
                  onProcessRowsChange={setProcessRows}
                  onInputRowsChange={setInputRows}
                  rowError={saveFeedbackMessage}
                  lineGridId="item-process-lines-v1"
                  inputGridId="item-process-inputs-v1"
                  processEditGridId="item-process-process-edit-v3"
                  inputEditGridId="item-process-input-edit-v1"
                  onTreeHighlightChange={setTreeHighlight}
                  onTreeDataChange={handleTreeDataChange}
                  onGridLayoutsReady={handleProcessInputGridLayoutsReady}
                  itemProcessCache={itemProcessCache}
                  processInputSplit={{
                    processHeightRatio: panelSplit.layout.processHeightRatio,
                    onProcessHeightRatioChange: panelSplit.setProcessHeightRatio,
                  }}
                />
                </div>
              ) : (
                <p className="muted erp-grid-empty">Select an output item to edit item processes.</p>
              )
                }
              />
            </div>
          </div>
      </ProductionDetailSplit>
      )}
    </ErpScreen>
  )
}
