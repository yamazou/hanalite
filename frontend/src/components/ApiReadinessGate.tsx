import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { HANALITE_APP_URL, probeApiHealth } from '../api/client'

const MAX_ATTEMPTS = 45
const RETRY_MS = 2000

type Props = {
  children: ReactNode
}

type GatePhase = 'checking' | 'ready' | 'unreachable' | 'database'

export function ApiReadinessGate({ children }: Props) {
  const [phase, setPhase] = useState<GatePhase>('checking')
  const [attempt, setAttempt] = useState(0)
  const [databaseError, setDatabaseError] = useState<string | null>(null)

  const check = useCallback(async () => {
    setPhase('checking')
    setDatabaseError(null)
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      setAttempt(i + 1)
      const result = await probeApiHealth()
      if (result.state === 'ready') {
        setPhase('ready')
        return
      }
      if (result.state === 'database') {
        setDatabaseError(result.error)
        setPhase('database')
        return
      }
      await new Promise((r) => setTimeout(r, RETRY_MS))
    }
    setPhase('unreachable')
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  if (phase === 'ready') return <>{children}</>

  return (
    <div className="erp-panel api-readiness-panel">
      <div className="erp-panel-title">hanalite</div>
      <div className="erp-panel-content">
        {phase === 'database' ? (
          <>
            <p className="muted erp-grid-empty">
              The API is running, but MySQL is not connected. Start <strong>MySQL</strong> in XAMPP,
              confirm the database <strong>hanalite</strong> exists, then click Retry.
            </p>
            {databaseError ? (
              <p className="muted erp-grid-empty api-readiness-detail">{databaseError}</p>
            ) : null}
            <button type="button" className="btn erp-btn erp-btn-search" onClick={() => void check()}>
              Retry
            </button>
          </>
        ) : phase === 'unreachable' ? (
          <>
            <p className="muted erp-grid-empty">
              Cannot reach the hanalite API. Start MySQL in XAMPP, run <strong>start-hanalite.bat</strong>,
              and wait until the <strong>hanalite api</strong> window shows{' '}
              <strong>Application startup complete</strong>.
            </p>
            <p className="muted erp-grid-empty">
              Open <a href={HANALITE_APP_URL}>{HANALITE_APP_URL}</a> (port <strong>5180</strong>, not
              8000). If you opened the page too early, click Retry after both API and UI windows are
              ready.
            </p>
            <button type="button" className="btn erp-btn erp-btn-search" onClick={() => void check()}>
              Retry
            </button>
          </>
        ) : (
          <>
            <p className="muted erp-grid-empty">
              Waiting for API… ({attempt}/{MAX_ATTEMPTS})
            </p>
            <p className="muted erp-grid-empty">
              Run <strong>start-hanalite.bat</strong> and wait for <strong>Application startup complete</strong>{' '}
              in the <strong>hanalite api</strong> window. If it is already running, click Retry.
            </p>
            <button
              type="button"
              className="btn erp-btn erp-btn-clear"
              onClick={() => void check()}
            >
              Retry now
            </button>
          </>
        )}
      </div>
    </div>
  )
}
