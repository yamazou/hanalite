import { FormEvent, useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { LoginCompany } from '../types/auth'

export function LoginPage() {
  const { login } = useAuth()
  const [companies, setCompanies] = useState<LoginCompany[]>([])
  const [companyCd, setCompanyCd] = useState('')
  const [userCd, setUserCd] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await api.listLoginCompanies()
        if (cancelled) return
        setCompanies(rows)
        if (rows.length === 1) setCompanyCd(rows[0].company_cd)
      } catch {
        if (!cancelled) setError('Cannot load company list. Check that the API is running.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(companyCd, userCd, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={(e) => void onSubmit(e)}>
        <div className="login-brand">
          <img
            src="/hanalite-logo.png"
            alt="hanalite - Visual Management"
            className="login-logo"
            width={196}
            height={64}
          />
        </div>
        <p className="login-subtitle">Sign in with your company, user id, and password.</p>
        <label>
          Company Code
          {companies.length > 0 ? (
            <select
              value={companyCd}
              onChange={(e) => setCompanyCd(e.target.value)}
              required
            >
              <option value="">Select company…</option>
              {companies.map((c) => (
                <option key={c.co_id} value={c.company_cd}>
                  {c.company_cd} — {c.company_nm}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={companyCd}
              onChange={(e) => setCompanyCd(e.target.value)}
              autoComplete="organization"
              required
            />
          )}
        </label>
        <label>
          User ID
          <input
            value={userCd}
            onChange={(e) => setUserCd(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <p className="login-error">{error}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="login-hint">Default: Company DEMO, User admin, Password admin</p>
      </form>
    </div>
  )
}
