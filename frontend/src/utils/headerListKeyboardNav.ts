export type HeaderListNavEntry =
  | { type: 'saved'; id: number }
  | { type: 'new'; key: string }

export function buildHeaderListNavEntries<TNew extends { key: string }>(
  savedIds: number[],
  newRows: TNew[],
  isBlankNewRow: (row: TNew) => boolean
): HeaderListNavEntry[] {
  const entries: HeaderListNavEntry[] = savedIds.map((id) => ({ type: 'saved', id }))
  for (const row of newRows) {
    if (!isBlankNewRow(row)) {
      entries.push({ type: 'new', key: row.key })
    }
  }
  return entries
}

export function findHeaderListNavIndex(
  entries: HeaderListNavEntry[],
  opts: {
    savedId: number | null
    previewKey: string | null
    savedKeyPrefix: string
  }
): number {
  if (opts.previewKey) {
    if (opts.previewKey.startsWith(opts.savedKeyPrefix)) {
      const id = Number(opts.previewKey.slice(opts.savedKeyPrefix.length))
      if (!Number.isNaN(id)) {
        const i = entries.findIndex((e) => e.type === 'saved' && e.id === id)
        if (i >= 0) return i
      }
    }
    const fromNew = entries.findIndex(
      (e) => e.type === 'new' && e.key === opts.previewKey
    )
    if (fromNew >= 0) return fromNew
  }
  if (opts.savedId != null) {
    return entries.findIndex((e) => e.type === 'saved' && e.id === opts.savedId)
  }
  return -1
}

export function stepHeaderListNavIndex(
  index: number,
  delta: number,
  length: number
): number {
  if (length === 0) return -1
  if (index < 0) return delta > 0 ? 0 : length - 1
  return Math.max(0, Math.min(length - 1, index + delta))
}

export function isHeaderListArrowKey(key: string): boolean {
  return key === 'ArrowDown' || key === 'ArrowUp'
}

/** Ignore arrow navigation while typing in list search / status toolbar. */
export function shouldIgnoreHeaderListArrowKey(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true
  if (target.closest('.erp-search-body, .erp-search-filters, .erp-toolbar')) {
    return true
  }
  return false
}

const GRID_CELL_INPUT_SELECTOR = 'input, select, textarea'

export const HEADER_GRID_WRAP_SELECTOR =
  '.erp-panel-list-header .erp-grid-wrap-header, .erp-panel-orders-header .erp-grid-wrap-header'

function focusableGridCell(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null
  if (target.matches(GRID_CELL_INPUT_SELECTOR)) return target
  return target.closest(GRID_CELL_INPUT_SELECTOR)
}

function focusedElementInWrap(
  target: EventTarget | null,
  wrapSelector: string
): HTMLElement | null {
  const active =
    target instanceof HTMLElement
      ? target
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
  if (!active) return null
  const wrap = active.closest(wrapSelector)
  if (!(wrap instanceof HTMLElement)) return null
  if (!wrap.contains(active)) return null
  return active
}

/** Header list grid cell has focus (Receipt / Production Order header). */
export function isFocusInHeaderListGrid(target: EventTarget | null): boolean {
  const active = focusedElementInWrap(target, HEADER_GRID_WRAP_SELECTOR)
  if (!active) return false
  if (focusableGridCell(active)) return true
  return active.closest('tbody tr') != null
}

/** Receipt / Delivery detail line grid has focus. */
export function isFocusInReceiptDetailLineGrid(target: EventTarget | null): boolean {
  if (isFocusInHeaderListGrid(target)) return false
  const active = focusedElementInWrap(target, '.erp-detail-panel .erp-grid-wrap-detail')
  if (!active) return false
  return focusableGridCell(active) != null
}

/** Production Process grid has focus (editable cell or selected row). */
export function isFocusInProductionProcessGrid(target: EventTarget | null): boolean {
  if (isFocusInHeaderListGrid(target)) return false
  const active = focusedElementInWrap(
    target,
    '[data-production-grid="process"] .erp-grid-wrap-detail, [data-production-grid="process"] .erp-grid-wrap-static'
  )
  if (!active) return false
  if (focusableGridCell(active)) return true
  return active.closest('tbody tr') != null
}

/** Production Input Item grid has focus (editable cell or selected row). */
export function isFocusInProductionInputGrid(target: EventTarget | null): boolean {
  if (isFocusInHeaderListGrid(target)) return false
  const active = focusedElementInWrap(
    target,
    '[data-production-grid="input"] .erp-grid-wrap-detail, [data-production-grid="input"] .erp-grid-wrap-static'
  )
  if (!active) return false
  if (focusableGridCell(active)) return true
  return active.closest('tbody tr') != null
}

