export type GridFilterAnchorRect = Pick<
  DOMRect,
  'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'
>

export type FilterMenuPointerAtOpen = {
  clientX: number
  clientY: number
}

const FILTER_BTN_APPROX_HEIGHT = 22
const FILTER_BTN_APPROX_WIDTH = 24

/** Rect from the pointer event at filter open (stable when sticky skews button getBoundingClientRect). */
export function clientPointerAnchorRect(
  pointer: FilterMenuPointerAtOpen
): GridFilterAnchorRect {
  const { clientX, clientY } = pointer
  return {
    left: clientX - FILTER_BTN_APPROX_WIDTH / 2,
    top: clientY - FILTER_BTN_APPROX_HEIGHT,
    right: clientX + FILTER_BTN_APPROX_WIDTH / 2,
    bottom: clientY,
    width: FILTER_BTN_APPROX_WIDTH,
    height: FILTER_BTN_APPROX_HEIGHT,
  }
}

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

/** Frozen placement rect at filter open (▼ button rect at click — never re-read DOM). */
export function resolveFilterMenuPlacementRect(
  anchorRectAtOpen: GridFilterAnchorRect | null,
  _pointerAtOpen?: FilterMenuPointerAtOpen | null
): GridFilterAnchorRect | null {
  if (anchorRectAtOpen && isValidFilterAnchorRect(anchorRectAtOpen)) {
    return anchorRectAtOpen
  }
  return null
}

/**
 * Place menu at frozen anchor: maximize visible filter rows, keep OK/Cancel inside viewport.
 * Opens upward only when anchor is in the lower screen and space below is tight.
 */
export function computeFilterMenuOpenBelowAnchor(
  anchorRect: GridFilterAnchorRect
): FilterMenuComputedStyle {
  const width = 260
  const chromeHeight = FILTER_MENU_CHROME_HEIGHT
  const margin = 8
  const gap = 2
  const vv = window.visualViewport
  const viewportTop = (vv?.offsetTop ?? 0) + margin
  const viewportBottom =
    (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight) - margin
  const viewportHeight = viewportBottom - viewportTop

  let left = anchorRect.left
  const viewportWidth = vv?.width ?? window.innerWidth
  if (left + width > viewportWidth - margin) {
    left = Math.max(margin, viewportWidth - width - margin)
  }

  const belowTop = anchorRect.bottom + gap
  const spaceBelow = Math.max(0, viewportBottom - belowTop)
  const spaceAbove = Math.max(0, anchorRect.top - gap - viewportTop)
  const anchorInLowerHalf = anchorRect.bottom > viewportTop + viewportHeight * 0.48
  const needFlipAbove =
    anchorInLowerHalf &&
    spaceBelow < chromeHeight + FILTER_MENU_MIN_LIST_HEIGHT &&
    spaceAbove > spaceBelow

  let top: number
  let listMaxHeight: number

  if (needFlipAbove) {
    listMaxHeight = Math.min(
      FILTER_MENU_LIST_MAX_HEIGHT,
      Math.max(FILTER_MENU_MIN_LIST_HEIGHT, spaceAbove - chromeHeight)
    )
    top = anchorRect.top - gap - listMaxHeight - chromeHeight
    if (top < viewportTop) {
      top = viewportTop
      listMaxHeight = Math.max(
        FILTER_MENU_MIN_LIST_HEIGHT,
        anchorRect.top - gap - viewportTop - chromeHeight
      )
    }
  } else {
    top = belowTop
    listMaxHeight = Math.min(
      FILTER_MENU_LIST_MAX_HEIGHT,
      Math.max(FILTER_MENU_MIN_LIST_HEIGHT, spaceBelow - chromeHeight)
    )
  }

  if (top + chromeHeight + listMaxHeight > viewportBottom) {
    listMaxHeight = Math.max(
      FILTER_MENU_MIN_LIST_HEIGHT,
      viewportBottom - top - chromeHeight
    )
  }

  return {
    left,
    top,
    width,
    listMaxHeight,
    position: 'fixed',
  }
}

