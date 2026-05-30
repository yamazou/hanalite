import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { DraftVariant } from '../config/draftPages'
import type { DraftDetail } from '../types'
import { useMasterCatalog } from '../context/MasterCatalogContext'
import {
  type EditLineRow,
  type HeaderEdit,
  activeEditLines,
  draftLinesSaveError,
  emptyEditLine,
  findItemByCd,
  findItemByNm,
  headerEditFromDraft,
  isBlankDraftLine,
  lineToEditRow,
} from '../utils/draftEdit'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../utils/gridTrailingBlankRow'
import { mergeDraftLineImportRows } from '../utils/draftLineExcelImport'
import { dateInputToIso } from '../utils/format'

type UseDraftEditOptions = {
  /** Receipt List: do not track or patch header fields in the list UI. */
  listLinesOnly?: boolean
}

export function useDraftEdit(
  draftId: number | null,
  variant: DraftVariant,
  refreshToken: number,
  options?: UseDraftEditOptions
) {
  const listLinesOnly = options?.listLinesOnly === true
  const [draft, setDraft] = useState<DraftDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { items, suppliers, locations } = useMasterCatalog()
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
        setHeaderEdit(listLinesOnly ? null : headerEditFromDraft(data))
        setEditLines(
          ensureTrailingBlankRow(
            data.lines.map(lineToEditRow),
            isBlankDraftLine,
            (rows) => emptyEditLine(rows.length + 1)
          )
        )
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
  }, [draftId, variant, listLinesOnly])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  useEffect(() => {
    if (!canEdit || items.length === 0 || editLines.length === 0) return
    setEditLines((prev) => {
      let changed = false
      const next = prev.map((row) => {
        if (row.itemtyp_id !== '') return row
        const item =
          findItemByCd(items, row.item_cd) ?? findItemByNm(items, row.item_nm)
        if (!item) return row
        changed = true
        return {
          ...row,
          item_id: row.item_id === '' ? item.item_id : row.item_id,
          itemtyp_id: item.itemtyp_id,
          item_cd: row.item_cd.trim() ? row.item_cd : item.item_cd,
          item_nm: row.item_nm.trim() ? row.item_nm : item.item_nm,
        }
      })
      return changed ? next : prev
    })
  }, [canEdit, items, draft?.inv_receipt_draft_id])

  const patchHeader = (patch: Partial<HeaderEdit>) => {
    if (listLinesOnly) return
    setHeaderEdit((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const updateLine = (key: string, patch: Partial<EditLineRow>) => {
    setRowError(null)
    setEditLines((prev) =>
      updateRowWithTrailingBlank(
        prev,
        key,
        patch,
        isBlankDraftLine,
        (rows) => emptyEditLine(rows.length + 1)
      ).map((row, index) => ({ ...row, line_no: index + 1 }))
    )
  }

  const removeRows = (keys: string[]) => {
    if (keys.length === 0) return
    const drop = new Set(keys)
    setEditLines((prev) =>
      ensureTrailingBlankRow(
        prev
          .filter((row) => !drop.has(row.key))
          .map((row, index) => ({ ...row, line_no: index + 1 })),
        isBlankDraftLine,
        (rows) => emptyEditLine(rows.length + 1)
      )
    )
    setRowError(null)
  }

  const removeRow = (key: string) => {
    removeRows([key])
  }

  const importLines = (parsed: Record<string, string>[]) => {
    setRowError(null)
    let added = 0
    setEditLines((prev) => {
      const result = mergeDraftLineImportRows(parsed, prev, items, locations)
      added = result.added
      return ensureTrailingBlankRow(
        result.rows.map((row, index) => ({ ...row, line_no: index + 1 })),
        isBlankDraftLine,
        (rows) => emptyEditLine(rows.length + 1)
      )
    })
    setMessage(
      added > 0
        ? `Imported ${added} line(s) from Excel. Review and save.`
        : 'No lines were added from the file.'
    )
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

  type SaveDraftOptions = {
    /** Keep header from loaded draft; update lines only (Receipt List policy). */
    linesOnly?: boolean
  }

  const save = async (options?: SaveDraftOptions) => {
    if (!draft || !canEdit) return false
    const headerForSave =
      options?.linesOnly ? headerEditFromDraft(draft) : headerEdit
    if (!headerForSave) return false
    setError(null)
    setMessage(null)
    setRowError(null)
    const lineError = draftLinesSaveError(
      editLines,
      'Enter at least one line with item code or name, location, lot, and quantity.'
    )
    if (lineError) {
      setRowError(lineError)
      return false
    }
    const payloadLines = buildPayloadLines()
    setSaving(true)
    try {
      const updated = await api.updateDraft(
        draft.inv_receipt_draft_id,
        {
          receipt_at: dateInputToIso(headerForSave.receiptAt),
          suppliers_id: headerForSave.suppliersId === '' ? null : headerForSave.suppliersId,
          reference_no: headerForSave.referenceNo.trim() || null,
          notes: headerForSave.notes.trim() || null,
          lines: payloadLines,
        },
        variant
      )
      setDraft(updated)
      if (updated.status === 'registered') {
        if (!listLinesOnly) {
          setHeaderEdit(headerEditFromDraft(updated))
        }
        setEditLines(
          ensureTrailingBlankRow(
            updated.lines.map(lineToEditRow),
            isBlankDraftLine,
            (rows) => emptyEditLine(rows.length + 1)
          )
        )
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
    removeRow,
    removeRows,
    importLines,
    items,
    suppliers,
    locations,
    save,
    setError,
    setMessage,
    setRowError,
  }
}
