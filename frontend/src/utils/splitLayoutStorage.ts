export type StoredPanelSplitLayout = {
  processHeightRatio: number
  treeWidthRatio: number
}

export const DEFAULT_PANEL_SPLIT_LAYOUT: StoredPanelSplitLayout = {
  processHeightRatio: 0.45,
  treeWidthRatio: 0.38,
}

export function splitLayoutStorageKey(layoutId: string): string {
  return `hanalite:split:${layoutId}`
}

function clampRatio(value: number, min = 0.15, max = 0.85): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function loadPanelSplitLayout(
  layoutId: string,
  defaults: StoredPanelSplitLayout = DEFAULT_PANEL_SPLIT_LAYOUT
): StoredPanelSplitLayout {
  try {
    const raw = localStorage.getItem(splitLayoutStorageKey(layoutId))
    if (!raw) return { ...defaults }
    const parsed = JSON.parse(raw) as Partial<StoredPanelSplitLayout>
    return {
      processHeightRatio: clampRatio(
        parsed.processHeightRatio ?? defaults.processHeightRatio
      ),
      treeWidthRatio: clampRatio(parsed.treeWidthRatio ?? defaults.treeWidthRatio),
    }
  } catch {
    return { ...defaults }
  }
}

export function persistPanelSplitLayout(
  layoutId: string,
  layout: StoredPanelSplitLayout
): void {
  localStorage.setItem(splitLayoutStorageKey(layoutId), JSON.stringify(layout))
}

export function panelSplitLayoutsEqual(
  a: StoredPanelSplitLayout,
  b: StoredPanelSplitLayout
): boolean {
  return (
    a.processHeightRatio === b.processHeightRatio &&
    a.treeWidthRatio === b.treeWidthRatio
  )
}
