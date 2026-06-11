import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import { Outlet, useLocation, useNavigate, type Location } from 'react-router-dom'
import {
  AppShellProvider,
  TabPanelActiveProvider,
} from '../context/AppNavigateContext'
import { useAuth } from '../context/AuthContext'
import { ItemTypColorProvider } from '../context/ItemTypColorContext'
import { MasterCatalogProvider } from '../context/MasterCatalogContext'
import {
  APP_HOME_PATH,
  formatAppRoute,
  isAppHomeRoute,
  normalizeTabPath,
  parseAppRoute,
  resolveRouteOnLoad,
  tabDedupeKey,
  tabMatchesViewRoute,
  tabRouteKey,
  type AppRouteTarget,
} from '../utils/appRoute'

type NavLink = { to: string; label: string }
type NavDivider = { divider: true }
type NavItem = NavLink | NavDivider

function isNavLink(item: NavItem): item is NavLink {
  return !('divider' in item)
}

const NAV_DIVIDER: NavDivider = { divider: true }

/** `to` = pathname (tab key); `search` = query string including `?` when set. */
type OpenTab = { to: string; search: string; label: string; pinned?: boolean }

function tabRoute(tab: OpenTab): string {
  return formatAppRoute(tab.to, tab.search)
}

const TAB_STORAGE_KEY = 'hanalite.openTabs.v1'

function readTabsFromSession(): OpenTab[] {
  try {
    const raw = sessionStorage.getItem(TAB_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return normalizeAndDedupeTabs(
      parsed.map((tab) => {
        const row = tab as Partial<OpenTab>
        return {
          to: String(row.to ?? ''),
          search: row.search ?? '',
          label: String(row.label ?? ''),
          pinned: row.pinned === true,
        }
      })
    )
  } catch {
    return []
  }
}

function writeTabsToSession(tabs: OpenTab[]): void {
  try {
    if (tabs.length === 0) {
      sessionStorage.removeItem(TAB_STORAGE_KEY)
      return
    }
    sessionStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(tabs))
  } catch {
    // ignore quota / private mode
  }
}

/** Restore tabs on refresh; cold start at `/` or `/home` opens no tabs. */
function hydrateTabsOnLoad(browserRoute: AppRouteTarget): OpenTab[] {
  const stored = readTabsFromSession()
  if (isAppHomeRoute(browserRoute)) return []
  const routeKey = tabDedupeKey(browserRoute.pathname, browserRoute.search)
  if (normalizeTabPath(browserRoute.pathname) === '/') {
    return stored.some((t) => tabDedupeKey(t.to, t.search) === routeKey) ? stored : []
  }
  if (stored.some((t) => tabDedupeKey(t.to, t.search) === routeKey)) return stored
  return normalizeAndDedupeTabs([
    ...stored,
    {
      to: browserRoute.pathname,
      search: browserRoute.search,
      label: labelForPath(browserRoute.pathname),
      pinned: false,
    },
  ])
}

function getInitialShellState(location: Location): {
  tabs: OpenTab[]
  viewRoute: AppRouteTarget
} {
  const browser = routeFromBrowserLocation(location)
  const tabs = hydrateTabsOnLoad(browser)
  const viewRoute = resolveRouteOnLoad(browser, tabs)
  return { tabs, viewRoute }
}

type NavGroup = {
  id: 'Purchase' | 'Sales' | 'Inventory' | 'Production' | 'Masters'
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    id: 'Purchase',
    label: 'Purchase',
    items: [{ to: '/', label: 'Receipt List' }],
  },
  {
    id: 'Sales',
    label: 'Sales',
    items: [
      { to: '/delivery', label: 'Delivery List' },
      { to: '/delivery/new', label: 'Delivery Entry' },
    ],
  },
  {
    id: 'Production',
    label: 'Production',
    items: [{ to: '/production/orders', label: 'Production Order List' }],
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
      { to: '/masters/itemtyps', label: 'Item Types' },
      { to: '/masters/item-processes', label: 'Item Processes' },
      NAV_DIVIDER,
      { to: '/masters/numbering-patterns', label: 'Numbering Patterns' },
      { to: '/masters/numbering-elements', label: 'Numbering Elements' },
      NAV_DIVIDER,
      { to: '/masters/locations', label: 'Locations' },
      { to: '/masters/locationtyps', label: 'Location Types' },
      { to: '/masters/movetyps', label: 'Move Types' },
      NAV_DIVIDER,
      { to: '/masters/suppliers', label: 'Suppliers' },
      { to: '/masters/customers', label: 'Customers' },
      NAV_DIVIDER,
      { to: '/masters/companies', label: 'Companies' },
      { to: '/masters/users', label: 'Users' },
    ],
  },
]

