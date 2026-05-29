import { useEffect, useMemo, useState } from 'react'
import { erpRowClass } from './erp/ErpGridPanel'
import { productionInputColumns, productionLineColumns } from './erp/masterGridColumns'
import { ResizableGridTable } from './ResizableGridTable'
import { useGridColumnLayout } from '../hooks/useGridColumnLayout'
import type { ProductionOrderDetail } from '../types/production'
import { formatQty } from '../utils/format'

function itemtypSortKey(itemtypNm: string | undefined): number {
  const n = (itemtypNm ?? '').trim().toLowerCase()
  if (n === 'fg') return 0
  if (n === 'wip') return 1
  if (n.includes('purchase')) return 2
  if (n === 'rm' || n === 'material') return 3
  return 99
}

type Props = {
  detail: ProductionOrderDetail | null
  loading?: boolean
  emptyMessage?: string
  lineGridId?: string
  inputGridId?: string
}

export function ProductionProcessInputPanels({
  detail,
  loading = false,
  emptyMessage = 'No order data.',
  lineGridId = 'production-process-lines-v1',
  inputGridId = 'production-process-inputs-v1',
}: Props) {
  const [selectedProcessKey, setSelectedProcessKey] = useState<string | null>(null)
  const lineLayout = useGridColumnLayout(lineGridId, productionLineColumns)
  const inputLayout = useGridColumnLayout(inputGridId, productionInputColumns)

  useEffect(() => {
    setSelectedProcessKey(null)
  }, [detail?.production_order_id])

  const processGroups = useMemo(() => {
    if (!detail) return []
    const groups = new Map<
      string,
      {
        key: string
        no: number
        process: string
        status: 'planned' | 'completed'
        output: string
        actualQty: string | number | null
        lineNos: number[]
      }
    >()
    let nextNo = 1
    for (const ln of detail.lines) {
      const key = ln.process_nm
      const existing = groups.get(key)
      if (!existing) {
        groups.set(key, {
          key,
          no: nextNo++,
          process: ln.process_nm,
          status: ln.status,
          output: ln.output_item_cd ?? detail.parent_item_cd,
          actualQty: ln.actual_qty,
          lineNos: [ln.line_no],
        })
        continue
      }
      existing.lineNos.push(ln.line_no)
      if (existing.status !== 'planned' && ln.status === 'planned') {
        existing.status = 'planned'
      }
      if (existing.actualQty == null && ln.actual_qty != null) {
        existing.actualQty = ln.actual_qty
      }
    }
    return Array.from(groups.values())
  }, [detail])

  const visibleInputs = useMemo(() => {
    if (!detail) return []
    if (selectedProcessKey == null) return []
    const group = processGroups.find((g) => g.key === selectedProcessKey)
    if (!group) return []
    const lineNos = new Set(group.lineNos)
    return detail.inputs
      .filter((ln) => lineNos.has(ln.line_no))
      .sort(
        (a, b) =>
          (a.level ?? 0) - (b.level ?? 0) ||
          itemtypSortKey(a.itemtyp_nm) - itemtypSortKey(b.itemtyp_nm) ||
          a.line_no - b.line_no
      )
  }, [detail, selectedProcessKey, processGroups])

  if (loading) {
    return <p className="muted erp-grid-empty">Loading process and input…</p>
  }

  if (!detail) {
    return <p className="muted erp-grid-empty">{emptyMessage}</p>
  }

  return (
    <div className="erp-panel erp-panel-grow erp-detail-panel">
      <div className="erp-panel-content erp-detail-content">
        <section className="erp-production-detail-section">
          <div className="erp-production-detail-section-title">Process</div>
          <div className="erp-grid-wrap erp-grid-wrap-static">
            <ResizableGridTable layout={lineLayout}>
              <tbody>
                {processGroups.length === 0 ? (
                  <tr>
                    <td colSpan={lineLayout.orderedColumns.length} className="erp-grid-empty-cell">
                      No process steps
                    </td>
                  </tr>
                ) : (
                  processGroups.map((ln, idx) => (
                    <tr
                      key={ln.key}
                      className={erpRowClass(idx, selectedProcessKey === ln.key)}
                      onClick={() =>
                        setSelectedProcessKey((prev) => (prev === ln.key ? null : ln.key))
                      }
                    >
                      {lineLayout.orderedColumns.map((col) => {
                        switch (col.key) {
                          case 'line_no':
                            return <td key={col.key}>{ln.no}</td>
                          case 'process':
                            return <td key={col.key}>{ln.process}</td>
                          case 'status':
                            return <td key={col.key}>{ln.status}</td>
                          case 'output':
                            return (
                              <td key={col.key}>
                                <code>{ln.output}</code>
                              </td>
                            )
                          case 'actual_qty':
                            return (
                              <td key={col.key}>
                                {ln.actualQty != null ? formatQty(ln.actualQty) : '-'}
                              </td>
                            )
                          case 'actions':
                            return (
                              <td key={col.key} className="erp-col-actions">
                                {ln.status === 'completed' ? 'Done' : ''}
                              </td>
                            )
                          default:
                            return <td key={col.key} />
                        }
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </ResizableGridTable>
          </div>
        </section>

        <section className="erp-production-detail-section">
          <div className="erp-production-detail-section-title">Input</div>
          <div className="erp-grid-wrap erp-grid-wrap-static">
            <ResizableGridTable layout={inputLayout}>
              <tbody>
                {visibleInputs.length === 0 ? (
                  <tr>
                    <td colSpan={inputLayout.orderedColumns.length} className="erp-grid-empty-cell">
                      {selectedProcessKey == null
                        ? 'Select a process to show input lines'
                        : 'No child items for selected process'}
                    </td>
                  </tr>
                ) : (
                  visibleInputs.map((ln, idx) => (
                    <tr key={ln.prd_order_input_id} className={erpRowClass(idx)}>
                      {inputLayout.orderedColumns.map((col) => {
                        switch (col.key) {
                          case 'line_no':
                            return <td key={col.key}>{idx + 1}</td>
                          case 'item':
                            return (
                              <td key={col.key}>
                                <code>{ln.item_cd}</code> {ln.item_nm}
                              </td>
                            )
                          case 'req_qty':
                            return <td key={col.key}>{formatQty(ln.req_qty)}</td>
                          case 'consume_qty':
                            return <td key={col.key}>{formatQty(ln.consume_qty)}</td>
                          case 'lot':
                            return (
                              <td key={col.key}>
                                <code>{ln.lot || detail.lot}</code>
                              </td>
                            )
                          default:
                            return <td key={col.key} />
                        }
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </ResizableGridTable>
          </div>
        </section>
      </div>
    </div>
  )
}
