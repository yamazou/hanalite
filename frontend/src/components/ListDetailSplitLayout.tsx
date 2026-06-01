import { useRef, type ReactNode } from 'react'
import { useSplitDragHandler } from '../hooks/useSplitDrag'
import { SplitPaneResizeHandle } from './SplitPaneResizeHandle'

type Props = {
  listHeightRatio: number
  onListHeightRatioChange: (ratio: number) => void
  list: ReactNode
  detail: ReactNode
}

export function ListDetailSplitLayout({
  listHeightRatio,
  onListHeightRatioChange,
  list,
  detail,
}: Props) {
  const splitRef = useRef<HTMLDivElement>(null)
  const onResize = useSplitDragHandler({
    containerRef: splitRef,
    axis: 'vertical',
    ratio: listHeightRatio,
    onRatioChange: onListHeightRatioChange,
    minFirstPx: 120,
    minSecondPx: 220,
  })

  return (
    <div ref={splitRef} className="erp-list-detail-split erp-list-detail-split-resizable">
      <div
        className="erp-split-pane-first"
        style={{ flex: `${listHeightRatio} 1 0`, minHeight: 0 }}
      >
        {list}
      </div>
      <SplitPaneResizeHandle axis="vertical" onPointerDown={onResize} />
      <div
        className="erp-split-pane-second"
        style={{ flex: `${1 - listHeightRatio} 1 0`, minHeight: 0 }}
      >
        {detail}
      </div>
    </div>
  )
}
