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
  ItemProcMaster,
  LocationMaster,
  SupplierMaster,
} from '../types/masters'
import type {
  BalanceItem,
  CurrentStock,
  GrgiCreatePayload,
  GrgiHistory,
  LocationMovePayload,
  LotTraceResult,
  MoveTyp,
} from '../types/inventory'
import type {
  ProductionOrderCreatePayload,
  ProductionOrderDetail,
  ProductionOrderListItem,
  ProductionOrderUpdatePayload,
} from '../types/production'

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? ''
const API_PREFIX = '/api/v1'
export type DraftListFilters = {
  status?: DraftStatus
  date_from?: string
  date_to?: string
  suppliers_id?: number
  reference_no?: string
  item_id?: number
  lot?: string
}

type DraftKind = 'receipt' | 'delivery'

function draftBase(kind: DraftKind) {
  return kind === 'delivery' ? '/sls-delivery-drafts' : '/pch-receipt-drafts'
}

function normalizeListItem(kind: DraftKind, row: any): DraftListItem {
  if (kind === 'receipt') return row as DraftListItem
  return {
    inv_receipt_draft_id: row.sls_delivery_draft_id,
    status: row.status,
    source_type: row.source_type,
    receipt_at: row.delivery_at,
    reference_no: row.reference_no,
    supplier_nm: row.supplier_nm,
    notes: row.notes ?? null,
    line_count: row.line_count,
    approved_at: row.approved_at ?? null,
    cancelled_at: row.cancelled_at ?? null,
    created_at: row.created_at,
    has_attachment: false,
    parse_message: null,
  }
}

