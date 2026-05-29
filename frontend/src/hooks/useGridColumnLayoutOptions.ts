import type { GridColumnDef } from '../components/ResizableGridTable'

export type GridColumnLayoutOptions = {
  onLayoutChange?: () => void
  pinFirst?: string[]
  headerFilterable?: boolean
  isColumnHeaderFilterable?: (columnKey: string) => boolean
  /** Visible row count — auto-fits rownum column width to digit count. */
  rowCount?: number
}

const layoutOptionsCache = new Map<string, GridColumnLayoutOptions>()

function optionsSignature(options: GridColumnLayoutOptions): string {
  return [
    options.pinFirst?.join('|') ?? '',
    options.headerFilterable === false ? '0' : '1',
    options.isColumnHeaderFilterable ? 'fn' : '',
  ].join(':')
}

/** Stable options object per signature so layout hooks are not reset every render. */
export function gridColumnLayoutOptions(
  options?: GridColumnLayoutOptions
): GridColumnLayoutOptions | undefined {
  if (!options) return undefined
  const signature = optionsSignature(options)
  const cached = layoutOptionsCache.get(signature)
  if (cached) return cached
  layoutOptionsCache.set(signature, options)
  return options
}
