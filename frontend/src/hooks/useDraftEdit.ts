import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { DraftVariant } from '../config/draftPages'
import type { DraftDetail, Item, Supplier } from '../types'
import type { LocationMaster } from '../types/masters'
import {
  type EditLineRow,
  type HeaderEdit,
  activeEditLines,
  emptyEditLine,
  headerEditFromDraft,
  lineToEditRow,
} from '../utils/draftEdit'
import { datetimeLocalToIso } from '../utils/format'

export function useDraftEdit(
  draftId: number | null,
  variant: DraftVariant,
  refreshToken: number
) {
  const [draft, setDraft] = useState<DraftDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [locations, setLocations] = useState<LocationMaster[]>([])
  const [headerEdit, setHeaderEdit] = useState<HeaderEdit | null>(null)
  const [editLines, setEditLines] = useState<EditLineRow[]>([])

  const canEdit = draft?.status === 'registered'

  const load = useCallback(async () => {
    if (!draftId) {
      setDraft(null)
      setHeaderEdit(null)
      setEditLines([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const data = await api.getDraft(draftId, variant)
      setDraft(data)
      if (data.status === 'registered') {
        setHeaderEdit(headerEditFromDraft(data))
        setEditLines(data.lines.map(lineToEditRow))
      } else {
        setHeaderEdit(null)
        setEditLines([])
      }
      setRowError(null)
    } catch (e) {
      setDraft(null)
      setHeaderEdit(null)
      setEditLines([])
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [draftId, variant])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  useEffect(() => {
    if (!canEdit) return
    Promise.all([
      api.listItems(),
      api.listSuppliers(),
      api.listLocationsMaster(),
    ])
      .then(([i, s, l]) => {
        setItems(i)
        setSuppliers(s)
        setLocations(l)
      })
      .catch(() => {
        setItems([])
        setSuppliers([])
        setLocations([])
      })
  }, [canEdit])

  const patchHeader = (patch: Partial<HeaderEdit>) => {
    setHeaderEdit((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const updateLine = (key: string, patch: Partial<EditLineRow>) => {
    setEditLines((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const addRow = () => {
    setRowError(null)
    setEditLines((prev) => [...prev, emptyEditLine(prev.length + 1)])
  }

  const removeRow = (key: string) => {
    setEditLines((prev) =>
      prev.filter((row) => row.key !== key).map((row, index) => ({ ...row, line_no: index + 1 }))
    )
    setRowError(null)
  }

  const buildPayloadLines = () => {
    return activeEditLines(editLines).map((row, index) => ({
      ...(row.item_id !== '' ? { item_id: Number(row.item_id) } : { item_id: null }),
      item_cd: row.item_cd.trim() || null,
      item_nm: row.item_nm.trim() || null,
      location_id: Number(row.location_id),
      lot: row.lot.trim(),
      qty: Number(row.qty),
      line_no: index + 1,
      ...(row.inv_receipt_draft_line_id
        ? { inv_receipt_draft_line_id: row.inv_receipt_draft_line_id }
        : {}),
    }))
  }

  const save = async () => {
    if (!draft || !canEdit || !headerEdit) return false
    setError(null)
    setMessage(null)
    setRowError(null)
    const payloadLines = buildPayloadLines()
    if (payloadLines.length === 0) {
      setRowError('line_validation')
      return false
    }
    setSaving(true)
    try {
      const updated = await api.updateDraft(
        draft.inv_receipt_draft_id,
        {
          receipt_at: datetimeLocalToIso(headerEdit.receiptAt),
          suppliers_id: headerEdit.suppliersId === '' ? null : headerEdit.suppliersId,
          reference_no: headerEdit.referenceNo.trim() || null,
          notes: headerEdit.notes.trim() || null,
          lines: payloadLines,
        },
        variant
      )
      setDraft(updated)
      if (updated.status === 'registered') {
        setHeaderEdit(headerEditFromDraft(updated))
        setEditLines(updated.lines.map(lineToEditRow))
      }
      setMessage('Saved.')
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
      return false
    } finally {
      setSaving(false)
    }
  }

  return {
    draft,
    loading,
    error,
    rowError,
    message,
    saving,
    canEdit,
    headerEdit,
    patchHeader,
    editLines,
    updateLine,
    addRow,
    removeRow,
    items,
    suppliers,
    locations,
    save,
    setError,
    setMessage,
    setRowError,
  }
}
