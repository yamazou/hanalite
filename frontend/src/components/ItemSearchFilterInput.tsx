import { useId, useMemo } from 'react'
import { useMasterCatalog } from '../context/MasterCatalogContext'
import { GridItemDatalistField, type GridItemDatalistItem } from './GridItemDatalistField'

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel: string
  fieldClassName?: string
  variant?: 'field' | 'inline'
}

/** Item search filter: native datalist, code/name rows, substring match (Receipt Entry style). */
export function ItemSearchFilterInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  fieldClassName = 'erp-search-field-item',
  variant = 'field',
}: Props) {
  const { itemsMaster, ready } = useMasterCatalog()
  const listId = useId().replace(/:/g, '')

  const catalog = useMemo((): GridItemDatalistItem[] => {
    if (!ready) return []
    return itemsMaster.map((row) => ({
      item_id: row.item_id,
      item_cd: row.item_cd,
      item_nm: row.item_nm,
    }))
  }, [itemsMaster, ready])

  const input = (
    <GridItemDatalistField
      mode="any"
      items={catalog}
      listId={listId}
      value={value}
      onChange={onChange}
      inputClassName="erp-input"
      placeholder={placeholder}
      ariaLabel={ariaLabel}
    />
  )

  if (variant === 'inline') {
    return (
      <span className={`erp-suggest-field erp-suggest-inline ${fieldClassName}`}>{input}</span>
    )
  }

  return (
    <label className={`erp-search-field erp-suggest-field ${fieldClassName}`}>{input}</label>
  )
}
