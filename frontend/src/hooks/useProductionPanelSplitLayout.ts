import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGridLayoutScope } from '../context/AuthContext'
import {
  DEFAULT_PANEL_SPLIT_LAYOUT,
  loadPanelSplitLayout,
  panelSplitLayoutsEqual,
  persistPanelSplitLayout,
  type StoredPanelSplitLayout,
} from '../utils/splitLayoutStorage'

export function useProductionPanelSplitLayout(layoutId: string) {
  const layoutScope = useGridLayoutScope()

  const load = useCallback(
    () => loadPanelSplitLayout(layoutId, DEFAULT_PANEL_SPLIT_LAYOUT, layoutScope),
    [layoutId, layoutScope]
  )

  const [layout, setLayout] = useState<StoredPanelSplitLayout>(load)
  const [savedLayout, setSavedLayout] = useState<StoredPanelSplitLayout>(load)

  useEffect(() => {
    const loaded = load()
    setLayout(loaded)
    setSavedLayout(loaded)
  }, [load])

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
    persistPanelSplitLayout(layoutId, snapshot, layoutScope)
    setSavedLayout(snapshot)
  }, [layoutId, layout, layoutScope])

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
