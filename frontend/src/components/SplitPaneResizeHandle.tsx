import type { PointerEvent as ReactPointerEvent } from 'react'
import type { SplitDragAxis } from '../hooks/useSplitDrag'

type Props = {
  axis: SplitDragAxis
  onPointerDown: (event: ReactPointerEvent) => void
}

export function SplitPaneResizeHandle({ axis, onPointerDown }: Props) {
  const orientation = axis === 'horizontal' ? 'col' : 'row'
  return (
    <div
      className={`erp-split-handle erp-split-handle-${orientation}`}
      role="separator"
      aria-orientation={orientation}
      onPointerDown={onPointerDown}
    />
  )
}
