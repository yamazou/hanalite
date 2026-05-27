import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

const sections = ['Receipt', 'Inventory', 'Masters'] as const
type Section = (typeof sections)[number]

const nav = [
  { to: '/', label: 'Receipt Drafts', section: 'Receipt' as const },
  { to: '/drafts/new', label: 'New Receipt', section: 'Receipt' as const },
  { to: '/drafts/import', label: 'Excel Import', section: 'Receipt' as const },
  { to: '/drafts/import-pdf', label: 'PDF Import', section: 'Receipt' as const },
  { to: '/inventory/currents', label: 'Current Stock', section: 'Inventory' as const },
  { to: '/inventory/grgi', label: 'GR/GI Movements', section: 'Inventory' as const },
  { to: '/trace', label: 'Lot Trace', section: 'Inventory' as const },
  { to: '/inventory/balances', label: 'Period Balances', section: 'Inventory' as const },
  { to: '/masters/itemtyps', label: 'Item Types', section: 'Masters' as const },
  { to: '/masters/suppliers', label: 'Suppliers', section: 'Masters' as const },
  { to: '/masters/movetyps', label: 'Move Types', section: 'Masters' as const },
  { to: '/masters/items', label: 'Items', section: 'Masters' as const },
  { to: '/masters/boms', label: 'BOM', section: 'Masters' as const },
]

function isActive(pathname: string, to: string) {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

function sectionForPath(pathname: string): Section {
  if (pathname.startsWith('/masters')) return 'Masters'
  if (pathname.startsWith('/inventory') || pathname.startsWith('/trace')) return 'Inventory'
  return 'Receipt'
}

function sectionHasActive(pathname: string, section: Section) {
  return nav.some((item) => item.section === section && isActive(pathname, item.to))
}

export function Layout() {
  const { pathname } = useLocation()
  const [openSections, setOpenSections] = useState<Set<Section>>(
    () => new Set([sectionForPath(pathname)])
  )

  useEffect(() => {
    const active = sectionForPath(pathname)
    setOpenSections((prev) => {
      if (prev.has(active)) return prev
      const next = new Set(prev)
      next.add(active)
      return next
    })
  }, [pathname])

  const toggleSection = (section: Section) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">hanalite</div>
        <p className="brand-sub">Lot Traceability</p>
        <nav className="sidebar-nav">
          {sections.map((section) => {
            const isOpen = openSections.has(section)
            const isCurrent = sectionHasActive(pathname, section)
            return (
              <div key={section} className={`nav-section${isOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className={`nav-section-toggle${isCurrent ? ' has-active' : ''}`}
                  aria-expanded={isOpen}
                  onClick={() => toggleSection(section)}
                >
                  <span>{section}</span>
                  <span className="nav-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <div className="nav-submenu">
                  {nav
                    .filter((item) => item.section === section)
                    .map((item) => (
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
