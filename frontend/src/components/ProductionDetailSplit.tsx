import { useRef, type ReactNode } from 'react'
import { useSplitDragHandler } from '../hooks/useSplitDrag'
import { SplitPaneResizeHandle } from './SplitPaneResizeHandle'

type Props = {
  hasTree: boolean
  treeWidthRatio: number
  onTreeWidthRatioChange: (ratio: number) => void
  tree: ReactNode
  children: ReactNode
  className?: string
}

export function ProductionDetailSplit({
  hasTree,
  treeWidthRatio,
  onTreeWidthRatioChange,
  tree,
  children,
  className,
}: Props) {
  const splitRef = useRef<HTMLDivElement>(null)
  const mainRatio = 1 - treeWidthRatio
  const onTreeResize = useSplitDragHandler({
    containerRef: splitRef,
    axis: 'horizontal',
    ratio: mainRatio,
    onRatioChange: (nextMainRatio) => onTreeWidthRatioChange(1 - nextMainRatio),
    minFirstPx: 200,
    minSecondPx: 280,
    invertDelta: true,
  })

  return (
    <div
      ref={splitRef}
      className={[
        'erp-production-detail-split',
        hasTree ? 'has-tree erp-production-detail-split-resizable' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className="erp-production-detail-main"
        style={hasTree ? { flex: `${mainRatio} 1 0`, minWidth: 0, minHeight: 0 } : undefined}
      >
        {children}
      </div>
      {hasTree ? (
        <>
          <SplitPaneResizeHandle axis="horizontal" onPointerDown={onTreeResize} />
          <aside
            className="erp-production-detail-tree"
            aria-label="BOM tree"
            style={{ flex: `${treeWidthRatio} 1 0`, minWidth: 280, minHeight: 0 }}
          >
            {tree}
          </aside>
        </>
      ) : null}
    </div>
  )
}