function isActive(pathname: string, to: string) {
  const listRoots = ['/', '/delivery']
  if (listRoots.includes(to)) return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

function openKeysForPath(pathname: string): string[] {
  if (isAppHomeRoute({ pathname, search: '' })) return []
  if (pathname.startsWith('/masters')) return ['Masters']
  if (pathname.startsWith('/production')) return ['Production']
  if (pathname.startsWith('/inventory') || pathname.startsWith('/trace')) return ['Inventory']
  if (pathname.startsWith('/delivery')) return ['Sales']
  return ['Purchase']
}

function groupHasActive(pathname: string, group: NavGroup): boolean {
  return group.items.some((item) => isNavLink(item) && isActive(pathname, item.to))
}

function normalizeAndDedupeTabs(
  rawTabs: Array<{ to: string; search?: string; label: string; pinned?: boolean }>
): OpenTab[] {
  const deduped = new Map<string, OpenTab>()
  for (const tab of rawTabs) {
    const normalized = normalizeOpenTab({
      to: tab.to,
      search: tab.search ?? '',
      label: tab.label,
      pinned: tab.pinned,
    })
    const key = tabDedupeKey(normalized.to, normalized.search)
    const existing = deduped.get(key)
    if (!existing) {
      deduped.set(key, normalized)
      continue
    }
    deduped.set(key, {
      to: normalized.to,
      search: normalized.search || existing.search,
      label: existing.label || normalized.label,
      pinned: existing.pinned === true || normalized.pinned === true,
    })
  }
  return Array.from(deduped.values())
}

function labelForPath(pathname: string): string {
  let best: NavLink | null = null
  for (const group of navGroups) {
    for (const item of group.items) {
      if (!isNavLink(item)) continue
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

function normalizeOpenTab(tab: OpenTab): OpenTab {
  const parsed = parseAppRoute(formatAppRoute(tab.to, tab.search))
  return {
    to: parsed.pathname,
    search: parsed.search,
    label: tab.label,
    pinned: tab.pinned === true,
  }
}

function routeFromBrowserLocation(location: Location): { pathname: string; search: string } {
  return parseAppRoute(formatAppRoute(location.pathname, location.search))
}

export function Layout() {
  const { session, logout } = useAuth()
  const location = useLocation()
  const { pathname } = location
  const routerPath = normalizeTabPath(pathname)
  const navigate = useNavigate()
  const routeHydratedRef = useRef(false)
  const skipLocationSyncOnceRef = useRef(true)
  const [initialShell] = useState(() => getInitialShellState(location))
  const [viewRoute, setViewRoute] = useState(() => initialShell.viewRoute)
  const currentPath = viewRoute.pathname
  const closingPathRef = useRef<string | null>(null)
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set(openKeysForPath(currentPath)))
  const [tabs, setTabs] = useState<OpenTab[]>(() => initialShell.tabs)

  const viewRouteTarget = useMemo(
    (): AppRouteTarget => ({ pathname: currentPath, search: viewRoute.search }),
    [currentPath, viewRoute.search]
  )

  const activeTabIndex = useMemo(
    () => tabs.findIndex((t) => tabMatchesViewRoute(t, viewRouteTarget)),
    [tabs, viewRouteTarget]
  )

  const activeTab = activeTabIndex >= 0 ? tabs[activeTabIndex] : undefined
  const navActivePath = activeTab?.to ?? currentPath

  useLayoutEffect(() => {
    if (routeHydratedRef.current) return
    routeHydratedRef.current = true
    try {
      localStorage.removeItem(TAB_STORAGE_KEY)
    } catch {
      // ignore
    }
    const atReceiptRoot = normalizeTabPath(location.pathname) === '/'
    if (atReceiptRoot && tabs.length === 0) {
      setViewRoute({ pathname: APP_HOME_PATH, search: '' })
      navigate(APP_HOME_PATH, { replace: true })
    }
  }, [location.pathname, navigate, tabs.length])

  useEffect(() => {
    setTabs((prev) => {
      const normalized = normalizeAndDedupeTabs(prev.map(normalizeOpenTab))
      if (
        normalized.length === prev.length &&
        normalized.every(
          (tab, index) =>
            tab.to === prev[index]?.to &&
            tab.search === prev[index]?.search &&
            tab.label === prev[index]?.label &&
            tab.pinned === prev[index]?.pinned
        )
      ) {
        return prev
      }
      return normalized
    })
  }, [])

  useEffect(() => {
    writeTabsToSession(tabs)
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
    if (skipLocationSyncOnceRef.current) {
      skipLocationSyncOnceRef.current = false
      return
    }
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

  useEffect(() => {
    if (tabs.length > 0) return
    if (isAppHomeRoute(viewRouteTarget)) return
    appNavigate(APP_HOME_PATH)
  }, [tabs.length, viewRouteTarget, appNavigate])

  useLayoutEffect(() => {
    if (tabs.length === 0 || activeTabIndex >= 0) return
    if (isAppHomeRoute(viewRouteTarget)) return
    const browser = routeFromBrowserLocation(location)
    const fromBrowser = tabs.findIndex((t) => tabMatchesViewRoute(t, browser))
    const target = fromBrowser >= 0 ? tabs[fromBrowser]! : tabs[tabs.length - 1]!
    const next = parseAppRoute(formatAppRoute(target.to, target.search))
    setViewRoute(next)
    if (routerPath !== next.pathname || location.search !== next.search) {
      navigate({ pathname: next.pathname, search: next.search }, { replace: true })
    }
  }, [tabs, activeTabIndex, location.pathname, location.search, navigate, routerPath, viewRouteTarget])

  useEffect(() => {
    if (!activeTab) return
    const next = parseAppRoute(formatAppRoute(activeTab.to, activeTab.search))
    if (routerPath === next.pathname && location.search === next.search) return
    navigate({ pathname: next.pathname, search: next.search }, { replace: true })
  }, [activeTab, routerPath, location.search, navigate])

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
    const dedupeKey = tabDedupeKey(parsed.pathname, parsed.search)
    const existing = tabs.find((t) => tabDedupeKey(t.to, t.search) === dedupeKey)
    if (existing) {
      requestRoute(formatAppRoute(parsed.pathname, parsed.search))
      return
    }
    setTabs((prev) =>
      normalizeAndDedupeTabs([
        ...prev,
        {
          to: parsed.pathname,
          search: parsed.search,
          label: label ?? labelForPath(parsed.pathname),
          pinned: false,
        },
      ])
    )
    requestRoute(formatAppRoute(parsed.pathname, parsed.search))
  }

  const closeTab = (to: string) => {
    const normalizedTo = normalizeTabPath(to)
    const idx = tabs.findIndex((t) => t.to === normalizedTo)
    if (idx < 0) return
    const nextTabs = tabs.filter((t) => t.to !== normalizedTo)
    if (currentPath === normalizedTo) {
      closingPathRef.current = normalizedTo
      const fallback = nextTabs[Math.max(0, idx - 1)] ?? nextTabs[0] ?? null
      if (fallback) {
        requestRoute(tabRoute(fallback))
      } else {
        requestRoute(APP_HOME_PATH)
      }
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
    <MasterCatalogProvider>
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
        {session ? (
          <div className="sidebar-session">
            <span
              className="sidebar-session-account"
              title={
                session.user_nm
                  ? `${session.user_cd}@${session.company_cd} (${session.user_nm})`
                  : `${session.user_cd}@${session.company_cd}`
              }
            >
              {session.user_cd}@{session.company_cd}
            </span>
            <button
              type="button"
              className="sidebar-logout"
              onClick={() => logout()}
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        ) : null}
        <nav className="sidebar-nav">
          {navGroups.map((group) => {
            const groupKey = group.id
            const groupOpen = openKeys.has(groupKey)
            const groupActive = groupHasActive(navActivePath, group)

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
                  {group.items.map((item, itemIndex) =>
                    isNavLink(item) ? (
                      <button
                        key={item.to}
                        type="button"
                        className={`nav-link${isActive(navActivePath, item.to) ? ' active' : ''}`}
                        onClick={() => openTab(item.to, item.label)}
                      >
                        {item.label}
                      </button>
                    ) : (
                      <div
                        key={`${groupKey}-divider-${itemIndex}`}
                        className="nav-submenu-divider"
                        role="separator"
                        aria-hidden="true"
                      />
                    )
                  )}
                </div>
              </div>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-footer-tabs">
            <button
              type="button"
              className={`erp-tab${navActivePath === '/api-docs' ? ' active' : ''}`}
              onClick={() => openTab('/api-docs', 'API Docs')}
            >
              API Docs
            </button>
          </div>
          <div aria-hidden="true">&nbsp;</div>
          <div>hanalite v1.0 powered by BHI</div>
        </div>
      </aside>
      <main className="main">
        <div className="main-tabs">
          {tabs.map((tab) => (
            <div
              key={tabRouteKey(tab.to, tab.search)}
              className={`main-tab ${tabMatchesViewRoute(tab, viewRouteTarget) ? 'active' : ''}`}
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
                className="main-tab-drag"
                draggable
                title="Drag to reorder"
                aria-label="Drag to reorder tab"
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/tab-to', tab.to)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                ⠿
              </span>
              <button
                type="button"
                className="main-tab-select"
                onClick={() => requestRoute(tabRoute(tab))}
                title={tabRoute(tab)}
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
                <span
                  className="main-tab-close"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.to)
                  }}
                >
                  ×
                </span>
              </button>
            </div>
          ))}
        </div>
        {tabs.length === 0 ? (
          <div className="main-tab-panels">
            <div className="main-tab-panel">
              <TabPanelActiveProvider active>
                <Outlet />
              </TabPanelActiveProvider>
            </div>
          </div>
        ) : activeTab ? (
          <div className="main-tab-panels">
            <div className="main-tab-panel">
              <TabPanelActiveProvider active>
                <Outlet />
              </TabPanelActiveProvider>
            </div>
          </div>
        ) : (
          <div className="erp-panel">
            <div className="erp-panel-content">
              <p className="muted erp-grid-empty">
                Tab route mismatch. Select a tab or open a page from the menu.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
    </MasterCatalogProvider>
    </AppShellProvider>
    </ItemTypColorProvider>
  )
}
