import type { KeyboardEvent, ReactNode } from 'react'
import { ColoredItemCode, ColoredItemName } from './ColoredItemText'
import { GridItemDatalistField, GridItemResolvedInput } from './GridItemDatalistField'
import type { GridItemDatalistItem } from './GridItemDatalistField'
import { gridCellPlaceholder, showItemMasterDatalist } from '../utils/gridPlaceholder'
import { itemTextColorStyle } from '../utils/itemTypColor'
import {
  processParentItemCdFieldPatch,
  processParentItemNmFieldPatch,
  type EditProductionOrderHeaderRow,
} from '../utils/productionOrderListEdit'

type Props = {
  colKey: string
  row: EditProductionOrderHeaderRow
  isBlank: boolean
  parentItemCatalog: GridItemDatalistItem[]
  colorForItem: (itemId: number | null) => string | undefined
  itemReadOnly: boolean
  listIdPrefix: string
  onUpdate: (patch: Partial<EditProductionOrderHeaderRow>) => void
  onKeyDown?: (event: KeyboardEvent, row: EditProductionOrderHeaderRow) => void
}

export function ProductionOrderHeaderGridCell({
  colKey,
  row,
  isBlank,
  parentItemCatalog,
  colorForItem,
  itemReadOnly,
  listIdPrefix,
  onUpdate,
  onKeyDown,
}: Props): ReactNode {
  const itemStyle = itemTextColorStyle(
    colorForItem(row.parent_item_id === '' ? null : row.parent_item_id)
  )

  switch (colKey) {
    case 'production_date':
      return (
        <td key={colKey} className="erp-grid-cell-edit">
          <input
            type="date"
            className="erp-grid-input"
            value={row.production_date}
            aria-label="Planned Date"
            onChange={(e) => onUpdate({ production_date: e.target.value })}
            onKeyDown={onKeyDown ? (e) => onKeyDown(e, row) : undefined}
          />
        </td>
      )
    case 'reference_no':
      return (
        <td key={colKey} className="erp-grid-cell-edit">
          <input
            className="erp-grid-input"
            value={row.reference_no}
            placeholder={gridCellPlaceholder('Reference No.', isBlank)}
            aria-label="Reference No."
            onChange={(e) => onUpdate({ reference_no: e.target.value })}
            onKeyDown={onKeyDown ? (e) => onKeyDown(e, row) : undefined}
          />
        </td>
      )
    case 'item_cd':
      if (itemReadOnly) {
        return (
          <td key={colKey}>
            <ColoredItemCode itemId={row.parent_item_id === '' ? undefined : row.parent_item_id}>
              {row.parent_item_cd}
            </ColoredItemCode>
          </td>
        )
      }
      return (
        <td key={colKey} className="erp-grid-cell-edit">
          {showItemMasterDatalist(row.parent_item_id) ? (
            <GridItemDatalistField
              mode="cd"
              items={parentItemCatalog}
              listId={`${listIdPrefix}-item-cd-${row.key}`}
              value={row.parent_item_cd}
              placeholder={gridCellPlaceholder('Item Code', isBlank)}
              ariaLabel="Item Code"
              style={itemStyle}
              onChange={(value) =>
                onUpdate(processParentItemCdFieldPatch(parentItemCatalog, value))
              }
              onKeyDown={onKeyDown ? (e) => onKeyDown(e, row) : undefined}
            />
          ) : (
            <GridItemResolvedInput
              value={row.parent_item_cd}
              placeholder={gridCellPlaceholder('Item Code', isBlank)}
              style={itemStyle}
              onChange={(value) =>
                onUpdate(processParentItemCdFieldPatch(parentItemCatalog, value))
              }
              onKeyDown={onKeyDown ? (e) => onKeyDown(e, row) : undefined}
            />
          )}
        </td>
      )
    case 'item_nm':
      if (itemReadOnly) {
        return (
          <td key={colKey}>
            <ColoredItemName itemId={row.parent_item_id === '' ? undefined : row.parent_item_id}>
              {row.parent_item_nm}
            </ColoredItemName>
          </td>
        )
      }
      return (
        <td key={colKey} className="erp-grid-cell-edit">
          {showItemMasterDatalist(row.parent_item_id) ? (
            <GridItemDatalistField
              mode="nm"
              items={parentItemCatalog}
              listId={`${listIdPrefix}-item-nm-${row.key}`}
              value={row.parent_item_nm}
              placeholder={gridCellPlaceholder('Item Name', isBlank)}
              ariaLabel="Item Name"
              style={itemStyle}
              onChange={(value) =>
                onUpdate(processParentItemNmFieldPatch(parentItemCatalog, value))
              }
              onKeyDown={onKeyDown ? (e) => onKeyDown(e, row) : undefined}
            />
          ) : (
            <GridItemResolvedInput
              value={row.parent_item_nm}
              placeholder={gridCellPlaceholder('Item Name', isBlank)}
              style={itemStyle}
              onChange={(value) =>
                onUpdate(processParentItemNmFieldPatch(parentItemCatalog, value))
              }
              onKeyDown={onKeyDown ? (e) => onKeyDown(e, row) : undefined}
            />
          )}
        </td>
      )
    case 'lot':
      return (
        <td key={colKey} className="erp-grid-cell-edit">
          <input
            className="erp-grid-input"
            value={row.lot}
            placeholder={gridCellPlaceholder('Lot', isBlank)}
            aria-label="Lot"
            onChange={(e) => onUpdate({ lot: e.target.value })}
            onKeyDown={onKeyDown ? (e) => onKeyDown(e, row) : undefined}
          />
        </td>
      )
    case 'planned_qty':
      return (
        <td key={colKey} className="erp-grid-cell-edit erp-col-num">
          <input
            className="erp-grid-input"
            value={row.planned_qty}
            placeholder={gridCellPlaceholder('Planned Qty', isBlank)}
            aria-label="Planned Qty"
            inputMode="decimal"
            onChange={(e) => onUpdate({ planned_qty: e.target.value })}
            onKeyDown={onKeyDown ? (e) => onKeyDown(e, row) : undefined}
          />
        </td>
      )
    default:
      return null
  }
}
