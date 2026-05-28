import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Alert } from '../components/Alert'
import { ResizableGridTable, type GridColumnDef } from '../components/ResizableGridTable'
import { StatusBadge } from '../components/StatusBadge'
import { getDraftPageCopy, type DraftVariant } from '../config/draftPages'
import { useGridColumnLayout } from '../hooks/useGridColumnLayout'
import type { DraftDetail, DraftStatus, Item, Supplier } from '../types'
import type { LocationMaster } from '../types/masters'
import { itemCdFieldPatch, itemNmFieldPatch } from '../utils/draftEdit'
import { datetimeLocalToIso, formatItemLabel, toDatetimeLocalValue } from '../utils/format'

type EntryLineRow = {
  key: string
  inv_receipt_draft_line_id?: number
  item_id: number | ''
  item_cd: string
  item_nm: string
  location_id: number | ''
  lot: string
  qty: string
  line_no: number
}

type Props = {
  variant?: DraftVariant
}

function emptyLineRow(lineNo: number): EntryLineRow {
  return {
    key: crypto.randomUUID(),
    item_id: '',
    item_cd: '',
    item_nm: '',
    location_id: '',
    lot: '',
    qty: '',
    line_no: lineNo,
  }
}

function lineFromDraft(ln: DraftDetail['lines'][number]): EntryLineRow {
  return {
    key: `line-${ln.inv_receipt_draft_line_id}`,
    inv_receipt_draft_line_id: ln.inv_receipt_draft_line_id,
    item_id: ln.item_id ?? '',
    item_cd: ln.item_cd ?? '',
    item_nm: ln.item_nm ?? '',
    location_id: ln.location_id ?? '',
    lot: ln.lot,
    qty: String(ln.qty),
    line_no: ln.line_no,
  }
}

