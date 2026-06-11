import { useMemo } from 'react'
import { Alert } from './Alert'
import { ExcelLikeGridTable } from './ExcelLikeGridTable'
import type { GridColumnDef } from './ResizableGridTable'
import type { GridColumnLayout } from '../hooks/useGridColumnLayout'
import { ColoredItemCode, ColoredItemName } from './ColoredItemText'
import type { useDraftEdit } from '../hooks/useDraftEdit'
import { getDraftPageCopy, type DraftVariant } from '../config/draftPages'
import type { DraftLine } from '../types'
import { editRowToDraftLine } from '../utils/draftEdit'
import { getDraftLineFilterValue } from '../utils/draftGridSort'
import { formatQty } from '../utils/format'
import { DraftEditableLineGrid } from './DraftEditableLineGrid'

type DraftEdit = ReturnType<typeof useDraftEdit>

export type LineGridLayoutApi = Pick<GridColumnLayout, 'saveLayout' | 'isDirty'>

type Props = {
  draftId: number | null
  variant?: DraftVariant
  edit: DraftEdit
  onSaved?: () => void
  onSaveLines?: () => void
  saving?: boolean
  onLineGridLayout?: (api: LineGridLayoutApi) => void
  onLineGridLayoutChange?: () => void
}

export function DraftDetailPanel({
  draftId,
  variant = 'receipt',
  edit,
  onLineGridLayout,
  onLineGridLayoutChange,
  onSaveLines,
  saving = false,
}: Props) {
  const copy = getDraftPageCopy(variant)
  const {
    draft,
    loading,
    error,
    message,
    canEdit,
    editLines,
    updateLine,
    removeRows,
    importLines,
    items,
    locations,
  } = edit

  const hideLocation = variant === 'receipt'

  const lineColumns = useMemo((): GridColumnDef[] => {
    const cols: GridColumnDef[] = [
      { key: 'item_cd', label: copy.itemCdLabel, defaultWidth: 110 },
      { key: 'item_nm', label: copy.itemNmLabel, defaultWidth: 160 },
      { key: 'lot', label: copy.lotLabel, defaultWidth: 100 },
    ]
    if (!hideLocation) {
      cols.push({ key: 'location', label: copy.locationLabel, defaultWidth: 140 })
    }
    cols.push({ key: 'qty', label: copy.qtyLabel, defaultWidth: 72, className: 'erp-col-num' })
    return cols
  }, [
    hideLocation,
    copy.itemCdLabel,
    copy.itemNmLabel,
    copy.locationLabel,
    copy.lotLabel,
    copy.qtyLabel,
  ])

  const lineGridId = `${variant}-lines-readonly-v2`

  const displayLines: DraftLine[] = useMemo(() => {
    if (canEdit) return editLines.map(editRowToDraftLine)
    return draft?.lines ?? []
  }, [canEdit, editLines, draft?.lines])

  const renderReadOnlyLineCell = (colKey: string, line: DraftLine) => {
    switch (colKey) {
      case 'item_cd':
        return (
          <td key={colKey} title={line.item_cd ?? ''}>
            <ColoredItemCode
              itemtypId={line.itemtyp_id}
              itemId={line.item_id}
              itemCd={line.item_cd}
            >
              {line.item_cd ?? '-'}
            </ColoredItemCode>
          </td>
        )
      case 'item_nm':
        return (
          <td key={colKey} title={line.item_nm ?? ''}>
            <ColoredItemName
              itemtypId={line.itemtyp_id}
              itemId={line.item_id}
              itemCd={line.item_cd}
            >
              {line.item_nm ?? '-'}
            </ColoredItemName>
          </td>
        )
      case 'location':
        return (
          <td
            key={colKey}
            title={`${line.location_cd ?? '-'} ${line.location_nm ?? ''}`.trim()}
          >
            <code>{line.location_cd ?? '-'}</code>
            {line.location_nm ? ` ${line.location_nm}` : ''}
          </td>
        )
      case 'lot':
        return (
          <td key={colKey} title={line.lot}>
            {line.lot}
          </td>
        )
      case 'qty':
        return (
          <td key={colKey} className="erp-col-num">
            {formatQty(line.qty)}
          </td>
        )
      default:
        return null
    }
  }

  if (!draftId) {
    return <p className="muted erp-grid-empty">{copy.detailPanelHint}</p>
  }

  if (loading) {
    return <p className="muted erp-grid-empty">{copy.loadingText}</p>
  }

  if (!draft) {
    return (
      <>
        {error && <Alert type="error" message={error} />}
        {!error && <p className="muted erp-grid-empty">{copy.loadFail}</p>}
      </>
    )
  }

  return (
    <div className="erp-detail-content">
      {error && <Alert type="error" message={error} />}
      {message && <Alert type="success" message={message} />}

      {copy.detailLinesSectionTitle ? (
        <div className="erp-production-detail-section-title">
          <span className="erp-production-detail-section-title-label">
            {copy.detailLinesSectionTitle}
          </span>
        </div>
      ) : null}

      {canEdit ? (
        <DraftEditableLineGrid
          variant={variant}
          scope="detail"
          hideLocation={hideLocation}
          canEdit={canEdit}
          lines={editLines}
          items={items}
          locations={locations}
          onUpdateLine={updateLine}
          onRemoveRows={removeRows}
          onImportParsed={importLines}
          rowError={edit.rowError}
          copy={copy}
          onLayoutChange={onLineGridLayoutChange}
          onLayoutApi={onLineGridLayout}
          onSaveLines={onSaveLines}
          saving={saving}
        />
      ) : (
        <ExcelLikeGridTable
          gridId={lineGridId}
          columns={lineColumns}
          rows={displayLines}
          getFilterValue={getDraftLineFilterValue}
          layoutOptions={{ onLayoutChange: onLineGridLayoutChange, headerFilterable: true }}
          onLayoutApi={onLineGridLayout}
          excelLabel={copy.exportExcelLabel}
          excelExport={{
            sheetName: copy.exportLinesSheet,
            filenamePrefix:
              variant === 'delivery'
                ? `delivery_draft_${draftId}_lines`
                : `receipt_draft_${draftId}_lines`,
            getExportValue: (line, col) => getDraftLineFilterValue(line, col),
          }}
        >
          {({ layout, displayRows }) => (
            <tbody>
              {displayRows.map((line, index) => (
                <tr key={line.inv_receipt_draft_line_id} className={index % 2 === 1 ? 'row-alt' : undefined}>
                  {layout.orderedColumns.map((col) => renderReadOnlyLineCell(col.key, line))}
                </tr>
              ))}
            </tbody>
          )}
        </ExcelLikeGridTable>
      )}

    </div>
  )
}
