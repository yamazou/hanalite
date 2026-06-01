import { useRef, type ReactNode } from 'react'
import { useSplitDragHandler } from '../hooks/useSplitDrag'
import { SplitPaneResizeHandle } from './SplitPaneResizeHandle'

type Props = {
  hasTree: boolean
  treeWidthRatio: number
  onTreeWidthRatioChange: (ratio: number) => void
  /** Match tree column height to the left Process pane (0–1 of this split height). */
  treeHeightRatio?: number
  /** Offset tree column top to align with Process when content sits below another pane (e.g. Output Item). */
  treeTopOffsetRatio?: number
  tree: ReactNode
  children: ReactNode
  className?: string
}

export function ProductionDetailSplit({
  hasTree,
  treeWidthRatio,
  onTreeWidthRatioChange,
  treeHeightRatio,
  treeTopOffsetRatio,
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
            className={[
              'erp-production-detail-tree',
              treeHeightRatio != null ? 'erp-production-detail-tree-process-aligned' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label="Process tree"
            style={{
              flex: `${treeWidthRatio} 1 0`,
              minWidth: 280,
              minHeight: 0,
              ...(treeTopOffsetRatio != null && treeTopOffsetRatio > 0
                ? { marginTop: `${treeTopOffsetRatio * 100}%` }
                : {}),
              ...(treeHeightRatio != null
                ? {
                    alignSelf: 'flex-start',
                    height: `${treeHeightRatio * 100}%`,
                    maxHeight: `${treeHeightRatio * 100}%`,
                  }
                : {}),
            }}
          >
            {tree}
          </aside>
        </>
      ) : null}
    </div>
  )
}
