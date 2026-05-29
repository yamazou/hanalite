export function normalizeTabPath(path: string): string {
  if (!path) return '/'
  if (path === '/') return '/'
  return path.replace(/\/+$/, '')
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
