import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { BomTreePanel } from '../../components/BomTreePanel'
import { ProductionDetailSplit } from '../../components/ProductionDetailSplit'
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
import { changedActiveRows, deleteSelectedConfirm, savedCountMessage } from '../../utils/gridRowChange'
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
  const [pageLoading, setPageLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [treeTitle, setTreeTitle] = useState<string | null>(null)
  const [treeLines, setTreeLines] = useState<BomTreeLine[]>([])
  const [outputItemFilter, setOutputItemFilter] = useState<OutputItemTypFilter>('FG')
  const [treeOnSelect, setTreeOnSelect] = useState(true)
  const [treeHighlight, setTreeHighlight] = useState<ProcessTreeHighlight | null>(null)
  const [itemProcessCache, setItemProcessCache] = useState<Map<number, ItemProcessesOut>>(
    () => new Map()
  )
  const deleteOutputRowsRef = useRef<() => void>(() => {})

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

  const finalItemGrid = useExcelLikeGrid({
    columns: itemProcessFinalItemColumns,
    rows: finalItemDataRows,
    getFilterValue: finalItemFilterValue,
    rowDelete: {
      label: 'Delete row',
      getSelectedCount: () => selectedOutputItemKeys.size,
      onDelete: () => deleteOutputRowsRef.current(),
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

  const activateFinalItemRow = useCallback((row: EditFinalItemRow) => {
    setSelectedFinalItemKey(row.key)
  }, [])

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

  const ensureSavedFinalItemRow = useCallback(
    (item: ItemSearchRow) => {
      const catalogItem = items.find((row) => row.item_id === item.item_id)
      const fields = catalogItem
        ? finalItemFieldsFromCatalogItem(catalogItem, finalItemLookups)
        : {
            item_id: item.item_id,
            item_cd: item.item_cd,
            item_nm: item.item_nm,
            itemtyp_cd: '',
            customer_cd: '',
          }
      const stableKey = stableFinalItemKey(item.item_id)
      setFinalItemRows((rows) => {
        const active = rows.filter((row) => !isBlankFinalItemRow(row))
        const normalized = active.map((row) =>
          row.item_id === item.item_id ? { key: stableKey, ...fields } : row
        )
        const exists = normalized.some((row) => row.item_id === item.item_id)
        const next = exists
          ? normalized
          : [...normalized, { key: stableKey, ...fields }]
        return ensureTrailingBlankRow(next, isBlankFinalItemRow, emptyEditFinalItemRow)
      })
      setSelectedFinalItemKey(stableKey)
    },
    [items, finalItemLookups]
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

  const loadedProcessItemIdRef = useRef<number | null>(null)

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
    setProcessRows([])
    setInputRows([])
    loadedProcessItemIdRef.current = selectedItem.item_id
    void loadProcesses(selectedItem.item_id)
  }, [selectedItem?.item_id, loadProcesses])

  const handleReload = useCallback(async () => {
    const selectId = selectedItem?.item_id
    setRefreshing(true)
    setError(null)
    setSuccess(null)
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
    const activeFinalRows = finalItemRows.filter(isActiveFinalItemRow)
    const seenItemIds = new Set<number>()
    for (const row of activeFinalRows) {
      const itemId = Number(row.item_id)
      if (seenItemIds.has(itemId)) {
        setRowError('final_item_duplicate')
        return
      }
      seenItemIds.add(itemId)
    }

    const changedOutputRows = changedActiveRows(
      finalItemRows,
      savedFinalItemSnapshots,
      isActiveFinalItemRow,
      (row) => (row.item_id !== '' ? Number(row.item_id) : undefined),
      finalItemRowSnapshot
    )

    const selectedId = selectedItem?.item_id ?? null
    const processDirty =
      selectedId != null &&
      isItemProcessEditDirty(selectedId, processRows, inputRows, savedProcessSnapshots)

    if (!processDirty && changedOutputRows.length === 0) {
      setRowError(null)
      setSuccess(savedCountMessage(0, 'item process'))
      return
    }

    if (selectedId == null) {
      setRowError(null)
      setSuccess(savedCountMessage(0, 'item process'))
      return
    }

    if (!processDirty) {
      setRowError(null)
      setSuccess(savedCountMessage(0, 'item process'))
      return
    }

    const payload = editRowsToItemProcessesSave(processRows, inputRows, selectedId)
    if (payload.processes.length === 0) {
      setRowError('process_validation')
      setSuccess(null)
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    setRowError(null)
    try {
      const saved = await api.saveItemProcesses(selectedId, payload)
      applyProcessesToGrids(saved, selectedId)
      setItemProcessCache((prev) => {
        const next = new Map(prev)
        next.set(saved.item_id, saved)
        return next
      })
      ensureSavedFinalItemRow(selectedItem!)
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
      loadedProcessItemIdRef.current = selectedId
      setSuccess(savedCountMessage(1, 'item process'))
      refreshMasterCatalog()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save item processes')
    } finally {
      setSubmitting(false)
    }
  }

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
  deleteOutputRowsRef.current = () => void deleteSelectedOutputItems()

  const saveErrorMessage = (() => {
    if (!rowError) return null
    if (rowError === 'final_item_duplicate') {
      return 'This item is already listed in Output Item.'
    }
    if (rowError === 'process_validation') {
      return 'Enter at least one process location before saving.'
    }
    return rowError
  })()

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
              <section className="erp-production-detail-section" data-production-grid="final-item">
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
                      submitting={submitting || refreshing}
                      rowError={saveErrorMessage}
                      statusMessage={success}
                      selectedCount={selectedOutputCount}
                      onSave={() => void handleSave()}
                      onDelete={() => void deleteSelectedOutputItems()}
                    />
                  </div>
                </div>
                <div className="erp-grid-wrap erp-grid-wrap-detail">
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

              {selectedItem ? (
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
                  rowError={rowError}
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
              ) : (
                <p className="muted erp-grid-empty">Select an output item to edit item processes.</p>
              )}
            </div>
          </div>
      </ProductionDetailSplit>
      )}
    </ErpScreen>
  )
}
