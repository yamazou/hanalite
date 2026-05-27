export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ja-JP', {
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
  return n.toLocaleString('ja-JP', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

export function formatItemLabel(item: { item_cd?: string; item_nm: string; item_id?: number }): string {
  if (item.item_cd) return `${item.item_cd} — ${item.item_nm}`
  if (item.item_id != null) return `${item.item_nm} (ID:${item.item_id})`
  return item.item_nm
}

export function toDatetimeLocalValue(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function datetimeLocalToIso(local: string): string {
  return new Date(local).toISOString()
}

export const statusLabel: Record<string, string> = {
  registered: '登録済（未承認）',
  approved: '承認済',
  cancelled: 'キャンセル',
}
