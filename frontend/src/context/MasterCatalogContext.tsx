import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../api/client'
import type { Item, Supplier } from '../types'
import type { MoveTyp } from '../types/inventory'
import type {
  CustomerMaster,
  ItemListRow,
  ItemTyp,
  LocationMaster,
  SupplierMaster,
} from '../types/masters'
import { clearMasterSuggestCaches } from '../utils/searchSuggest'
import { useAppViewRoute } from './AppNavigateContext'
import { useItemTypColors } from './ItemTypColorContext'

function itemsFromMasterRows(rows: ItemListRow[]): Item[] {
  return rows.map((row) => ({
    item_id: row.item_id,
    item_cd: row.item_cd,
    item_nm: row.item_nm,
    itemtyp_id: row.itemtyp_id,
  }))
}

function suppliersFromMasterRows(rows: SupplierMaster[]): Supplier[] {
  return rows.map((row) => ({
    suppliers_id: row.suppliers_id,
    suppliers_cd: row.suppliers_cd,
    suppliers_nm: row.suppliers_nm,
  }))
}

export type MasterCatalogSnapshot = {
  itemsMaster: ItemListRow[]
  suppliersMaster: SupplierMaster[]
  customers: CustomerMaster[]
  locations: LocationMaster[]
  itemtyps: ItemTyp[]
  movetyps: MoveTyp[]
}

export type MasterCatalogValue = MasterCatalogSnapshot & {
  ready: boolean
  refreshing: boolean
  /** Bumps after each successful catalog apply — remount native datalists. */
  revision: number
  items: Item[]
  suppliers: Supplier[]
  refresh: () => Promise<MasterCatalogSnapshot>
}

const MasterCatalogContext = createContext<MasterCatalogValue | null>(null)

function catalogSnapshotSignature(snapshot: MasterCatalogSnapshot): string {
  const lastItem = snapshot.itemsMaster[snapshot.itemsMaster.length - 1]
  return [
    snapshot.itemsMaster.length,
    lastItem?.item_id ?? 0,
    snapshot.suppliersMaster.length,
    snapshot.locations.length,
    snapshot.itemtyps.length,
    snapshot.movetyps.length,
  ].join(':')
}

async function fetchMasterCatalogSnapshot(): Promise<MasterCatalogSnapshot> {
  const [itemRows, supplierRows, customerRows, locationRows, typRows, moveRows] =
    await Promise.all([
      api.listItemsMaster(),
      api.listSuppliersMaster(),
      api.listCustomersMaster(),
      api.listLocationsMaster(),
      api.listItemtyps(),
      api.listMovetyps(),
    ])
  return {
    itemsMaster: itemRows,
    suppliersMaster: supplierRows,
    customers: customerRows,
    locations: locationRows,
    itemtyps: typRows,
    movetyps: moveRows,
  }
}

export function MasterCatalogProvider({ children }: { children: ReactNode }) {
  const { pathname } = useAppViewRoute()
  const { reload: reloadItemTypColors } = useItemTypColors()
  const [ready, setReady] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [revision, setRevision] = useState(0)
  const [itemsMaster, setItemsMaster] = useState<ItemListRow[]>([])
  const [suppliersMaster, setSuppliersMaster] = useState<SupplierMaster[]>([])
  const [customers, setCustomers] = useState<CustomerMaster[]>([])
  const [locations, setLocations] = useState<LocationMaster[]>([])
  const [itemtyps, setItemtyps] = useState<ItemTyp[]>([])
  const [movetyps, setMovetyps] = useState<MoveTyp[]>([])
  const refreshLockRef = useRef<Promise<MasterCatalogSnapshot> | null>(null)
  const pendingRefreshRef = useRef(false)
  const readyRef = useRef(false)
  const snapshotSigRef = useRef('')

  const applySnapshot = useCallback((snapshot: MasterCatalogSnapshot) => {
    const sig = catalogSnapshotSignature(snapshot)
    const changed = sig !== snapshotSigRef.current
    snapshotSigRef.current = sig
    setItemsMaster(snapshot.itemsMaster)
    setSuppliersMaster(snapshot.suppliersMaster)
    setCustomers(snapshot.customers)
    setLocations(snapshot.locations)
    setItemtyps(snapshot.itemtyps)
    setMovetyps(snapshot.movetyps)
    if (changed) {
      setRevision((prev) => prev + 1)
      clearMasterSuggestCaches()
    }
    readyRef.current = true
    setReady(true)
  }, [])

  const refresh = useCallback(async (): Promise<MasterCatalogSnapshot> => {
    if (refreshLockRef.current) {
      pendingRefreshRef.current = true
      return refreshLockRef.current
    }

    const promise = (async (): Promise<MasterCatalogSnapshot> => {
      setRefreshing(true)
      let lastSnapshot: MasterCatalogSnapshot | null = null
      try {
        do {
          pendingRefreshRef.current = false
          lastSnapshot = await fetchMasterCatalogSnapshot()
          applySnapshot(lastSnapshot)
          await reloadItemTypColors()
        } while (pendingRefreshRef.current)
        return lastSnapshot!
      } finally {
        setRefreshing(false)
        refreshLockRef.current = null
      }
    })()

    refreshLockRef.current = promise
    return promise
  }, [applySnapshot, reloadItemTypColors])

  useEffect(() => {
    void refresh().catch(() => {
      // ignore background refresh errors
    })
  }, [pathname, refresh])

  const items = useMemo(() => itemsFromMasterRows(itemsMaster), [itemsMaster])
  const suppliers = useMemo(() => suppliersFromMasterRows(suppliersMaster), [suppliersMaster])

  const value = useMemo<MasterCatalogValue>(
    () => ({
      ready,
      refreshing,
      revision,
      itemsMaster,
      items,
      suppliersMaster,
      suppliers,
      customers,
      locations,
      itemtyps,
      movetyps,
      refresh,
    }),
    [
      ready,
      refreshing,
      revision,
      itemsMaster,
      items,
      suppliersMaster,
      suppliers,
      customers,
      locations,
      itemtyps,
      movetyps,
      refresh,
    ]
  )

  return (
    <MasterCatalogContext.Provider value={value}>{children}</MasterCatalogContext.Provider>
  )
}

export function useMasterCatalog(): MasterCatalogValue {
  const ctx = useContext(MasterCatalogContext)
  if (!ctx) {
    throw new Error('useMasterCatalog must be used within MasterCatalogProvider')
  }
  return ctx
}

/** Call after saving a master so open tabs get fresh dropdown options without Reload. */
export function useRefreshMasterCatalogAfterSave(): () => Promise<void> {
  const { refresh } = useMasterCatalog()
  return useCallback(() => refresh().then(() => undefined), [refresh])
}
