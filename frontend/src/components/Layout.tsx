import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

type NavLink = { to: string; label: string }

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
      id: 'Inventory' | 'Masters'
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
          { to: '/', label: 'Receipt Drafts' },
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
          { to: '/delivery', label: 'Delivery Drafts' },
          { to: '/delivery/new', label: 'Delivery Entry' },
          { to: '/delivery/import', label: 'Excel Import' },
        ],
      },
    ],
  },
  {
    id: 'Inventory',
    label: 'Inventory',
    items: [
      { to: '/inventory/currents', label: 'Current Stock' },
      { to: '/inventory/grgi', label: 'GR/GI Movements' },
      { to: '/trace', label: 'Lot Trace' },
      { to: '/inventory/balances', label: 'Period Balances' },
    ],
  },
  {
    id: 'Masters',
    label: 'Masters',
    items: [
      { to: '/masters/itemtyps', label: 'Item Types' },
      { to: '/masters/suppliers', label: 'Suppliers' },
      { to: '/masters/movetyps', label: 'Move Types' },
      { to: '/masters/locations', label: 'Locations' },
      { to: '/masters/items', label: 'Items' },
      { to: '/masters/boms', label: 'BOM' },
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

export function Layout() {
  const { pathname } = useLocation()
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set(openKeysForPath(pathname)))

  useEffect(() => {
    const keys = openKeysForPath(pathname)
    setOpenKeys((prev) => {
      const next = new Set(prev)
      for (const key of keys) next.add(key)
      return next
    })
  }, [pathname])

  const toggleKey = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">hanalite</div>
        <p className="brand-sub">Lot Traceability</p>
        <nav className="sidebar-nav">
          {navGroups.map((group) => {
            const groupKey = group.id
            const groupOpen = openKeys.has(groupKey)
            const groupActive = groupHasActive(pathname, group)

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
                      const moduleActive = moduleHasActive(pathname, mod)
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
                              <Link
                                key={`${moduleKey}-${item.to}`}
                                to={item.to}
                                className={isActive(pathname, item.to) ? 'active' : ''}
                              >
                                {item.label}
                              </Link>
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
                    <Link
                      key={item.to}
                      to={item.to}
                      className={isActive(pathname, item.to) ? 'active' : ''}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">
            API Docs
          </a>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
