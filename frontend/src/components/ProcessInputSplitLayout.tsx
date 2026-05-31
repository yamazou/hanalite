import { useRef, type ReactNode } from 'react'
import { useSplitDragHandler } from '../hooks/useSplitDrag'
import { SplitPaneResizeHandle } from './SplitPaneResizeHandle'

type Props = {
  processHeightRatio: number
  onProcessHeightRatioChange: (ratio: number) => void
  process: ReactNode
  input: ReactNode
}

export function ProcessInputSplitLayout({
  processHeightRatio,
  onProcessHeightRatioChange,
  process,
  input,
}: Props) {
  const splitRef = useRef<HTMLDivElement>(null)
  const onResize = useSplitDragHandler({
    containerRef: splitRef,
    axis: 'vertical',
    ratio: processHeightRatio,
    onRatioChange: onProcessHeightRatioChange,
    minFirstPx: 80,
    minSecondPx: 80,
  })

  return (
    <div ref={splitRef} className="erp-production-process-input-split">
      <div
        className="erp-split-pane-first"
        style={{ flex: `${processHeightRatio} 1 0`, minHeight: 0 }}
      >
        {process}
      </div>
      <SplitPaneResizeHandle axis="vertical" onPointerDown={onResize} />
      <div
        className="erp-split-pane-second"
        style={{ flex: `${1 - processHeightRatio} 1 0`, minHeight: 0 }}
      >
        {input}
      </div>
    </div>
  )
}
