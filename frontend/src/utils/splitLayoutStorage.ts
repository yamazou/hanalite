export type StoredPanelSplitLayout = {
  processHeightRatio: number
  treeWidthRatio: number
  outputItemHeightRatio: number
  listHeightRatio: number
}

export const DEFAULT_PANEL_SPLIT_LAYOUT: StoredPanelSplitLayout = {
  processHeightRatio: 0.45,
  treeWidthRatio: 0.38,
  outputItemHeightRatio: 0.35,
  listHeightRatio: 0.38,
}

export function splitLayoutStorageKey(layoutId: string, layoutScope?: string): string {
  if (layoutScope) {
    return `hanalite:split:${layoutScope}:${layoutId}`
  }
  return `hanalite:split:${layoutId}`
}

function clampRatio(value: number, min = 0.15, max = 0.85): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function loadPanelSplitLayout(
  layoutId: string,
  defaults: StoredPanelSplitLayout = DEFAULT_PANEL_SPLIT_LAYOUT,
  layoutScope?: string
): StoredPanelSplitLayout {
  try {
    const raw = localStorage.getItem(splitLayoutStorageKey(layoutId, layoutScope))
    if (!raw) return { ...defaults }
    const parsed = JSON.parse(raw) as Partial<StoredPanelSplitLayout>
    return {
      processHeightRatio: clampRatio(
        parsed.processHeightRatio ?? defaults.processHeightRatio
      ),
      treeWidthRatio: clampRatio(parsed.treeWidthRatio ?? defaults.treeWidthRatio),
      outputItemHeightRatio: clampRatio(
        parsed.outputItemHeightRatio ?? defaults.outputItemHeightRatio
      ),
      listHeightRatio: clampRatio(parsed.listHeightRatio ?? defaults.listHeightRatio),
    }
  } catch {
    return { ...defaults }
  }
}

export function persistPanelSplitLayout(
  layoutId: string,
  layout: StoredPanelSplitLayout,
  layoutScope?: string
): void {
  localStorage.setItem(
    splitLayoutStorageKey(layoutId, layoutScope),
    JSON.stringify(layout)
  )
}

export function panelSplitLayoutsEqual(
  a: StoredPanelSplitLayout,
  b: StoredPanelSplitLayout
): boolean {
  return (
    a.processHeightRatio === b.processHeightRatio &&
    a.treeWidthRatio === b.treeWidthRatio &&
    a.outputItemHeightRatio === b.outputItemHeightRatio &&
    a.listHeightRatio === b.listHeightRatio
  )
}
