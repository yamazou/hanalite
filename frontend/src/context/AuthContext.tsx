import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, setApiAuthToken, setApiUnauthorizedHandler } from '../api/client'
import { clearStoredAuth, readStoredAuth, writeStoredAuth } from '../auth/storage'
import type { LoginResponse, UserSession } from '../types/auth'

type AuthContextValue = {
  session: UserSession | null
  accessToken: string | null
  loading: boolean
  login: (companyCd: string, userCd: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [session, setSession] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)

  const applyAuth = useCallback((token: string | null, user: UserSession | null) => {
    setAccessToken(token)
    setSession(user)
    setApiAuthToken(token)
  }, [])

  const logout = useCallback(() => {
    clearStoredAuth()
    applyAuth(null, null)
  }, [applyAuth])

  useEffect(() => {
    const stored = readStoredAuth()
    if (stored) {
      applyAuth(stored.access_token, stored.user)
    }
    setLoading(false)
  }, [applyAuth])

  useEffect(() => {
    setApiUnauthorizedHandler(() => logout())
    return () => setApiUnauthorizedHandler(null)
  }, [logout])

  const login = useCallback(
    async (companyCd: string, userCd: string, password: string) => {
      const res: LoginResponse = await api.login({
        company_cd: companyCd.trim(),
        user_cd: userCd.trim(),
        password,
      })
      writeStoredAuth({ access_token: res.access_token, user: res.user })
      applyAuth(res.access_token, res.user)
    },
    [applyAuth]
  )

  const value = useMemo(
    () => ({ session, accessToken, loading, login, logout }),
    [session, accessToken, loading, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** localStorage scope for Save Grid (company + user). */
export function useGridLayoutScope(): string | undefined {
  const ctx = useContext(AuthContext)
  const session = ctx?.session
  if (!session) return undefined
  return `${session.co_id}:${session.user_id}`
}
