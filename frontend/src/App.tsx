import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { appRouteObjects } from './appRoutes'
import { ApiReadinessGate } from './components/ApiReadinessGate'
import { Layout } from './components/Layout'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'

function layoutChildRoutes() {
  return appRouteObjects.map((route, index) => {
    if (route.index) {
      return <Route key={`route-index-${index}`} index element={route.element} />
    }
    if (route.path === '*') {
      return <Route key="route-catch-all" path="*" element={route.element} />
    }
    return <Route key={route.path ?? index} path={route.path!} element={route.element} />
  })
}

function AuthenticatedApp() {
  const { session, loading } = useAuth()
  if (loading) {
    return <div className="login-screen"><p>Loading…</p></div>
  }
  if (!session) {
    return <LoginPage />
  }
  return (
    <Routes>
      <Route element={<Layout />}>{layoutChildRoutes()}</Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ApiReadinessGate>
          <AuthenticatedApp />
        </ApiReadinessGate>
      </BrowserRouter>
    </AuthProvider>
  )
}