export const GRID_ROW_NAV_WRAP_ATTR = 'data-grid-row-nav-wrap'

export function gridRowNavWrapSelector(wrapId: string): string {
  return `[${GRID_ROW_NAV_WRAP_ATTR}="${wrapId}"]`
}

export function gridRowNavScrollConfig(wrapId: string): GridRowScrollConfig {
  return { scrollRootSelector: gridRowNavWrapSelector(wrapId) }
}

export function isFocusInGridRowNavWrap(
  target: EventTarget | null,
  wrapId: string
): boolean {
  const active = focusedElementInWrap(target, gridRowNavWrapSelector(wrapId))
  if (!active) return false
  if (focusableGridCell(active)) return true
  return active.closest('tbody tr') != null
}

export const GRID_ROW_NAV_KEY_ATTR = 'data-grid-nav-key'

export function gridRowKeyFromFocus(
  target: EventTarget | null,
  rowKeyAttr: string = GRID_ROW_NAV_KEY_ATTR
): string | null {
  if (!(target instanceof HTMLElement)) return null
  const row = target.closest(`tr[${rowKeyAttr}]`)
  if (!(row instanceof HTMLElement)) return null
  return row.getAttribute(rowKeyAttr)
}

export type HeaderListScrollConfig = {
  scrollRootSelector: string
  /** Attribute on saved header rows, e.g. data-receipt-draft-id */
  savedIdAttr: string
  /** Attribute on new header rows, e.g. data-header-new-key */
  newKeyAttr: string
}

export const RECEIPT_HEADER_LIST_SCROLL: HeaderListScrollConfig = {
  scrollRootSelector: '.erp-panel-list-header .erp-grid-wrap-header',
  savedIdAttr: 'data-receipt-draft-id',
  newKeyAttr: 'data-header-new-key',
}

export const PRODUCTION_HEADER_LIST_SCROLL: HeaderListScrollConfig = {
  scrollRootSelector: '.erp-panel-orders-header .erp-grid-wrap-header',
  savedIdAttr: 'data-production-order-id',
  newKeyAttr: 'data-header-new-key',
}

function findHeaderListNavRowElement(
  root: HTMLElement,
  entry: HeaderListNavEntry,
  config: HeaderListScrollConfig
): HTMLElement | null {
  if (entry.type === 'saved') {
    const el = root.querySelector(`[${config.savedIdAttr}="${entry.id}"]`)
    return el instanceof HTMLElement ? el : null
  }
  const el = root.querySelector(`[${config.newKeyAttr}="${entry.key}"]`)
  return el instanceof HTMLElement ? el : null
}

export function scrollHeaderListRowIntoView(
  scrollRoot: HTMLElement,
  row: HTMLElement
): void {
  const thead = scrollRoot.querySelector('thead')
  const theadHeight = thead instanceof HTMLElement ? thead.offsetHeight : 0
  const scrollRect = scrollRoot.getBoundingClientRect()
  const rowRect = row.getBoundingClientRect()
  const rowTop = rowRect.top - scrollRect.top + scrollRoot.scrollTop
  const rowBottom = rowTop + row.offsetHeight
  const viewTop = scrollRoot.scrollTop + theadHeight
  const viewBottom = scrollRoot.scrollTop + scrollRoot.clientHeight
  if (rowTop < viewTop) {
    scrollRoot.scrollTop = Math.max(0, rowTop - theadHeight)
  } else if (rowBottom > viewBottom) {
    scrollRoot.scrollTop = rowBottom - scrollRoot.clientHeight
  }
}

/** After React paints the newly selected row, keep it visible below the sticky header. */
export function scheduleScrollHeaderListNavRowIntoView(
  entry: HeaderListNavEntry,
  config: HeaderListScrollConfig
): void {
  const run = () => {
    const root = document.querySelector(config.scrollRootSelector)
    if (!(root instanceof HTMLElement)) return
    const row = findHeaderListNavRowElement(root, entry, config)
    if (row) scrollHeaderListRowIntoView(root, row)
  }
  requestAnimationFrame(() => requestAnimationFrame(run))
}

export type GridRowScrollConfig = {
  scrollRootSelector: string
  rowKeyAttr?: string
}

export function buildGridRowNavKeys<T extends { key: string }>(
  rows: T[],
  isNavigableRow?: (row: T) => boolean
): string[] {
  if (!isNavigableRow) return rows.map((row) => row.key)
  return rows.filter((row) => isNavigableRow(row)).map((row) => row.key)
}

