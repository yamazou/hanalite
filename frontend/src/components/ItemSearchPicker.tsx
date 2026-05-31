import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import type { ItemSearchRow } from '../types/masters'
import { useMasterCatalog } from '../context/MasterCatalogContext'
import { findItemByCd } from '../utils/draftEdit'
import {
  allowedItemtypIds,
  filterItemListRowsByItemtypIds,
} from '../utils/itemTypDisplay'
import { GridItemDatalistField, type GridItemDatalistItem } from './GridItemDatalistField'

type ItemSearchPickerProps = {
  label: string
  value: ItemSearchRow | null
  onChange: (item: ItemSearchRow | null) => void
  required?: boolean
  showInlineClear?: boolean
  hideLabel?: boolean
  fieldClassName?: string
  disabled?: boolean
  /** When set, datalist shows only items with these Item Type codes. */
  allowedItemtypCds?: readonly string[]
}

function toSearchRow(
  row: GridItemDatalistItem & { itemtyp_id?: number; itemtyp_nm?: string }
): ItemSearchRow {
  return {
    item_id: row.item_id,
    item_cd: row.item_cd,
    item_nm: row.item_nm,
    itemtyp_id: row.itemtyp_id ?? 0,
    itemtyp_nm: row.itemtyp_nm ?? '',
  }
}

export function ItemSearchPicker({
  label,
  value,
  onChange,
  required,
  showInlineClear = true,
  hideLabel = false,
  fieldClassName,
  disabled = false,
  allowedItemtypCds,
}: ItemSearchPickerProps) {
  const { itemsMaster, itemtyps, ready } = useMasterCatalog()
  const listId = useId().replace(/:/g, '')
  const [query, setQuery] = useState('')

  const allowedIds = useMemo(
    () =>
      allowedItemtypCds != null && allowedItemtypCds.length > 0
        ? allowedItemtypIds(itemtyps, allowedItemtypCds)
        : null,
    [allowedItemtypCds, itemtyps]
  )

  const catalog = useMemo((): (GridItemDatalistItem & {
    itemtyp_id: number
    itemtyp_nm: string
  })[] => {
    if (!ready) return []
    const rows =
      allowedIds != null
        ? filterItemListRowsByItemtypIds(itemsMaster, allowedIds)
        : itemsMaster
    return rows.map((row) => ({
      item_id: row.item_id,
      item_cd: row.item_cd,
      item_nm: row.item_nm,
      itemtyp_id: row.itemtyp_id,
      itemtyp_nm: row.itemtyp_nm,
    }))
  }, [itemsMaster, ready, allowedIds])

  useEffect(() => {
    setQuery(value?.item_cd ?? '')
  }, [value])

  const commitQuery = useCallback(
    (text: string) => {
      setQuery(text)
      const match = findItemByCd(catalog, text)
      if (match) {
        const master = catalog.find((row) => row.item_id === match.item_id)
        onChange(toSearchRow(master ?? match))
        setQuery(match.item_cd)
        return
      }
      if (value && text !== value.item_cd) {
        onChange(null)
      }
    },
    [catalog, onChange, value]
  )

  const clear = () => {
    onChange(null)
    setQuery('')
  }

  const input = (
    <GridItemDatalistField
      mode="cd"
      items={catalog}
      listId={listId}
      value={query}
      onChange={commitQuery}
      inputClassName="erp-input"
      placeholder={hideLabel ? label : 'Type to search by code or name'}
      ariaLabel={label}
      disabled={disabled}
    />
  )

  if (hideLabel) {
    return (
      <span className="item-search-picker item-search-picker-inline">
        {input}
        {showInlineClear && value && (
          <button type="button" className="btn erp-btn erp-btn-clear" onClick={clear}>
            Clear
          </button>
        )}
      </span>
    )
  }

  return (
    <label className={`full item-search-picker ${fieldClassName ?? ''}`}>
      {label}
      <div className="item-search-row">
        {input}
        {showInlineClear && value && (
          <button type="button" className="btn erp-btn erp-btn-clear" onClick={clear}>
            Clear
          </button>
        )}
      </div>
    </label>
  )
}
