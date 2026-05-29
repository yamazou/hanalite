import type { GridColumnDef } from './ResizableGridTable'
import { rowNumColumnWidthForRowCount } from '../utils/gridColumnWidth'

/** Leftmost Excel-style row index column (not sortable / filterable / exported). */
export const GRID_ROWNUM_COLUMN: GridColumnDef = {
  key: 'rownum',
  label: '',
  defaultWidth: rowNumColumnWidthForRowCount(10),
  minWidth: rowNumColumnWidthForRowCount(1),
  className: 'erp-col-rownum',
}

export const GRID_ROWNUM_PIN_KEYS = ['rownum'] as const

type Props = {
  index: number
  colKey?: string
}

export function GridRowNumCell({ index, colKey = 'rownum' }: Props) {
  return (
    <td key={colKey} className="erp-col-rownum" aria-label={`Row ${index + 1}`}>
      {index + 1}
    </td>
  )
}