export function findGridRowNavIndex(
  keys: string[],
  selectedKey: string | null
): number {
  if (!selectedKey) return -1
  return keys.indexOf(selectedKey)
}

/** Prefer focused row when navigable; otherwise fall back to the selected row key. */
export function resolveGridNavAnchorKey(
  keys: string[],
  focusKey: string | null | undefined,
  selectedKey: string | null | undefined
): string | null {
  if (focusKey && keys.includes(focusKey)) return focusKey
  if (selectedKey && keys.includes(selectedKey)) return selectedKey
  return null
}

export function scheduleScrollGridRowIntoView(
  rowKey: string,
  config: GridRowScrollConfig
): void {
  const rowKeyAttr = config.rowKeyAttr ?? GRID_ROW_NAV_KEY_ATTR
  const run = () => {
    const root = document.querySelector(config.scrollRootSelector)
    if (!(root instanceof HTMLElement)) return
    const row = root.querySelector(`[${rowKeyAttr}="${rowKey}"]`)
    if (row instanceof HTMLElement) scrollHeaderListRowIntoView(root, row)
  }
  requestAnimationFrame(() => requestAnimationFrame(run))
}

/** Scroll row into view and restore focus in the same column when possible. */
export function scheduleFocusGridNavRow(
  rowKey: string,
  config: GridRowScrollConfig,
  previousFocus?: EventTarget | null
): void {
  const rowKeyAttr = config.rowKeyAttr ?? GRID_ROW_NAV_KEY_ATTR
  const run = () => {
    const root = document.querySelector(config.scrollRootSelector)
    if (!(root instanceof HTMLElement)) return
    const row = root.querySelector(`[${rowKeyAttr}="${rowKey}"]`)
    if (!(row instanceof HTMLElement)) return
    scrollHeaderListRowIntoView(root, row)
    const prevCell = focusableGridCell(previousFocus ?? null)?.closest('td')
    if (prevCell instanceof HTMLTableCellElement) {
      const nextCell = row.cells[prevCell.cellIndex]
      const input = nextCell?.querySelector(GRID_CELL_INPUT_SELECTOR)
      if (input instanceof HTMLElement) {
        input.focus()
        return
      }
    }
    const fallback = row.querySelector(GRID_CELL_INPUT_SELECTOR)
    if (fallback instanceof HTMLElement) {
      fallback.focus()
      return
    }
    if (row instanceof HTMLTableRowElement) {
      row.focus()
    }
  }
  requestAnimationFrame(() => requestAnimationFrame(run))
}

/** Scroll header row into view and focus the same column when possible. */
export function scheduleFocusHeaderListNavRow(
  entry: HeaderListNavEntry,
  config: HeaderListScrollConfig,
  previousFocus?: EventTarget | null
): void {
  const run = () => {
    const root = document.querySelector(config.scrollRootSelector)
    if (!(root instanceof HTMLElement)) return
    const row = findHeaderListNavRowElement(root, entry, config)
    if (!row) return
    scrollHeaderListRowIntoView(root, row)
    const prevCell = focusableGridCell(previousFocus ?? null)?.closest('td')
    if (prevCell instanceof HTMLTableCellElement) {
      const nextCell = row.cells[prevCell.cellIndex]
      const input = nextCell?.querySelector(GRID_CELL_INPUT_SELECTOR)
      if (input instanceof HTMLElement) {
        input.focus()
        return
      }
    }
    const fallback = row.querySelector(GRID_CELL_INPUT_SELECTOR)
    if (fallback instanceof HTMLElement) {
      fallback.focus()
      return
    }
    if (row instanceof HTMLTableRowElement) {
      row.focus()
    }
  }
  requestAnimationFrame(() => requestAnimationFrame(run))
}

export const RECEIPT_DETAIL_LINE_SCROLL: GridRowScrollConfig = {
  scrollRootSelector: '.erp-detail-panel .erp-grid-wrap-detail',
}

export const PRODUCTION_PROCESS_SCROLL: GridRowScrollConfig = {
  scrollRootSelector:
    '[data-production-grid="process"] .erp-grid-wrap-detail, [data-production-grid="process"] .erp-grid-wrap-static',
}

export const PRODUCTION_INPUT_SCROLL: GridRowScrollConfig = {
  scrollRootSelector:
    '[data-production-grid="input"] .erp-grid-wrap-detail, [data-production-grid="input"] .erp-grid-wrap-static',
}
