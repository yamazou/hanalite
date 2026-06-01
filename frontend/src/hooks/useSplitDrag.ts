import { useCallback, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

export type SplitDragAxis = 'horizontal' | 'vertical'

const SPLIT_HANDLE_PX = 1

export function clampSplitRatio(
  ratio: number,
  containerSize: number,
  minFirstPx: number,
  minSecondPx: number,
  handlePx = SPLIT_HANDLE_PX
): number {
  const available = containerSize - handlePx
  if (available <= 0) return ratio
  const minRatio = minFirstPx / available
  const maxRatio = (available - minSecondPx) / available
  return Math.min(maxRatio, Math.max(minRatio, ratio))
}

type Options = {
  containerRef: RefObject<HTMLElement | null>
  axis: SplitDragAxis
  ratio: number
  onRatioChange: (ratio: number) => void
  minFirstPx?: number
  minSecondPx?: number
  /** When true, drag right/down shrinks the first pane instead of growing it. */
  invertDelta?: boolean
}

export function useSplitDragHandler({
  containerRef,
  axis,
  ratio,
  onRatioChange,
  minFirstPx = 100,
  minSecondPx = 100,
  invertDelta = false,
}: Options) {
  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (event.button !== 0) return
      event.preventDefault()
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const startPos = axis === 'horizontal' ? event.clientX : event.clientY
      const startRatio = ratio
      const totalSize = axis === 'horizontal' ? rect.width : rect.height
      const bodyClass =
        axis === 'horizontal' ? 'erp-split-col-resizing' : 'erp-split-row-resizing'
      const deltaSign = invertDelta ? -1 : 1

      const onMove = (ev: PointerEvent) => {
        const pos = axis === 'horizontal' ? ev.clientX : ev.clientY
        const deltaRatio = ((pos - startPos) / totalSize) * deltaSign
        const next = clampSplitRatio(
          startRatio + deltaRatio,
          totalSize,
          minFirstPx,
          minSecondPx
        )
        onRatioChange(next)
      }

      const onUp = () => {
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
        document.body.classList.remove(bodyClass)
      }

      document.body.classList.add(bodyClass)
      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
    },
    [containerRef, axis, ratio, onRatioChange, minFirstPx, minSecondPx, invertDelta]
  )

  return onPointerDown
}
