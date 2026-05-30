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
  items: Item[]
  suppliers: Supplier[]
  refresh: () => Promise<MasterCatalogSnapshot>
}

const MasterCatalogContext = createContext<MasterCatalogValue | null>(null)

export function MasterCatalogProvider({ children }: { children: ReactNode }) {
  const { pathname } = useAppViewRoute()
  const { reload: reloadItemTypColors } = useItemTypColors()
  const [ready, setReady] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [itemsMaster, setItemsMaster] = useState<ItemListRow[]>([])
  const [suppliersMaster, setSuppliersMaster] = useState<SupplierMaster[]>([])
  const [customers, setCustomers] = useState<CustomerMaster[]>([])
  const [locations, setLocations] = useState<LocationMaster[]>([])
  const [itemtyps, setItemtyps] = useState<ItemTyp[]>([])
  const [movetyps, setMovetyps] = useState<MoveTyp[]>([])
  const inFlightRef = useRef<Promise<MasterCatalogSnapshot> | null>(null)
  const readyRef = useRef(false)

  const refresh = useCallback(async (): Promise<MasterCatalogSnapshot> => {
    if (inFlightRef.current) return inFlightRef.current
    const promise = (async (): Promise<MasterCatalogSnapshot> => {
      setRefreshing(true)
      try {
        const [itemRows, supplierRows, customerRows, locationRows, typRows, moveRows] =
          await Promise.all([
            api.listItemsMaster(),
            api.listSuppliersMaster(),
            api.listCustomersMaster(),
            api.listLocationsMaster(),
            api.listItemtyps(),
            api.listMovetyps(),
          ])
        setItemsMaster(itemRows)
        setSuppliersMaster(supplierRows)
        setCustomers(customerRows)
        setLocations(locationRows)
        setItemtyps(typRows)
        setMovetyps(moveRows)
        clearMasterSuggestCaches()
        await reloadItemTypColors()
        readyRef.current = true
        setReady(true)
        return {
          itemsMaster: itemRows,
          suppliersMaster: supplierRows,
          customers: customerRows,
          locations: locationRows,
          itemtyps: typRows,
          movetyps: moveRows,
        }
      } finally {
        setRefreshing(false)
      }
    })()
    inFlightRef.current = promise
    try {
      return await promise
    } finally {
      if (inFlightRef.current === promise) inFlightRef.current = null
    }
  }, [reloadItemTypColors])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!readyRef.current) return
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

/** Call after saving a master so open tabs get fresh dropdown options without Refresh. */
export function useRefreshMasterCatalogAfterSave(): () => void {
  const { refresh } = useMasterCatalog()
  return useCallback(() => {
    void refresh().catch(() => {})
  }, [refresh])
}
