import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppLink, useAppNavigate, useAppViewRoute } from '../context/AppNavigateContext'
import { api } from '../api/client'
import { Alert } from '../components/Alert'
import { ResizableGridTable, type GridColumnDef } from '../components/ResizableGridTable'
import { DraftEditableLineGrid } from '../components/DraftEditableLineGrid'
import { StatusBadge } from '../components/StatusBadge'
import { getDraftPageCopy, type DraftVariant } from '../config/draftPages'
import { useGridColumnLayout } from '../hooks/useGridColumnLayout'
import type { DraftDetail, DraftStatus, Item, Supplier } from '../types'
import type { LocationMaster } from '../types/masters'
import { emptyEditLine, lineToEditRow, type EditLineRow } from '../utils/draftEdit'
import {
  dateInputToIso,
  formatItemLabel,
  parseDateInputValue,
  toDateInputValue,
} from '../utils/format'

type Props = {
  variant?: DraftVariant
}

export function DraftEntryPage({ variant = 'receipt' }: Props) {
  const copy = getDraftPageCopy(variant)
  const navigate = useAppNavigate()
  const { search } = useAppViewRoute()
  const draftIdParam = new URLSearchParams(search).get('id')
  const draftId = useMemo(() => {
    if (!draftIdParam) return null
    const id = Number(draftIdParam)
    return Number.isNaN(id) ? null : id
  }, [draftIdParam])

  const [status, setStatus] = useState<DraftStatus | null>(null)
  const [receiptAt, setReceiptAt] = useState(toDateInputValue())
  const [suppliersId, setSuppliersId] = useState<number | ''>('')
  const [referenceNo, setReferenceNo] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<EditLineRow[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [locations, setLocations] = useState<LocationMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const isEdit = draftId != null
  const canEdit = !isEdit || status === 'registered'

  const lineColumns = useMemo((): GridColumnDef[] => {
    return [
      { key: 'item_cd', label: copy.itemCdLabel, defaultWidth: 110 },
      { key: 'item_nm', label: copy.itemNmLabel, defaultWidth: 160 },
      { key: 'lot', label: copy.lotLabel, defaultWidth: 100 },
      { key: 'location', label: copy.locationLabel, defaultWidth: 140 },
      { key: 'qty', label: copy.qtyLabel, defaultWidth: 72, className: 'erp-col-num' },
    ]
  }, [copy.itemCdLabel, copy.itemNmLabel, copy.locationLabel, copy.lotLabel, copy.qtyLabel])

  const lineGridId = `${variant}-entry-lines-readonly-v1`
  const lineLayout = useGridColumnLayout(lineGridId, lineColumns)

  const loadDraft = useCallback(async () => {
    if (!draftId) {
      setStatus(null)
      setReceiptAt(toDateInputValue())
      setSuppliersId('')
      setReferenceNo('')
      setNotes('')
      setLines([])
      return
    }
    const draft = await api.getDraft(draftId, variant)
    setStatus(draft.status)
    setReceiptAt(parseDateInputValue(draft.receipt_at))
    setSuppliersId(draft.suppliers_id ?? '')
    setReferenceNo(draft.reference_no ?? '')
    setNotes(draft.notes ?? '')
    setLines(draft.lines.map(lineToEditRow))
  }, [draftId, variant])

  useEffect(() => {
    const prev = document.title
    document.title = isEdit && draftId ? copy.entryEditTitle(draftId) : copy.entryNewTitle
    return () => {
      document.title = prev
    }
  }, [copy.entryEditTitle, copy.entryNewTitle, draftId, isEdit])

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([api.listItems(), api.listSuppliers(), api.listLocationsMaster(), loadDraft()])
      .then(([i, s, l]) => {
        setItems(i)
        setSuppliers(s)
        setLocations(l)
      })
      .catch((e) => setError(e instanceof Error ? e.message : copy.loadFail))
      .finally(() => setLoading(false))
  }, [copy.loadFail, loadDraft])

  const updateLine = (key: string, patch: Partial<EditLineRow>) => {
    setLines((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const addRow = () => {
    setLines((prev) => [...prev, emptyEditLine(prev.length + 1)])
  }

  const removeRows = (keys: string[]) => {
    if (keys.length === 0) return
    const drop = new Set(keys)
    setLines((prev) =>
      prev.filter((row) => !drop.has(row.key)).map((row, index) => ({ ...row, line_no: index + 1 }))
    )
  }

  const buildPayloadLines = () => {
    const valid = lines.filter(
      (row) =>
        (row.item_id !== '' || row.item_cd.trim() || row.item_nm.trim()) &&
        row.location_id !== '' &&
        row.lot.trim() &&
        row.qty
    )
    return valid.map((row, index) => ({
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

  async function handleSave() {
    if (!canEdit) return
    setError(null)
    setMessage(null)
    const payloadLines = buildPayloadLines()
    if (payloadLines.length === 0) {
      setError(copy.lineValidation)
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        receipt_at: dateInputToIso(receiptAt),
        suppliers_id: suppliersId === '' ? null : suppliersId,
        reference_no: referenceNo.trim() || null,
        notes: notes.trim() || null,
        lines: payloadLines,
      }
      if (isEdit && draftId) {
        await api.updateDraft(draftId, payload, variant)
        setMessage(copy.saveSuccessMsg)
        await loadDraft()
      } else {
        const draft = await api.createDraft(payload, variant)
        navigate(`${copy.newPath}?id=${draft.inv_receipt_draft_id}`, { replace: true })
        setMessage(copy.saveSuccessMsg)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.createFail)
    } finally {
      setSubmitting(false)
    }
  }

  const renderReadOnlyLineCell = (colKey: string, row: EditLineRow) => {
    switch (colKey) {
      case 'item_cd':
        return (
          <td key={colKey}>
            <code>{row.item_cd || '-'}</code>
          </td>
        )
      case 'item_nm':
        return (
          <td key={colKey}>
            {row.item_nm ||
              (row.item_id !== ''
                ? (() => {
                    const item = items.find((i) => i.item_id === row.item_id)
                    return item ? formatItemLabel(item) : String(row.item_id)
                  })()
                : '-')}
          </td>
        )
      case 'location': {
        const loc = locations.find((l) => l.location_id === row.location_id)
        return (
          <td key={colKey}>
            {loc ? `${loc.location_cd} / ${loc.location_nm}` : row.location_id}
          </td>
        )
      }
      case 'lot':
        return (
          <td key={colKey}>
            <code>{row.lot}</code>
          </td>
        )
      case 'qty':
        return <td key={colKey} className="erp-col-num">{row.qty}</td>
      default:
        return null
    }
  }

  if (loading) {
    return <p className="muted erp-grid-empty">{copy.loadingMasterText}</p>
  }

  return (
    <div className="erp-screen">
      {error && <Alert type="error" message={error} />}
      {message && <Alert type="success" message={message} />}
      {!canEdit && isEdit && <Alert type="error" message={copy.entryReadOnlyMsg} />}

      <div className="erp-panel erp-panel-search">
        <div className="erp-panel-body erp-search-body">
          <div className="erp-entry-toolbar">
            <AppLink
              to={draftId != null ? copy.listPathWithId(draftId) : copy.listPath}
              className="btn erp-btn erp-btn-clear"
            >
              {copy.backToList}
            </AppLink>
            {status && <StatusBadge status={status} />}
            <div className="erp-entry-toolbar-right">
              <button
                type="button"
                className="btn erp-btn erp-btn-search"
                disabled={!canEdit || submitting}
                onClick={() => void handleSave()}
              >
                {submitting ? copy.submittingCreate : copy.submitCreate}
              </button>
            </div>
          </div>
          <div className="erp-search-form erp-search-form-draft-entry erp-entry-header-row">
            <label className="erp-search-field erp-search-field-datetime erp-search-field-with-label">
              <span className="bom-field-label">{copy.dateTimeLabel}</span>
              <input
                type="date"
                className="erp-input"
                value={receiptAt}
                disabled={!canEdit}
                onChange={(e) => setReceiptAt(e.target.value)}
              />
            </label>
            <label className="erp-search-field erp-search-field-reference erp-search-field-with-label">
              <span className="bom-field-label">{copy.referenceLabel}</span>
              <input
                type="text"
                className="erp-input"
                value={referenceNo}
                disabled={!canEdit}
                placeholder={copy.referencePlaceholder}
                onChange={(e) => setReferenceNo(e.target.value)}
              />
            </label>
            <label className="erp-search-field erp-search-field-supplier erp-search-field-with-label">
              <span className="bom-field-label">{copy.supplierLabel}</span>
              <select
                className={`erp-input${suppliersId === '' ? ' erp-input-empty' : ''}`}
                value={suppliersId}
                disabled={!canEdit}
                onChange={(e) =>
                  setSuppliersId(e.target.value === '' ? '' : Number(e.target.value))
                }
              >
                <option value="">{copy.supplierLabel}</option>
                {suppliers.map((s) => (
                  <option key={s.suppliers_id} value={s.suppliers_id}>
                    {s.suppliers_nm}
                  </option>
                ))}
              </select>
            </label>
            <label className="erp-search-field erp-search-field-notes erp-search-field-with-label">
              <span className="bom-field-label">{copy.notesLabel}</span>
              <input
                type="text"
                className="erp-input"
                value={notes}
                disabled={!canEdit}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="erp-panel erp-panel-grow erp-detail-panel">
        <div className="erp-panel-body erp-panel-content">
          {canEdit ? (
            <DraftEditableLineGrid
              variant={variant}
              scope="entry"
              canEdit={canEdit}
              lines={lines}
              items={items}
              locations={locations}
              onUpdateLine={updateLine}
              onAddRow={addRow}
              onRemoveRows={removeRows}
              copy={copy}
            />
          ) : lines.length === 0 ? (
            <p className="muted erp-grid-empty">{copy.noLinesMsg}</p>
          ) : (
            <div className="erp-grid-wrap erp-grid-wrap-detail">
              <ResizableGridTable layout={lineLayout} isColumnFilterable={() => false}>
                <tbody>
                  {lines.map((row, index) => (
                    <tr key={row.key} className={index % 2 === 1 ? 'row-alt' : undefined}>
                      {lineLayout.orderedColumns.map((col) => renderReadOnlyLineCell(col.key, row))}
                    </tr>
                  ))}
                </tbody>
              </ResizableGridTable>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