function normalizeDetail(kind: DraftKind, row: any): DraftDetail {
  if (kind === 'receipt') return row as DraftDetail
  return {
    inv_receipt_draft_id: row.sls_delivery_draft_id,
    status: row.status,
    source_type: row.source_type,
    receipt_at: row.delivery_at,
    suppliers_id: row.suppliers_id,
    supplier_nm: row.supplier_nm,
    reference_no: row.reference_no,
    notes: row.notes,
    approved_at: row.approved_at,
    cancelled_at: row.cancelled_at,
    created_at: row.created_at,
    attachment_original_name: null,
    has_attachment: false,
    parse_message: null,
    lines: (row.lines ?? []).map((ln: any) => ({
      inv_receipt_draft_line_id: ln.sls_delivery_draft_line_id,
      line_no: ln.line_no,
      item_id: ln.item_id,
      location_id: ln.location_id,
      location_cd: ln.location_cd,
      location_nm: ln.location_nm,
      item_nm: ln.item_nm,
      lot: ln.lot,
      qty: ln.qty,
    })),
  }
}

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

  listDrafts: async (filters: DraftListFilters = {}, kind: DraftKind = 'receipt') => {
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)
    if (filters.suppliers_id != null) params.set('suppliers_id', String(filters.suppliers_id))
    if (filters.reference_no?.trim()) params.set('reference_no', filters.reference_no.trim())
    if (filters.item_id != null) params.set('item_id', String(filters.item_id))
    if (filters.lot?.trim()) params.set('lot', filters.lot.trim())
    const q = params.toString()
    const rows = await request<any[]>(`${draftBase(kind)}${q ? `?${q}` : ''}`)
    return rows.map((row) => normalizeListItem(kind, row))
  },

  getDraft: async (id: number, kind: DraftKind = 'receipt') => {
    const row = await request<any>(`${draftBase(kind)}/${id}`)
    return normalizeDetail(kind, row)
  },

  createDraft: async (payload: DraftCreatePayload, kind: DraftKind = 'receipt') => {
    const body =
      kind === 'delivery'
        ? { ...payload, delivery_at: payload.receipt_at, receipt_at: undefined }
        : payload
    const row = await request<any>(draftBase(kind), {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return normalizeDetail(kind, row)
  },

  updateDraft: async (id: number, payload: DraftCreatePayload, kind: DraftKind = 'receipt') => {
    const lines =
      kind === 'delivery'
        ? payload.lines.map((ln) => ({
            ...ln,
            sls_delivery_draft_line_id: ln.inv_receipt_draft_line_id,
            inv_receipt_draft_line_id: undefined,
          }))
        : payload.lines
    const body =
      kind === 'delivery'
        ? { ...payload, lines, delivery_at: payload.receipt_at, receipt_at: undefined }
        : { ...payload, lines }
    const row = await request<any>(`${draftBase(kind)}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
    return normalizeDetail(kind, row)
  },

  approveDraft: async (id: number, kind: DraftKind = 'receipt') => {
    const row = await request<any>(`${draftBase(kind)}/${id}/approve`, { method: 'POST' })
    return normalizeDetail(kind, row)
  },

  cancelDraft: async (id: number, kind: DraftKind = 'receipt') => {
    const row = await request<any>(`${draftBase(kind)}/${id}/cancel`, { method: 'POST' })
    return normalizeDetail(kind, row)
  },

  restoreDraft: async (id: number, kind: DraftKind = 'receipt') => {
    const row = await request<any>(`${draftBase(kind)}/${id}/restore`, { method: 'POST' })
    return normalizeDetail(kind, row)
  },

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

  listLocationsMaster: () => request<LocationMaster[]>('/masters/locations'),
  createLocation: (location_cd: string, location_nm: string) =>
    request<LocationMaster>('/masters/locations', {
      method: 'POST',
      body: JSON.stringify({ location_cd, location_nm }),
    }),
  updateLocation: (location_id: number, location_cd: string, location_nm: string) =>
    request<LocationMaster>(`/masters/locations/${location_id}`, {
      method: 'PUT',
      body: JSON.stringify({ location_cd, location_nm }),
    }),
  deleteLocation: (location_id: number) =>
    request<void>(`/masters/locations/${location_id}`, { method: 'DELETE' }),

  listItemprocsMaster: () => request<ItemProcMaster[]>('/masters/itemprocs'),
  createItemproc: (payload: {
    item_id: number
    process_no: number
    process_nm: string
    rm_location_id: number
    wip_location_id: number
  }) =>
    request<ItemProcMaster>('/masters/itemprocs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateItemproc: (
    itemproc_id: number,
    payload: {
      process_no?: number
      process_nm?: string
      rm_location_id?: number
      wip_location_id?: number
    }
  ) =>
    request<ItemProcMaster>(`/masters/itemprocs/${itemproc_id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteItemproc: (itemproc_id: number) =>
    request<void>(`/masters/itemprocs/${itemproc_id}`, { method: 'DELETE' }),

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

  downloadTemplate: async (kind: DraftKind = 'receipt') => {
    const url = `${API_BASE}${API_PREFIX}${draftBase(kind)}/template`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to download template.')
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = kind === 'delivery' ? 'hanalite_delivery_template.xlsx' : 'hanalite_receipt_template.xlsx'
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
    },
    kind: DraftKind = 'receipt'
  ) => {
    const form = new FormData()
    form.append('file', file)
    if (fields.suppliers_id != null) form.append('suppliers_id', String(fields.suppliers_id))
    if (fields.reference_no) form.append('reference_no', fields.reference_no)
    if (fields.notes) form.append('notes', fields.notes)
    const path = kind === 'delivery' ? '/sls-delivery-drafts/import' : '/pch-receipt-drafts/import'
    if (kind === 'delivery' && fields.receipt_at) {
      form.append('delivery_at', fields.receipt_at)
    } else if (fields.receipt_at) {
      form.append('receipt_at', fields.receipt_at)
    }
    const row = await request<any>(path, {
      method: 'POST',
      body: form,
    })
    return normalizeDetail(kind, row)
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
    return request<DraftDetail>('/pch-receipt-drafts/import-pdf', {
      method: 'POST',
      body: form,
    })
  },

  addDraftLine: async (draftId: number, line: DraftLineInput, kind: DraftKind = 'receipt') => {
    const row = await request<any>(`${draftBase(kind)}/${draftId}/lines`, {
      method: 'POST',
      body: JSON.stringify(line),
    })
    return normalizeDetail(kind, row)
  },

  attachmentUrl: (draftId: number, kind: DraftKind = 'receipt') =>
    `${API_BASE}${API_PREFIX}${draftBase(kind)}/${draftId}/attachment`,

  listCurrentStock: (params?: {
    lot?: string
    item_id?: number
    location_id?: number
    include_zero?: boolean
  }) => {
    const q = new URLSearchParams()
    if (params?.lot) q.set('lot', params.lot)
    if (params?.item_id != null) q.set('item_id', String(params.item_id))
    if (params?.location_id != null) q.set('location_id', String(params.location_id))
    if (params?.include_zero) q.set('include_zero', 'true')
    const qs = q.toString()
    return request<CurrentStock[]>(`/inventory/currents${qs ? `?${qs}` : ''}`)
  },

  listGrgiHistory: (limit = 50, location_id?: number) =>
    request<GrgiHistory[]>(
      `/inventory/grgi?limit=${limit}${location_id != null ? `&location_id=${location_id}` : ''}`
    ),

  listMovetyps: () => request<MoveTyp[]>('/inventory/movetyps'),

  createGrgi: (payload: GrgiCreatePayload) =>
    request<GrgiHistory>('/inventory/grgi', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createLocationMove: (payload: LocationMovePayload) =>
    request<GrgiHistory[]>('/inventory/move', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  traceLot: (lot: string, location_id?: number) =>
    request<LotTraceResult>(
      `/inventory/trace?lot=${encodeURIComponent(lot)}${
        location_id != null ? `&location_id=${location_id}` : ''
      }`
    ),

  listBalances: (period?: string, location_id?: number) => {
    const q = period ? `?period=${period}` : ''
    const sep = q ? '&' : '?'
    const q2 = location_id != null ? `${q}${sep}location_id=${location_id}` : q
    return request<BalanceItem[]>(`/inventory/balances${q2}`)
  },

  createPeriodBalance: (period: string, location_id?: number) =>
    request<{ period_year_month: string; rows_saved: number }>(
      `/inventory/balances?period=${period}${location_id != null ? `&location_id=${location_id}` : ''}`,
      { method: 'POST' }
    ),

  listProductionOrders: (status?: string) =>
    request<ProductionOrderListItem[]>(
      `/production/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`
    ),
  getProductionOrder: (order_id: number) =>
    request<ProductionOrderDetail>(`/production/orders/${order_id}`),
  createProductionOrder: (payload: ProductionOrderCreatePayload) =>
    request<ProductionOrderDetail>('/production/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProductionOrder: (order_id: number, payload: ProductionOrderUpdatePayload) =>
    request<ProductionOrderDetail>(`/production/orders/${order_id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  recalculateProductionInputs: (order_id: number, basis_qty: number) =>
    request<ProductionOrderDetail>(`/production/orders/${order_id}/recalculate-inputs`, {
      method: 'POST',
      body: JSON.stringify({ basis_qty }),
    }),
  completeProductionOrder: (order_id: number, actual_qty: number) =>
    request<ProductionOrderDetail>(`/production/orders/${order_id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ actual_qty }),
    }),
  completeProductionLine: (order_id: number, line_id: number, actual_qty: number) =>
    request<ProductionOrderDetail>(
      `/production/orders/${order_id}/lines/${line_id}/complete`,
      {
        method: 'POST',
        body: JSON.stringify({ actual_qty }),
      }
    ),
  deleteProductionOrder: (order_id: number) =>
    request<void>(`/production/orders/${order_id}`, { method: 'DELETE' }),
  approveProductionOrder: (order_id: number) =>
    request<ProductionOrderDetail>(`/production/orders/${order_id}/approve`, { method: 'POST' }),
  cancelProductionOrder: (order_id: number) =>
    request<ProductionOrderDetail>(`/production/orders/${order_id}/cancel`, { method: 'POST' }),
}
