import type { ReactNode } from 'react'
import { Alert } from '../Alert'

type Props = {
  children: ReactNode
  error?: string | null
  success?: string | null
  className?: string
}

export function ErpScreen({ children, error, success, className }: Props) {
  return (
    <div className={`erp-screen${className ? ` ${className}` : ''}`}>
      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}
      {children}
    </div>
  )
}
