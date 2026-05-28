import type { DraftPageCopy } from '../config/draftPages'
import type { Supplier } from '../types'
import type { HeaderEdit } from '../utils/draftEdit'

type Props = {
  colKey: string
  header: HeaderEdit
  onPatch: (patch: Partial<HeaderEdit>) => void
  suppliers: Supplier[]
  copy: DraftPageCopy
}

export function DraftHeaderEditCell({ colKey, header, onPatch, suppliers, copy }: Props) {
  switch (colKey) {
    case 'date':
      return (
        <input
          type="datetime-local"
          className="erp-grid-input"
          value={header.receiptAt}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onPatch({ receiptAt: e.target.value })}
        />
      )
    case 'reference':
      return (
        <input
          type="text"
          className="erp-grid-input"
          value={header.referenceNo}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onPatch({ referenceNo: e.target.value })}
        />
      )
    case 'supplier':
      return (
        <select
          className="erp-grid-input"
          value={header.suppliersId}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) =>
            onPatch({
              suppliersId: e.target.value === '' ? '' : Number(e.target.value),
            })
          }
        >
          <option value="">{copy.noneOption}</option>
          {suppliers.map((s) => (
            <option key={s.suppliers_id} value={s.suppliers_id}>
              {s.suppliers_nm}
            </option>
          ))}
        </select>
      )
    case 'notes':
      return (
        <input
          type="text"
          className="erp-grid-input"
          value={header.notes}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onPatch({ notes: e.target.value })}
        />
      )
    default:
      return null
  }
}
