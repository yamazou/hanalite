export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
    if (m) return `${m[2]}/${m[3]}/${m[1]}`
    return iso
  }
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatQty(qty: string | number): string {
  const n = typeof qty === 'string' ? parseFloat(qty) : qty
  if (Number.isNaN(n)) return String(qty)
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

export function formatItemLabel(item: { item_cd?: string; item_nm: string; item_id?: number }): string {
  if (item.item_cd) return `${item.item_cd} — ${item.item_nm}`
  if (item.item_id != null) return `${item.item_nm} (ID:${item.item_id})`
  return item.item_nm
}

export function toDateInputValue(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseDateInputValue(iso: string | null | undefined): string {
  if (!iso) return toDateInputValue()
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso)
    return m ? m[1] : toDateInputValue()
  }
  return toDateInputValue(d)
}

export function toDatetimeLocalValue(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function datetimeLocalToIso(local: string): string {
  return new Date(local).toISOString()
}

/** Date-only input (YYYY-MM-DD) to ISO datetime at local midnight for API. */
export function dateInputToIso(dateStr: string): string {
  if (!dateStr) return new Date().toISOString()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim())
  if (!m) return new Date(dateStr).toISOString()
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  return new Date(y, mo - 1, d, 0, 0, 0, 0).toISOString()
}

export const statusLabel: Record<string, string> = {
  registered: 'Registered',
  approved: 'Approved',
  cancelled: 'Cancelled',
}

/** Production orders: UI label for status `approved` is "Ordered". */
export const productionStatusLabel: Record<string, string> = {
  registered: 'Registered',
  approved: 'Ordered',
  completed: 'Completed',
}
