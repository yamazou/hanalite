import type {
  DraftCreatePayload,
  DraftDetail,
  DraftLineInput,
  DraftListItem,
  DraftStatus,
  Item,
  Supplier,
} from '../types'
import type {
  ItemDetail,
  ItemListRow,
  ItemPayload,
  ItemSearchRow,
  ItemTyp,
  MoveTypMaster,
  SupplierMaster,
} from '../types/masters'
import type {
  BalanceItem,
  CurrentStock,
  GrgiCreatePayload,
  GrgiHistory,
  LotTraceResult,
  MoveTyp,
} from '../types/inventory'

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? ''
const API_PREFIX = '/api/v1'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${API_PREFIX}${path}`
  const headers = new Headers(options?.headers)
  if (!headers.has('Content-Type') && options?.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(url, {
    ...options,
    headers,
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (body.detail) {
        detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
      }
    } catch {
      /* ignore */
    }
    if (res.status === 404 && path.startsWith('/inventory/')) {
      detail =
        'Inventory API not found. Restart the backend (run start-hanalite.bat) so the latest API is loaded.'
    }
    throw new Error(detail)
  }

  if (res.status === 204) {
    return undefined as T
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  listDrafts: (status?: DraftStatus) => {
    const q = status ? `?status=${status}` : ''
    return request<DraftListItem[]>(`/receipt-drafts${q}`)
  },

  getDraft: (id: number) => request<DraftDetail>(`/receipt-drafts/${id}`),

  createDraft: (payload: DraftCreatePayload) =>
    request<DraftDetail>('/receipt-drafts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  approveDraft: (id: number) =>
    request<DraftDetail>(`/receipt-drafts/${id}/approve`, { method: 'POST' }),

  cancelDraft: (id: number) =>
    request<DraftDetail>(`/receipt-drafts/${id}/cancel`, { method: 'POST' }),

  listItems: () => request<Item[]>('/masters/items'),
  listSuppliers: () => request<Supplier[]>('/masters/suppliers'),

  listItemtyps: () => request<ItemTyp[]>('/masters/itemtyps'),
  createItemTyp: (itemtyp_nm: string) =>
    request<ItemTyp>('/masters/itemtyps', {
      method: 'POST',
      body: JSON.stringify({ itemtyp_nm }),
    }),
  deleteItemTyp: (itemtyp_id: number) =>
    request<void>(`/masters/itemtyps/${itemtyp_id}`, { method: 'DELETE' }),

  listSuppliersMaster: () => request<SupplierMaster[]>('/masters/suppliers'),
  createSupplier: (suppliers_nm: string) =>
    request<SupplierMaster>('/masters/suppliers', {
      method: 'POST',
      body: JSON.stringify({ suppliers_nm }),
    }),
  deleteSupplier: (suppliers_id: number) =>
    request<void>(`/masters/suppliers/${suppliers_id}`, { method: 'DELETE' }),

  listMovetypsMaster: () => request<MoveTypMaster[]>('/masters/movetyps'),
  createMoveTyp: (movetyps_nm: string) =>
    request<MoveTypMaster>('/masters/movetyps', {
      method: 'POST',
      body: JSON.stringify({ movetyps_nm }),
    }),
  deleteMoveTyp: (movetyps_id: number) =>
    request<void>(`/masters/movetyps/${movetyps_id}`, { method: 'DELETE' }),

  listItemsMaster: () => request<ItemListRow[]>('/masters/items'),
  searchItems: (q: string, limit = 20) =>
    request<ItemSearchRow[]>(
      `/masters/items/search?q=${encodeURIComponent(q)}&limit=${limit}`
    ),
  getItem: (item_id: number) => request<ItemDetail>(`/masters/items/${item_id}`),
  createItem: (payload: ItemPayload) =>
    request<ItemDetail>('/masters/items', { method: 'POST', body: JSON.stringify(payload) }),
  updateItem: (item_id: number, payload: ItemPayload) =>
    request<ItemDetail>(`/masters/items/${item_id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteItem: (item_id: number) =>
    request<void>(`/masters/items/${item_id}`, { method: 'DELETE' }),

  listBoms: (p_item_id?: number) => {
    const q = p_item_id != null ? `?p_item_id=${p_item_id}` : ''
    return request<BomRow[]>(`/boms${q}`)
  },

  createBom: (payload: BomCreatePayload) =>
    request<BomRow>('/boms', { method: 'POST', body: JSON.stringify(payload) }),

  updateBom: (bom_id: number, payload: BomUpdatePayload) =>
    request<BomRow>(`/boms/${bom_id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  deleteBom: (bom_id: number) => request<void>(`/boms/${bom_id}`, { method: 'DELETE' }),

  downloadTemplate: async () => {
    const url = `${API_BASE}${API_PREFIX}/receipt-drafts/template`
    const res = await fetch(url)
    if (!res.ok) throw new Error('テンプレートのダウンロードに失敗しました')
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'hanalite_receipt_template.xlsx'
    a.click()
    URL.revokeObjectURL(a.href)
  },

  importExcel: async (
    file: File,
    fields: {
      receipt_at?: string
      suppliers_id?: number
      reference_no?: string
      notes?: string
    }
  ) => {
    const form = new FormData()
    form.append('file', file)
    if (fields.receipt_at) form.append('receipt_at', fields.receipt_at)
    if (fields.suppliers_id != null) form.append('suppliers_id', String(fields.suppliers_id))
    if (fields.reference_no) form.append('reference_no', fields.reference_no)
    if (fields.notes) form.append('notes', fields.notes)
    return request<DraftDetail>('/receipt-drafts/import', {
      method: 'POST',
      body: form,
    })
  },

  importPdf: async (
    file: File,
    fields: {
      receipt_at?: string
      suppliers_id?: number
      reference_no?: string
      notes?: string
    }
  ) => {
    const form = new FormData()
    form.append('file', file)
    if (fields.receipt_at) form.append('receipt_at', fields.receipt_at)
    if (fields.suppliers_id != null) form.append('suppliers_id', String(fields.suppliers_id))
    if (fields.reference_no) form.append('reference_no', fields.reference_no)
    if (fields.notes) form.append('notes', fields.notes)
    return request<DraftDetail>('/receipt-drafts/import-pdf', {
      method: 'POST',
      body: form,
    })
  },

  addDraftLine: (draftId: number, line: DraftLineInput) =>
    request<DraftDetail>(`/receipt-drafts/${draftId}/lines`, {
      method: 'POST',
      body: JSON.stringify(line),
    }),

  attachmentUrl: (draftId: number) =>
    `${API_BASE}${API_PREFIX}/receipt-drafts/${draftId}/attachment`,

  listCurrentStock: (params?: { lot?: string; item_id?: number; include_zero?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.lot) q.set('lot', params.lot)
    if (params?.item_id != null) q.set('item_id', String(params.item_id))
    if (params?.include_zero) q.set('include_zero', 'true')
    const qs = q.toString()
    return request<CurrentStock[]>(`/inventory/currents${qs ? `?${qs}` : ''}`)
  },

  listGrgiHistory: (limit = 50) =>
    request<GrgiHistory[]>(`/inventory/grgi?limit=${limit}`),

  listMovetyps: () => request<MoveTyp[]>('/inventory/movetyps'),

  createGrgi: (payload: GrgiCreatePayload) =>
    request<GrgiHistory>('/inventory/grgi', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  traceLot: (lot: string) =>
    request<LotTraceResult>(`/inventory/trace?lot=${encodeURIComponent(lot)}`),

  listBalances: (period?: string) => {
    const q = period ? `?period=${period}` : ''
    return request<BalanceItem[]>(`/inventory/balances${q}`)
  },

  createPeriodBalance: (period: string) =>
    request<{ period_year_month: string; rows_saved: number }>(
      `/inventory/balances?period=${period}`,
      { method: 'POST' }
    ),
}
