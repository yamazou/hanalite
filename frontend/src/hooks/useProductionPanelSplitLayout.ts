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
  const [savedLayout, setSavedLayout] = useState<StoredPanelSplitLayout>(() =>
    loadPanelSplitLayout(layoutId, DEFAULT_PANEL_SPLIT_LAYOUT)
  )

  const setProcessHeightRatio = useCallback((processHeightRatio: number) => {
    setLayout((prev) => ({ ...prev, processHeightRatio }))
  }, [])

  const setTreeWidthRatio = useCallback((treeWidthRatio: number) => {
    setLayout((prev) => ({ ...prev, treeWidthRatio }))
  }, [])

  const setOutputItemHeightRatio = useCallback((outputItemHeightRatio: number) => {
    setLayout((prev) => ({ ...prev, outputItemHeightRatio }))
  }, [])

  const setListHeightRatio = useCallback((listHeightRatio: number) => {
    setLayout((prev) => ({ ...prev, listHeightRatio }))
  }, [])

  const saveLayout = useCallback(() => {
    const snapshot: StoredPanelSplitLayout = { ...layout }
    persistPanelSplitLayout(layoutId, snapshot)
    setSavedLayout(snapshot)
  }, [layoutId, layout])

  const isDirty = useMemo(
    () => !panelSplitLayoutsEqual(layout, savedLayout),
    [layout, savedLayout]
  )

  return {
    layout,
    setProcessHeightRatio,
    setTreeWidthRatio,
    setOutputItemHeightRatio,
    setListHeightRatio,
    saveLayout,
    isDirty,
  }
}
