import { createContext, useContext } from 'react'
import type { AppRouteTarget } from '../utils/appRoute'

export type AppNavigateOptions = {
  replace?: boolean
}

export type AppNavigate = (to: string, options?: AppNavigateOptions) => void

const AppNavigateContext = createContext<AppNavigate | null>(null)
const AppViewRouteContext = createContext<AppRouteTarget | null>(null)
/** Per-tab route frozen at panel mount; hidden tabs must not read the active tab's viewRoute. */
const TabPanelRouteContext = createContext<AppRouteTarget | null>(null)

export function AppShellProvider({
  navigate,
  viewRoute,
  children,
}: {
  navigate: AppNavigate
  viewRoute: AppRouteTarget
  children: React.ReactNode
}) {
  return (
    <AppNavigateContext.Provider value={navigate}>
      <AppViewRouteContext.Provider value={viewRoute}>{children}</AppViewRouteContext.Provider>
    </AppNavigateContext.Provider>
  )
}

export function useAppNavigate(): AppNavigate {
  const navigate = useContext(AppNavigateContext)
  if (!navigate) {
    throw new Error('useAppNavigate must be used within Layout')
  }
  return navigate
}

export function useAppViewRoute(): AppRouteTarget {
  const viewRoute = useContext(AppViewRouteContext)
  if (!viewRoute) {
    throw new Error('useAppViewRoute must be used within Layout')
  }
  return viewRoute
}

export function TabPanelRouteProvider({
  route,
  children,
}: {
  route: AppRouteTarget
  children: React.ReactNode
}) {
  return (
    <TabPanelRouteContext.Provider value={route}>{children}</TabPanelRouteContext.Provider>
  )
}

/** Route for the current tab panel (pathname + search). Prefer over useAppViewRoute for page params. */
export function useTabPanelRoute(): AppRouteTarget {
  const tabRoute = useContext(TabPanelRouteContext)
  const viewRoute = useContext(AppViewRouteContext)
  if (tabRoute) return tabRoute
  if (viewRoute) return viewRoute
  throw new Error('useTabPanelRoute must be used within Layout')
}

type AppLinkProps = {
  to: string
  className?: string
  children: React.ReactNode
  replace?: boolean
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'>

export function AppLink({ to, className, children, replace, ...rest }: AppLinkProps) {
  const navigate = useAppNavigate()
  return (
    <button type="button" className={className} onClick={() => navigate(to, { replace })} {...rest}>
      {children}
    </button>
  )
}
