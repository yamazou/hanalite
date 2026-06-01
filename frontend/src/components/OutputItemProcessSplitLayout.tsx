import { useRef, type ReactNode } from 'react'
import { useSplitDragHandler } from '../hooks/useSplitDrag'
import { SplitPaneResizeHandle } from './SplitPaneResizeHandle'

type Props = {
  outputItemHeightRatio: number
  onOutputItemHeightRatioChange: (ratio: number) => void
  outputItem: ReactNode
  process: ReactNode
}

export function OutputItemProcessSplitLayout({
  outputItemHeightRatio,
  onOutputItemHeightRatioChange,
  outputItem,
  process,
}: Props) {
  const splitRef = useRef<HTMLDivElement>(null)
  const onResize = useSplitDragHandler({
    containerRef: splitRef,
    axis: 'vertical',
    ratio: outputItemHeightRatio,
    onRatioChange: onOutputItemHeightRatioChange,
    minFirstPx: 80,
    minSecondPx: 120,
  })

  return (
    <div ref={splitRef} className="erp-production-output-process-split">
      <div
        className="erp-split-pane-first"
        style={{ flex: `${outputItemHeightRatio} 1 0`, minHeight: 0 }}
      >
        {outputItem}
      </div>
      <SplitPaneResizeHandle axis="vertical" onPointerDown={onResize} />
      <div
        className="erp-split-pane-second"
        style={{ flex: `${1 - outputItemHeightRatio} 1 0`, minHeight: 0 }}
      >
        {process}
      </div>
    </div>
  )
}
