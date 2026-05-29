import type { DraftStatus } from '../types'
import type { ProductionStatus } from '../types/production'
import { statusLabel } from '../utils/format'

const classMap: Record<string, string> = {
  registered: 'badge-registered',
  approved: 'badge-approved',
  started: 'badge-started',
  completed: 'badge-completed',
  cancelled: 'badge-cancelled',
}

export function StatusBadge({
  status,
  labels = statusLabel,
}: {
  status: DraftStatus | ProductionStatus
  labels?: Record<string, string>
}) {
  return (
    <span className={`badge ${classMap[status]}`}>
      {labels[status] ?? status}
    </span>
  )
}