/** @deprecated Use resolveFilterMenuPlacementRect for menu positioning. */
export function resolveFilterMenuAnchorRect(
  anchorEl: HTMLElement | null,
  anchorRectAtOpen: GridFilterAnchorRect | null,
  pointerAtOpen?: FilterMenuPointerAtOpen | null
): GridFilterAnchorRect | null {
  const frozen = resolveFilterMenuPlacementRect(anchorRectAtOpen, pointerAtOpen)
  if (frozen) return frozen

  if (anchorEl?.isConnected) {
    const live = readAnchorRect(anchorEl)
    if (isValidFilterAnchorRect(live)) return live
  }
  return null
}

export type FilterMenuComputedStyle = {
  left: number
  top: number
  width: number
  listMaxHeight: number
  position: 'fixed' | 'absolute'
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

/** Max scrollable list height when viewport allows. */
export const FILTER_MENU_LIST_MAX_HEIGHT = 360

/** Search + footer + borders (list scrolls in the remainder). */
export const FILTER_MENU_CHROME_HEIGHT = 86

const FILTER_MENU_MIN_LIST_HEIGHT = 72

/** Map a viewport menu position into a scrollable grid-wrap (position: absolute). */
export function computeFilterMenuStyleInGridRoot(
  anchorViewportRect: GridFilterAnchorRect,
  gridRoot: Element
): FilterMenuComputedStyle {
  const viewport = computeFilterMenuStyle(anchorViewportRect)
  const rootRect = gridRoot.getBoundingClientRect()
  const scrollLeft = gridRoot.scrollLeft
  const scrollTop = gridRoot.scrollTop
  return {
    ...viewport,
    position: 'absolute',
    left: viewport.left - rootRect.left + scrollLeft,
    top: viewport.top - rootRect.top + scrollTop,
  }
}

export function computeFilterMenuStyle(anchorRect: GridFilterAnchorRect): FilterMenuComputedStyle {
  const width = 260
  const chromeHeight = FILTER_MENU_CHROME_HEIGHT
  const margin = 8
  const gap = 2
  const viewportBottom = window.innerHeight - margin
  const viewportTop = margin

  let left = anchorRect.left
  if (left + width > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - width - margin)
  }

  const fitListInSpace = (available: number) =>
    Math.max(
      FILTER_MENU_MIN_LIST_HEIGHT,
      Math.min(FILTER_MENU_LIST_MAX_HEIGHT, available - chromeHeight)
    )

  const belowTop = anchorRect.bottom + gap
  const spaceBelow = viewportBottom - belowTop
  const spaceAbove = anchorRect.top - gap - viewportTop
  const anchorMidY = (anchorRect.top + anchorRect.bottom) / 2
  const preferBelow = spaceBelow >= FILTER_MENU_MIN_LIST_HEIGHT + chromeHeight

  let top: number
  let listMaxHeight: number

  if (preferBelow) {
    top = belowTop
    listMaxHeight = fitListInSpace(spaceBelow)
    const menuHeight = listMaxHeight + chromeHeight
    if (top + menuHeight > viewportBottom) {
      listMaxHeight = fitListInSpace(viewportBottom - top)
    }
  } else {
    listMaxHeight = fitListInSpace(anchorRect.top - gap - viewportTop)
    let menuHeight = listMaxHeight + chromeHeight
    top = anchorRect.top - gap - menuHeight
    if (top < viewportTop) {
      listMaxHeight = fitListInSpace(anchorRect.top - gap - viewportTop)
      menuHeight = listMaxHeight + chromeHeight
      top = anchorRect.top - gap - menuHeight
      if (top < viewportTop) {
        top = viewportTop
        listMaxHeight = fitListInSpace(anchorRect.top - gap - top)
      }
    }
  }

  return { left, top, width, listMaxHeight, position: 'fixed' }
}
