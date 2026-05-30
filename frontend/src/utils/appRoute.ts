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
