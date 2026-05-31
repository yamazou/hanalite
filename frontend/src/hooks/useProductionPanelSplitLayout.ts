import { useCallback, useMemo, useState } from 'react'
import {
  DEFAULT_PANEL_SPLIT_LAYOUT,
  loadPanelSplitLayout,
  panelSplitLayoutsEqual,
  persistPanelSplitLayout,
  type StoredPanelSplitLayout,
} from '../utils/splitLayoutStorage'

export function useProductionPanelSplitLayout(layoutId: string) {
  const [layout, setLayout] = useState<StoredPanelSplitLayout>(() =>
    loadPanelSplitLayout(layoutId, DEFAULT_PANEL_SPLIT_LAYOUT)
  )
  const [savedLayout, setSavedLayout] = useState(layout)

  const setProcessHeightRatio = useCallback((processHeightRatio: number) => {
    setLayout((prev) => ({ ...prev, processHeightRatio }))
  }, [])

  const setTreeWidthRatio = useCallback((treeWidthRatio: number) => {
    setLayout((prev) => ({ ...prev, treeWidthRatio }))
  }, [])

  const saveLayout = useCallback(() => {
    persistPanelSplitLayout(layoutId, layout)
    setSavedLayout(layout)
  }, [layoutId, layout])

  const isDirty = useMemo(
    () => !panelSplitLayoutsEqual(layout, savedLayout),
    [layout, savedLayout]
  )

  return {
    layout,
    setProcessHeightRatio,
    setTreeWidthRatio,
    saveLayout,
    isDirty,
  }
}
