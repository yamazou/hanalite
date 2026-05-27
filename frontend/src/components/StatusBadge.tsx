import type { DraftStatus } from '../types'
import { statusLabel } from '../utils/format'

const classMap: Record<DraftStatus, string> = {
  registered: 'badge-registered',
  approved: 'badge-approved',
  cancelled: 'badge-cancelled',
}

export function StatusBadge({ status }: { status: DraftStatus }) {
  return (
    <span className={`badge ${classMap[status]}`}>
      {statusLabel[status] ?? status}
    </span>
  )
}
