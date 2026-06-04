export function normalizeTabPath(path: string): string {
  const trimmed = (path ?? '').trim()
  if (!trimmed || trimmed === '/') return '/'
  const withoutTrailing = trimmed.replace(/\/+$/, '') || '/'
  if (withoutTrailing === '/') return '/'
  return withoutTrailing.startsWith('/') ? withoutTrailing : `/${withoutTrailing}`
}

export type AppRouteTarget = {
  pathname: string
  search: string
}

export function parseAppRoute(to: string): AppRouteTarget {
  const hashIdx = to.indexOf('#')
  const withoutHash = hashIdx >= 0 ? to.slice(0, hashIdx) : to
  const qIdx = withoutHash.indexOf('?')
  if (qIdx < 0) {
    return { pathname: normalizeTabPath(withoutHash), search: '' }
  }
  return {
    pathname: normalizeTabPath(withoutHash.slice(0, qIdx)),
    search: withoutHash.slice(qIdx),
  }
}

/** Full in-app route for navigation (pathname + query). */
export function formatAppRoute(pathname: string, search = ''): string {
  return pathname + search
}

export function tabRouteKey(pathname: string, search = ''): string {
  return formatAppRoute(normalizeTabPath(pathname), search)
}

/** Shell route when no tab is open (not a real page). */
export const APP_HOME_PATH = '/home'

/** Receipt List tab pathname (index route). */
export const RECEIPT_LIST_PATH = '/'

/** List screens: one tab per pathname; row selection only changes ?query. */
const SINGLETON_LIST_PATHS = new Set([RECEIPT_LIST_PATH, '/delivery', '/production/orders'])

export function isSingletonListPath(pathname: string): boolean {
  return SINGLETON_LIST_PATHS.has(normalizeTabPath(pathname))
}

/** Tab dedupe / lookup key (singleton lists ignore search). */
export function tabDedupeKey(pathname: string, search = ''): string {
  return isSingletonListPath(pathname) ? normalizeTabPath(pathname) : tabRouteKey(pathname, search)
}

export function isAppHomeRoute(route: AppRouteTarget): boolean {
  return normalizeTabPath(route.pathname) === APP_HOME_PATH
}

export function isReceiptListRoute(route: AppRouteTarget): boolean {
  return normalizeTabPath(route.pathname) === RECEIPT_LIST_PATH
}

export function tabMatchesViewRoute(
  tab: { to: string; search: string },
  view: AppRouteTarget
): boolean {
  if (isSingletonListPath(view.pathname)) {
    return normalizeTabPath(tab.to) === normalizeTabPath(view.pathname)
  }
  return tabRouteKey(tab.to, tab.search) === tabRouteKey(view.pathname, view.search)
}

/**
 * On load: keep deep-linked routes; map bare `/` to home unless a receipt tab is restored.
 */
export function resolveRouteOnLoad(
  browser: AppRouteTarget,
  openTabs: Array<{ to: string; search?: string }> = []
): AppRouteTarget {
  if (isAppHomeRoute(browser)) return browser
  if (normalizeTabPath(browser.pathname) !== '/') return browser
  const browserKey = tabDedupeKey(browser.pathname, browser.search)
  const hasMatchingTab = openTabs.some(
    (t) => tabDedupeKey(t.to, t.search ?? '') === browserKey
  )
  if (hasMatchingTab) return browser
  return { pathname: APP_HOME_PATH, search: '' }
}
