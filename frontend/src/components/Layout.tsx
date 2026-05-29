import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useRoutes } from 'react-router-dom'
import { appRouteObjects } from '../appRoutes'
import { AppShellProvider } from '../context/AppNavigateContext'
import { ItemTypColorProvider } from '../context/ItemTypColorContext'
import { formatAppRoute, normalizeTabPath, parseAppRoute } from '../utils/appRoute'

type NavLink = { to: string; label: string }
/** `to` = pathname (tab key); `search` = query string including `?` when set. */
type OpenTab = { to: string; search: string; label: string; pinned?: boolean }

function tabRoute(tab: OpenTab): string {
  return formatAppRoute(tab.to, tab.search)
}

const TAB_STORAGE_KEY = 'hanalite.openTabs.v1'

type NavModule = {
  id: 'Receipt' | 'Delivery'
  label: string
  items: NavLink[]
}

type NavGroup =
  | {
      id: 'Purchase' | 'Sales'
      label: string
      modules: NavModule[]
    }
  | {
      id: 'Inventory' | 'Production' | 'Masters'
      label: string
      items: NavLink[]
    }

const navGroups: NavGroup[] = [
  {
    id: 'Purchase',
    label: 'Purchase',
    modules: [
      {
        id: 'Receipt',
        label: 'Receipt',
        items: [
          { to: '/', label: 'Receipt List' },
          { to: '/drafts/new', label: 'Receipt Entry' },
          { to: '/drafts/import', label: 'Excel Import' },
          { to: '/drafts/import-pdf', label: 'PDF Import' },
        ],
      },
    ],
  },
  {
    id: 'Sales',
    label: 'Sales',
    modules: [
      {
        id: 'Delivery',
        label: 'Delivery',
        items: [
          { to: '/delivery', label: 'Delivery List' },
          { to: '/delivery/new', label: 'Delivery Entry' },
          { to: '/delivery/import', label: 'Excel Import' },
        ],
      },
    ],
  },
  {
    id: 'Production',
    label: 'Production',
    items: [
      { to: '/production/orders', label: 'Production List' },
      { to: '/production/new', label: 'Production Order Entry' },
      { to: '/production/import', label: 'Excel Import' },
    ],
  },
  {
    id: 'Inventory',
    label: 'Inventory',
    items: [
      { to: '/inventory/currents', label: 'Current Stock' },
      { to: '/trace', label: 'Lot Trace' },
      { to: '/inventory/grgi', label: 'GR/GI Movements' },
      { to: '/inventory/balances', label: 'Period Balances' },
    ],
  },
  {
    id: 'Masters',
    label: 'Masters',
    items: [
      { to: '/masters/items', label: 'Items' },
      { to: '/masters/locations', label: 'Locations' },
      { to: '/masters/boms', label: 'BOM' },
      { to: '/masters/itemtyps', label: 'Item Types' },
      { to: '/masters/movetyps', label: 'Move Types' },
      { to: '/masters/suppliers', label: 'Suppliers' },
    ],
  },
]

