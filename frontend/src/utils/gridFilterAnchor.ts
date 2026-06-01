export type GridFilterAnchorRect = Pick<
  DOMRect,
  'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'
>

export function readAnchorRect(el: Element): GridFilterAnchorRect {
  const rect = el.getBoundingClientRect()
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  }
}

/** Grid container for scoping filter-button lookup (avoids wrong grid / hidden tab). */
export function resolveFilterGridRoot(anchor: HTMLElement): Element | null {
  return (
    anchor.closest('.erp-grid-wrap') ??
    anchor.closest('section[data-production-grid]') ??
    anchor.closest('table.erp-grid')?.parentElement ??
    null
  )
}

export function isValidFilterAnchorRect(rect: GridFilterAnchorRect): boolean {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.left)
  )
}

export function isInVisibleTabPanel(el: Element): boolean {
  const panel = el.closest('.main-tab-panel')
  if (!panel) return true
  return !panel.hasAttribute('hidden')
}

/** Resolve the filter button within the grid section that opened the menu. */
export function resolveFilterAnchorButton(
  filterColumnKey: string | null | undefined,
  fallbackAnchor: HTMLElement | null,
  gridRoot: Element | null
): HTMLElement | null {
  if (fallbackAnchor?.isConnected && isInVisibleTabPanel(fallbackAnchor)) {
    const rect = readAnchorRect(fallbackAnchor)
    if (isValidFilterAnchorRect(rect)) {
      return fallbackAnchor
    }
  }

  if (gridRoot?.isConnected && filterColumnKey && isInVisibleTabPanel(gridRoot)) {
    const btn = gridRoot.querySelector<HTMLElement>(
      `.erp-th-filter-btn[data-filter-col="${filterColumnKey}"]`
    )
    if (btn) {
      const rect = readAnchorRect(btn)
      if (isValidFilterAnchorRect(rect)) {
        return btn
      }
    }
  }

  return null
}

export function getScrollableAncestors(el: Element | null): Element[] {
  const result: Element[] = []
  let node = el?.parentElement ?? null
  while (node && node !== document.documentElement) {
    const style = getComputedStyle(node)
    if (/(auto|scroll|overlay)/.test(style.overflowY + style.overflowX)) {
      result.push(node)
    }
    node = node.parentElement
  }
  return result
}

export function computeFilterMenuStyle(anchorRect: GridFilterAnchorRect): {
  left: number
  top: number
  width: number
  maxHeight: number
} {
  const width = 260
  const preferredMaxHeight = 300
  const minMenuHeight = 120
  const minUsableHeight = 80

  let left = anchorRect.left
  if (left + width > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - width - 8)
  }

  const belowTop = anchorRect.bottom + 2
  const spaceBelow = window.innerHeight - 8 - belowTop
  const spaceAbove = anchorRect.top - 10

  let top: number
  let maxHeight: number

  const openBelow = () => {
    top = belowTop
    maxHeight = Math.min(preferredMaxHeight, spaceBelow)
    if (maxHeight < minUsableHeight) {
      maxHeight = Math.max(minUsableHeight, spaceBelow)
    }
    if (top + maxHeight > window.innerHeight - 8) {
      maxHeight = Math.max(minUsableHeight, window.innerHeight - 8 - top)
    }
  }

  const openAbove = () => {
    maxHeight = Math.min(preferredMaxHeight, spaceAbove)
    if (maxHeight < minUsableHeight) {
      maxHeight = Math.max(minUsableHeight, spaceAbove)
    }
    top = Math.max(8, anchorRect.top - maxHeight - 2)
  }

  if (spaceBelow >= minMenuHeight) {
    openBelow()
  } else if (spaceAbove >= minMenuHeight) {
    openAbove()
  } else if (spaceBelow >= spaceAbove) {
    openBelow()
  } else {
    openAbove()
  }

  return { left, top, width, maxHeight }
}
