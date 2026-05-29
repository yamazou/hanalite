import type { CSSProperties, ReactNode } from 'react'
import { useItemTypColorsOptional, type ItemColorRef } from '../context/ItemTypColorContext'
import { itemTextColorStyle } from '../utils/itemTypColor'

type ColoredItemTextProps = ItemColorRef & {
  children: ReactNode
  title?: string
  className?: string
}

function resolveColor(
  ctx: ReturnType<typeof useItemTypColorsOptional>,
  ref: ItemColorRef
): string | undefined {
  if (!ctx) return undefined
  return ctx.colorForItemRef(ref)
}

export function ColoredItemCode({
  itemtypId,
  itemId,
  itemCd,
  children,
  title,
  className,
}: ColoredItemTextProps) {
  const ctx = useItemTypColorsOptional()
  const style = itemTextColorStyle(resolveColor(ctx, { itemtypId, itemId, itemCd }))
  return (
    <span className={className ?? 'erp-colored-item-cd'} style={style} title={title}>
      {children}
    </span>
  )
}

export function ColoredItemName({
  itemtypId,
  itemId,
  itemCd,
  children,
  title,
  className,
}: ColoredItemTextProps) {
  const ctx = useItemTypColorsOptional()
  const style = itemTextColorStyle(resolveColor(ctx, { itemtypId, itemId, itemCd }))
  return (
    <span className={className ?? 'erp-colored-item-nm'} style={style} title={title}>
      {children}
    </span>
  )
}

export function useColoredItemStyle(ref: ItemColorRef): CSSProperties | undefined {
  const ctx = useItemTypColorsOptional()
  return itemTextColorStyle(resolveColor(ctx, ref))
}