function isActive(pathname: string, to: string) {
  const listRoots = ['/', '/delivery']
  if (listRoots.includes(to)) return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

function openKeysForPath(pathname: string): string[] {
  if (pathname.startsWith('/masters')) return ['Masters']
  if (pathname.startsWith('/production')) return ['Production']
  if (pathname.startsWith('/inventory') || pathname.startsWith('/trace')) return ['Inventory']
  if (pathname.startsWith('/delivery')) return ['Sales', 'Sales:Delivery']
  return ['Purchase', 'Purchase:Receipt']
}

function groupHasActive(pathname: string, group: NavGroup): boolean {
  if ('modules' in group) {
    return group.modules.some((mod) => mod.items.some((item) => isActive(pathname, item.to)))
  }
  return group.items.some((item) => isActive(pathname, item.to))
}

function moduleHasActive(pathname: string, mod: NavModule): boolean {
  return mod.items.some((item) => isActive(pathname, item.to))
}

function normalizeAndDedupeTabs(
  rawTabs: Array<{ to: string; search?: string; label: string; pinned?: boolean }>
): OpenTab[] {
  const deduped = new Map<string, OpenTab>()
  for (const tab of rawTabs) {
    const parsed = parseAppRoute(tab.to)
    const to = parsed.pathname
    const search = tab.search ?? parsed.search
    const existing = deduped.get(to)
    if (!existing) {
      deduped.set(to, { to, search, label: tab.label, pinned: tab.pinned === true })
      continue
    }
    deduped.set(to, {
      to,
      search: existing.search || search,
      label: existing.label || tab.label,
      pinned: existing.pinned === true || tab.pinned === true,
    })
  }
  return Array.from(deduped.values())
}

export function Layout() {
  const location = useLocation()
  const { pathname } = location
  const routerPath = normalizeTabPath(pathname)
  const navigate = useNavigate()
  const [viewRoute, setViewRoute] = useState(() => ({
    pathname: routerPath,
    search: location.search,
  }))
  const currentPath = viewRoute.pathname
  const closingPathRef = useRef<string | null>(null)
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set(openKeysForPath(currentPath)))
  const [tabs, setTabs] = useState<OpenTab[]>(() => {
    try {
      const raw = localStorage.getItem(TAB_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Array<OpenTab | { to: string; label: string }>
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed
            .filter((t): t is { to: string; label: string; pinned?: boolean } =>
              !!t && typeof t.to === 'string' && typeof t.label === 'string'
            )
            .map((t) => {
              const parsed = parseAppRoute(t.to)
              return {
                to: parsed.pathname,
                search: (t as OpenTab).search ?? parsed.search,
                label: t.label,
                pinned: (t as OpenTab).pinned === true,
              }
            })
          return normalizeAndDedupeTabs(normalized)
        }
      }
    } catch {
      // ignore bad localStorage
    }
    return [
      {
        to: currentPath,
        search: location.search,
        label: labelForPath(currentPath),
        pinned: false,
      },
    ]
  })

  const activeTab = useMemo(() => tabs.find((t) => t.to === currentPath), [tabs, currentPath])

  useEffect(() => {
    if (activeTab) return
    if (closingPathRef.current === currentPath) return
    setTabs((prev) => [
      ...prev,
      {
        to: currentPath,
        search: viewRoute.search,
        label: labelForPath(currentPath),
        pinned: false,
      },
    ])
  }, [currentPath, activeTab, viewRoute.search])

  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(tabs))
  }, [tabs])

  useEffect(() => {
    const keys = openKeysForPath(currentPath)
    setOpenKeys((prev) => {
      const next = new Set(prev)
      for (const key of keys) next.add(key)
      return next
    })
  }, [currentPath])

  useEffect(() => {
    if (closingPathRef.current && closingPathRef.current !== currentPath) {
      closingPathRef.current = null
    }
  }, [currentPath])

  useEffect(() => {
    setViewRoute({ pathname: routerPath, search: location.search })
    setTabs((prev) =>
      prev.map((t) => (t.to === routerPath ? { ...t, search: location.search } : t))
    )
  }, [routerPath, location.search])

  const appNavigate = useCallback(
    (to: string, options?: { replace?: boolean }) => {
      const next = parseAppRoute(to)
      setViewRoute(next)
      setTabs((prev) =>
        prev.map((t) => (t.to === next.pathname ? { ...t, search: next.search } : t))
      )
      if (routerPath !== next.pathname || location.search !== next.search) {
        navigate({ pathname: next.pathname, search: next.search }, options)
      }
    },
    [navigate, routerPath, location.search]
  )

  const displayLocation = useMemo(() => {
    if (viewRoute.pathname === routerPath && viewRoute.search === location.search) {
      return location
    }
    return {
      ...location,
      pathname: viewRoute.pathname,
      search: viewRoute.search,
      hash: '',
      key: `view-${viewRoute.pathname}${viewRoute.search}`,
    }
  }, [location, viewRoute, routerPath])

  const routeElement = useRoutes(appRouteObjects, displayLocation)

  const requestRoute = (to: string) => {
    const next = parseAppRoute(to)
    if (currentPath === next.pathname && viewRoute.search === next.search) return
    appNavigate(to)
  }

  const toggleKey = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const openTab = (to: string, label?: string) => {
    const parsed = parseAppRoute(to)
    setTabs((prev) => {
      const existing = prev.find((t) => t.to === parsed.pathname)
      if (existing) {
        requestRoute(tabRoute(existing))
        return prev
      }
      requestRoute(formatAppRoute(parsed.pathname, parsed.search))
      return [
        ...prev,
        {
          to: parsed.pathname,
          search: parsed.search,
          label: label ?? labelForPath(parsed.pathname),
          pinned: false,
        },
      ]
    })
  }

  const closeTab = (to: string) => {
    const normalizedTo = normalizeTabPath(to)
    const idx = tabs.findIndex((t) => t.to === normalizedTo)
    if (idx < 0) return
    const nextTabs = tabs.filter((t) => t.to !== normalizedTo)
    if (currentPath === normalizedTo) {
      closingPathRef.current = normalizedTo
      const fallback = nextTabs[Math.max(0, idx - 1)] ?? nextTabs[0] ?? null
      if (fallback) requestRoute(tabRoute(fallback))
    }
    setTabs(nextTabs)
  }

  const togglePinTab = (to: string) => {
    const normalizedTo = normalizeTabPath(to)
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.to === normalizedTo)
      if (idx < 0) return prev
      const next = [...prev]
      const target = { ...next[idx], pinned: !next[idx].pinned }
      next[idx] = target
      if (target.pinned) {
        next.splice(idx, 1)
        const firstUnpinned = next.findIndex((t) => !t.pinned)
        const insertAt = firstUnpinned < 0 ? next.length : firstUnpinned
        next.splice(insertAt, 0, target)
      }
      return next
    })
  }

  const reorderTabs = (fromTo: string, targetTo: string) => {
    const normalizedFromTo = normalizeTabPath(fromTo)
    const normalizedTargetTo = normalizeTabPath(targetTo)
    if (normalizedFromTo === normalizedTargetTo) return
    setTabs((prev) => {
      const fromIndex = prev.findIndex((t) => t.to === normalizedFromTo)
      const toIndex = prev.findIndex((t) => t.to === normalizedTargetTo)
      if (fromIndex < 0 || toIndex < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }

  return (
    <ItemTypColorProvider>
    <AppShellProvider navigate={appNavigate} viewRoute={viewRoute}>
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img
            src="/hanalite-logo.png"
            alt="hanalite - Visual Management"
            className="brand-logo"
            width={196}
            height={64}
          />
        </div>
        <nav className="sidebar-nav">
          {navGroups.map((group) => {
            const groupKey = group.id
            const groupOpen = openKeys.has(groupKey)
            const groupActive = groupHasActive(currentPath, group)

            if ('modules' in group) {
              return (
                <div key={groupKey} className={`nav-section${groupOpen ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className={`nav-section-toggle${groupActive ? ' has-active' : ''}`}
                    aria-expanded={groupOpen}
                    onClick={() => toggleKey(groupKey)}
                  >
                    <span>{group.label}</span>
                    <span className="nav-chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                  <div className="nav-submenu">
                    {group.modules.map((mod) => {
                      const moduleKey = `${groupKey}:${mod.id}`
                      const moduleOpen = openKeys.has(moduleKey)
                      const moduleActive = moduleHasActive(currentPath, mod)
                      return (
                        <div
                          key={moduleKey}
                          className={`nav-module${moduleOpen ? ' is-open' : ''}`}
                        >
                          <button
                            type="button"
                            className={`nav-module-toggle${moduleActive ? ' has-active' : ''}`}
                            aria-expanded={moduleOpen}
                            onClick={() => toggleKey(moduleKey)}
                          >
                            <span>{mod.label}</span>
                            <span className="nav-chevron" aria-hidden="true">
                              ›
                            </span>
                          </button>
                          <div className="nav-module-links">
                            {mod.items.map((item) => (
                              <button
                                key={`${moduleKey}-${item.to}`}
                                type="button"
                                className={`nav-link${isActive(currentPath, item.to) ? ' active' : ''}`}
                                onClick={() => openTab(item.to, item.label)}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            }

            return (
              <div key={groupKey} className={`nav-section${groupOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className={`nav-section-toggle${groupActive ? ' has-active' : ''}`}
                  aria-expanded={groupOpen}
                  onClick={() => toggleKey(groupKey)}
                >
                  <span>{group.label}</span>
                  <span className="nav-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <div className="nav-submenu">
                  {group.items.map((item) => (
                    <button
                      key={item.to}
                      type="button"
                      className={`nav-link${isActive(currentPath, item.to) ? ' active' : ''}`}
                      onClick={() => openTab(item.to, item.label)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-footer-tabs">
            <button
              type="button"
              className={`erp-tab${currentPath === '/api-docs' ? ' active' : ''}`}
              onClick={() => openTab('/api-docs', 'API Docs')}
            >
              API Docs
            </button>
          </div>
          <div aria-hidden="true">&nbsp;</div>
          <div>hanalite v1.0 powered by</div>
          <div>PT.BAHTERA HISISTEM INDONESIA</div>
        </div>
      </aside>
      <main className="main">
        <div className="main-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.to}
              type="button"
              className={`main-tab ${tab.to === currentPath ? 'active' : ''}`}
              onClick={() => requestRoute(tabRoute(tab))}
              title={tabRoute(tab)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/tab-to', tab.to)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(e) => {
                e.preventDefault()
                const fromTo = e.dataTransfer.getData('text/tab-to')
                if (fromTo) reorderTabs(fromTo, tab.to)
              }}
            >
              <span
                className={`main-tab-pin ${tab.pinned ? 'is-pinned' : ''}`}
                title={tab.pinned ? 'Unpin tab' : 'Pin tab'}
                onClick={(e) => {
                  e.stopPropagation()
                  togglePinTab(tab.to)
                }}
              >
                {tab.pinned ? '📌' : '📍'}
              </span>
              <span className="main-tab-label">{tab.label}</span>
              {(
                <span
                  className="main-tab-close"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.to)
                  }}
                >
                  ×
                </span>
              )}
            </button>
          ))}
        </div>
        {tabs.length === 0 ? (
          <div className="erp-panel">
            <div className="erp-panel-content">
              <p className="muted erp-grid-empty">No tab open. Select a menu to open a page.</p>
            </div>
          </div>
        ) : (
          routeElement
        )}
      </main>
    </div>
    </AppShellProvider>
    </ItemTypColorProvider>
  )
}

function labelForPath(pathname: string): string {
  let best: NavLink | null = null
  for (const group of navGroups) {
    const items = 'modules' in group ? group.modules.flatMap((m) => m.items) : group.items
    for (const item of items) {
      const matched = item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(`${item.to}/`)
      if (!matched) continue
      if (!best || item.to.length > best.to.length) best = item
    }
  }
  if (best) return best.label
  if (pathname.startsWith('/drafts')) return 'Receipt'
  if (pathname.startsWith('/delivery')) return 'Delivery'
  return pathname
}
