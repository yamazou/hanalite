import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../api/client'
import { normalizeItemTypColor } from '../utils/itemTypColor'

export type ItemColorRef = {
  itemtypId?: number | null
  itemId?: number | null
  itemCd?: string | null
}

type ItemTypColorContextValue = {
  loading: boolean
  reload: () => Promise<void>
  colorForTyp: (itemtypId?: number | null) => string | undefined
  colorForItem: (itemId?: number | null) => string | undefined
  colorForItemCd: (itemCd?: string | null) => string | undefined
  colorForItemRef: (ref: ItemColorRef) => string | undefined
}

const ItemTypColorContext = createContext<ItemTypColorContextValue | null>(null)

export function ItemTypColorProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [typColors, setTypColors] = useState<Map<number, string>>(() => new Map())
  const [itemTypIds, setItemTypIds] = useState<Map<number, number>>(() => new Map())
  const [itemCdToTypId, setItemCdToTypId] = useState<Map<string, number>>(() => new Map())

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [typs, items] = await Promise.all([api.listItemtyps(), api.listItemsMaster()])
      const colors = new Map<number, string>()
      for (const t of typs) {
        const c = normalizeItemTypColor(t.itemtyp_color)
        if (c) colors.set(t.itemtyp_id, c)
      }
      const idMap = new Map<number, number>()
      const cdMap = new Map<string, number>()
      for (const item of items) {
        if (item.itemtyp_id != null) {
          idMap.set(item.item_id, item.itemtyp_id)
          if (item.item_cd?.trim()) {
            cdMap.set(item.item_cd.trim().toLowerCase(), item.itemtyp_id)
          }
        }
      }
      setTypColors(colors)
      setItemTypIds(idMap)
      setItemCdToTypId(cdMap)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const colorForTyp = useCallback(
    (itemtypId?: number | null) => {
      if (itemtypId == null) return undefined
      return typColors.get(Number(itemtypId))
    },
    [typColors]
  )

  const colorForItem = useCallback(
    (itemId?: number | null) => {
      if (itemId == null) return undefined
      const typId = itemTypIds.get(itemId)
      return typId != null ? typColors.get(typId) : undefined
    },
    [itemTypIds, typColors]
  )

  const colorForItemCd = useCallback(
    (itemCd?: string | null) => {
      const key = itemCd?.trim().toLowerCase()
      if (!key) return undefined
      const typId = itemCdToTypId.get(key)
      return typId != null ? typColors.get(typId) : undefined
    },
    [itemCdToTypId, typColors]
  )

  const colorForItemRef = useCallback(
    (ref: ItemColorRef) => {
      const byTyp = colorForTyp(ref.itemtypId)
      if (byTyp) return byTyp
      const byId = colorForItem(ref.itemId)
      if (byId) return byId
      return colorForItemCd(ref.itemCd)
    },
    [colorForTyp, colorForItem, colorForItemCd]
  )

  const value = useMemo(
    () => ({ loading, reload, colorForTyp, colorForItem, colorForItemCd, colorForItemRef }),
    [loading, reload, colorForTyp, colorForItem, colorForItemCd, colorForItemRef]
  )

  return (
    <ItemTypColorContext.Provider value={value}>{children}</ItemTypColorContext.Provider>
  )
}

export function useItemTypColors(): ItemTypColorContextValue {
  const ctx = useContext(ItemTypColorContext)
  if (!ctx) {
    throw new Error('useItemTypColors must be used within ItemTypColorProvider')
  }
  return ctx
}

/** Safe when provider is absent (e.g. tests). */
export function useItemTypColorsOptional(): ItemTypColorContextValue | null {
  return useContext(ItemTypColorContext)
}