export function DraftEntryPage({ variant = 'receipt' }: Props) {
  const copy = getDraftPageCopy(variant)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const draftIdParam = searchParams.get('id')
  const draftId = useMemo(() => {
    if (!draftIdParam) return null
    const id = Number(draftIdParam)
    return Number.isNaN(id) ? null : id
  }, [draftIdParam])

  const [status, setStatus] = useState<DraftStatus | null>(null)
  const [receiptAt, setReceiptAt] = useState(toDatetimeLocalValue())
  const [suppliersId, setSuppliersId] = useState<number | ''>('')
  const [referenceNo, setReferenceNo] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<EntryLineRow[]>([])
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
    const cols: GridColumnDef[] = [
      { key: 'item_cd', label: copy.itemCdLabel, defaultWidth: 110 },
      { key: 'item_nm', label: copy.itemNmLabel, defaultWidth: 160 },
      { key: 'lot', label: copy.lotLabel, defaultWidth: 100 },
      { key: 'location', label: copy.locationLabel, defaultWidth: 140 },
      { key: 'qty', label: copy.qtyLabel, defaultWidth: 72, className: 'erp-col-num' },
    ]
    if (canEdit) {
      cols.push({ key: 'actions', label: '', defaultWidth: 72, className: 'erp-col-actions' })
    }
    return cols
  }, [canEdit, copy.itemCdLabel, copy.itemNmLabel, copy.locationLabel, copy.lotLabel, copy.qtyLabel])

  const lineGridId = `${variant}-entry-lines-v3`
  const lineLayout = useGridColumnLayout(lineGridId, lineColumns)

  const loadDraft = useCallback(async () => {
    if (!draftId) {
      setStatus(null)
      setReceiptAt(toDatetimeLocalValue())
      setSuppliersId('')
      setReferenceNo('')
      setNotes('')
      setLines([])
      return
    }
    const draft = await api.getDraft(draftId, variant)
    setStatus(draft.status)
    setReceiptAt(toDatetimeLocalValue(new Date(draft.receipt_at)))
    setSuppliersId(draft.suppliers_id ?? '')
    setReferenceNo(draft.reference_no ?? '')
    setNotes(draft.notes ?? '')
    setLines(draft.lines.map(lineFromDraft))
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

  const updateLine = (key: string, patch: Partial<EntryLineRow>) => {
    setLines((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const addRow = () => {
    setLines((prev) => [...prev, emptyLineRow(prev.length + 1)])
  }

  const removeRow = (key: string) => {
    setLines((prev) =>
      prev.filter((row) => row.key !== key).map((row, index) => ({ ...row, line_no: index + 1 }))
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
        receipt_at: datetimeLocalToIso(receiptAt),
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

  const renderLineCell = (colKey: string, row: EntryLineRow) => {
    if (!canEdit) {
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

    switch (colKey) {
      case 'item_cd':
        return (
          <td key={colKey} className="erp-grid-cell-edit">
            <input
              className="erp-grid-input"
              value={row.item_cd}
              list={`master-item-cd-${row.key}`}
              placeholder={copy.itemCdLabel}
              onChange={(e) => updateLine(row.key, itemCdFieldPatch(items, e.target.value))}
            />
            <datalist id={`master-item-cd-${row.key}`}>
              {items.map((item) => (
                <option key={item.item_id} value={item.item_cd}>
                  {item.item_nm}
                </option>
              ))}
            </datalist>
          </td>
        )
      case 'item_nm':
        return (
          <td key={colKey} className="erp-grid-cell-edit">
            <input
              className="erp-grid-input"
              value={row.item_nm}
              list={`master-item-nm-${row.key}`}
              placeholder={copy.itemNmLabel}
              onChange={(e) => updateLine(row.key, itemNmFieldPatch(items, e.target.value))}
            />
            <datalist id={`master-item-nm-${row.key}`}>
              {items.map((item) => (
                <option key={item.item_id} value={item.item_nm}>
                  {item.item_cd}
                </option>
              ))}
            </datalist>
          </td>
        )
      case 'location':
        return (
          <td key={colKey} className="erp-grid-cell-edit">
            <select
              className="erp-grid-input"
              value={row.location_id}
              onChange={(e) =>
                updateLine(row.key, {
                  location_id: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
            >
              <option value="">{copy.selectOption}</option>
              {locations.map((location) => (
                <option key={location.location_id} value={location.location_id}>
                  {location.location_cd} / {location.location_nm}
                </option>
              ))}
            </select>
          </td>
        )
      case 'lot':
        return (
          <td key={colKey} className="erp-grid-cell-edit">
            <input
              className="erp-grid-input"
              value={row.lot}
              placeholder={copy.lotPlaceholder}
              onChange={(e) => updateLine(row.key, { lot: e.target.value })}
            />
          </td>
        )
      case 'qty':
        return (
          <td key={colKey} className="erp-grid-cell-edit erp-col-num">
            <input
              className="erp-grid-input"
              type="number"
              min="0.001"
              step="0.001"
              value={row.qty}
              onChange={(e) => updateLine(row.key, { qty: e.target.value })}
            />
          </td>
        )
      case 'actions':
        return (
          <td key={colKey} className="erp-col-actions">
            <button
              type="button"
              className="btn erp-btn erp-btn-clear btn-sm"
              onClick={() => removeRow(row.key)}
            >
              {copy.removeRowBtn}
            </button>
          </td>
        )
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
            <Link
              to={draftId != null ? copy.listPathWithId(draftId) : copy.listPath}
              className="erp-entry-back"
            >
              {copy.backToList}
            </Link>
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
          <div className="erp-search-row erp-entry-header-row">
            <label className="erp-search-field erp-search-field-datetime">
              <span className="erp-search-label">{copy.dateTimeLabel}</span>
              <input
                type="datetime-local"
                className="erp-input"
                value={receiptAt}
                disabled={!canEdit}
                onChange={(e) => setReceiptAt(e.target.value)}
              />
            </label>
            <label className="erp-search-field">
              <span className="erp-search-label">{copy.referenceLabel}</span>
              <input
                type="text"
                className="erp-input"
                value={referenceNo}
                disabled={!canEdit}
                placeholder={copy.referencePlaceholder}
                onChange={(e) => setReferenceNo(e.target.value)}
              />
            </label>
            <label className="erp-search-field erp-search-field-supplier">
              <span className="erp-search-label">{copy.supplierLabel}</span>
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
            <label className="erp-search-field erp-search-field-notes">
              <span className="erp-search-label">{copy.notesLabel}</span>
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
          {canEdit && (
            <div className="erp-detail-toolbar">
              <button type="button" className="btn erp-btn erp-btn-new btn-sm" onClick={addRow}>
                {copy.addRowBtn}
              </button>
            </div>
          )}
          {lines.length === 0 ? (
            <p className="muted erp-grid-empty">{copy.noLinesMsg}</p>
          ) : (
            <div className="erp-grid-wrap erp-grid-wrap-detail">
              <ResizableGridTable layout={lineLayout} isColumnFilterable={() => false}>
                <tbody>
                  {lines.map((row, index) => (
                    <tr key={row.key} className={index % 2 === 1 ? 'row-alt' : undefined}>
                      {lineLayout.orderedColumns.map((col) => renderLineCell(col.key, row))}
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
