import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppLink, useAppNavigate, useTabPanelRoute } from '../context/AppNavigateContext'
import { api } from '../api/client'
import { Alert } from '../components/Alert'
import { ErpScreen } from '../components/erp/ErpScreen'
import type { GridColumnLayout } from '../hooks/useGridColumnLayout'
import { ColoredItemCode, ColoredItemName } from '../components/ColoredItemText'
import { ExcelLikeGridTable } from '../components/ExcelLikeGridTable'
import type { GridColumnDef } from '../components/ResizableGridTable'
import { DraftEditableLineGrid } from '../components/DraftEditableLineGrid'
import { StatusBadge } from '../components/StatusBadge'
import { getDraftPageCopy, type DraftVariant } from '../config/draftPages'
import {
  editRowToDraftLine,
  draftLinesSaveError,
  emptyEditLine,
  isBlankDraftLine,
  lineToEditRow,
  type EditLineRow,
} from '../utils/draftEdit'
import { ensureTrailingBlankRow, updateRowWithTrailingBlank } from '../utils/gridTrailingBlankRow'
import { getDraftLineFilterValue } from '../utils/draftGridSort'
import { mergeDraftLineImportRows } from '../utils/draftLineExcelImport'
import { useMasterCatalog } from '../context/MasterCatalogContext'
import type { DraftDetail, DraftStatus } from '../types'
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
  const { search } = useTabPanelRoute()
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
  const { items, suppliers, locations } = useMasterCatalog()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const lineGridLayoutRef = useRef<Pick<GridColumnLayout, 'saveLayout' | 'isDirty'> | null>(
    null
  )

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

  const lineGridId = `${variant}-entry-lines-readonly-v2`

  const loadDraft = useCallback(async () => {
    if (!draftId) {
      setStatus(null)
      setReceiptAt(toDateInputValue())
      setSuppliersId('')
      setReferenceNo('')
      setNotes('')
      setLines([emptyEditLine(1)])
      return
    }
    const draft = await api.getDraft(draftId, variant)
    setStatus(draft.status)
    setReceiptAt(parseDateInputValue(draft.receipt_at))
    setSuppliersId(draft.suppliers_id ?? '')
    setReferenceNo(draft.reference_no ?? '')
    setNotes(draft.notes ?? '')
    setLines(
      ensureTrailingBlankRow(
        draft.lines.map(lineToEditRow),
        isBlankDraftLine,
        (rows) => emptyEditLine(rows.length + 1)
      )
    )
  }, [draftId, variant])

  const handleReload = useCallback(async () => {
    if (!draftId) return
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      await loadDraft()
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.loadFail)
    } finally {
      setLoading(false)
    }
  }, [draftId, loadDraft, copy.loadFail])

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
    void loadDraft()
      .catch((e) => setError(e instanceof Error ? e.message : copy.loadFail))
      .finally(() => setLoading(false))
  }, [copy.loadFail, loadDraft])

  const updateLine = (key: string, patch: Partial<EditLineRow>) => {
    setLines((prev) =>
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
    setLines((prev) =>
      ensureTrailingBlankRow(
        prev
          .filter((row) => !drop.has(row.key))
          .map((row, index) => ({ ...row, line_no: index + 1 })),
        isBlankDraftLine,
        (rows) => emptyEditLine(rows.length + 1)
      )
    )
  }

  const importLines = (parsed: Record<string, string>[]) => {
    const { rows, added } = mergeDraftLineImportRows(parsed, lines, items, locations)
    setLines(
      ensureTrailingBlankRow(
        rows.map((row, index) => ({ ...row, line_no: index + 1 })),
        isBlankDraftLine,
        (rows) => emptyEditLine(rows.length + 1)
      )
    )
    setMessage(
      added > 0
        ? `Imported ${added} line(s) from Excel. Save to apply.`
        : 'No lines were added from the file.'
    )
    setError(null)
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
    const lineError = draftLinesSaveError(lines, copy.lineValidation)
    if (lineError) {
      setError(lineError)
      return
    }
    const payloadLines = buildPayloadLines()

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
            <ColoredItemCode
              itemtypId={row.itemtyp_id === '' ? null : row.itemtyp_id}
              itemId={row.item_id === '' ? null : row.item_id}
              itemCd={row.item_cd}
            >
              {row.item_cd || '-'}
            </ColoredItemCode>
          </td>
        )
      case 'item_nm':
        return (
          <td key={colKey}>
            <ColoredItemName
              itemtypId={row.itemtyp_id === '' ? null : row.itemtyp_id}
              itemId={row.item_id === '' ? null : row.item_id}
              itemCd={row.item_cd}
            >
              {row.item_nm ||
                (row.item_id !== ''
                  ? (() => {
                      const item = items.find((i) => i.item_id === row.item_id)
                      return item ? formatItemLabel(item) : String(row.item_id)
                    })()
                  : '-')}
            </ColoredItemName>
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
        return <td key={colKey}>{row.lot}</td>
      case 'qty':
        return <td key={colKey} className="erp-col-num">{row.qty}</td>
      default:
        return null
    }
  }

  const pageTitle =
    isEdit && draftId != null ? copy.entryEditTitle(draftId) : copy.entryNewTitle

  const handleSaveGrid = () => {
    lineGridLayoutRef.current?.saveLayout()
  }

  const entryBody = (
    <>
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
        <div className="erp-panel-body">
          <div className="erp-panel-content erp-detail-content">
            {!canEdit && isEdit && <Alert type="error" message={copy.entryReadOnlyMsg} />}
            {canEdit ? (
              <DraftEditableLineGrid
                variant={variant}
                scope="entry"
                canEdit={canEdit}
                lines={lines}
                items={items}
                locations={locations}
                onUpdateLine={updateLine}
                onRemoveRows={removeRows}
                onImportParsed={importLines}
                copy={copy}
                onLayoutApi={(api) => {
                  lineGridLayoutRef.current = api
                }}
              />
            ) : lines.length === 0 ? (
              <p className="muted erp-grid-empty">{copy.noLinesMsg}</p>
            ) : (
              <ExcelLikeGridTable
                gridId={lineGridId}
                columns={lineColumns}
                rows={lines}
                getFilterValue={(row, col) =>
                  getDraftLineFilterValue(editRowToDraftLine(row), col)
                }
                layoutOptions={{ headerFilterable: true }}
                onLayoutApi={(api) => {
                  lineGridLayoutRef.current = api
                }}
                excelLabel={copy.exportExcelLabel}
                excelExport={{
                  sheetName: copy.exportLinesSheet,
                  filenamePrefix:
                    variant === 'delivery'
                      ? `delivery_draft_${draftId}_lines`
                      : `receipt_draft_${draftId}_lines`,
                  getExportValue: (row, col) =>
                    getDraftLineFilterValue(editRowToDraftLine(row), col),
                }}
              >
                {({ layout, displayRows }) => (
                  <tbody>
                    {displayRows.map((row, index) => (
                      <tr key={row.key} className={index % 2 === 1 ? 'row-alt' : undefined}>
                        {layout.orderedColumns.map((col) =>
                          renderReadOnlyLineCell(col.key, row)
                        )}
                      </tr>
                    ))}
                  </tbody>
                )}
              </ExcelLikeGridTable>
            )}
          </div>
        </div>
      </div>
    </>
  )

  if (loading) {
    return (
      <ErpScreen title={pageTitle}>
        <div className="erp-panel erp-panel-grow erp-detail-panel">
          <div className="erp-panel-body">
            <div className="erp-panel-content erp-detail-content">
              <p className="muted erp-grid-empty">{copy.loadingMasterText}</p>
            </div>
          </div>
        </div>
      </ErpScreen>
    )
  }

  return (
    <ErpScreen
      error={error}
      success={message}
      title={pageTitle}
      onRefresh={isEdit && draftId != null ? () => void handleReload() : undefined}
      onSaveGrid={handleSaveGrid}
    >
      {entryBody}
    </ErpScreen>
  )
}
