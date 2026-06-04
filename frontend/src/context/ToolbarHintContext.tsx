import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type FocusEvent,
  type ReactNode,
} from 'react'

type ToolbarHintContextValue = {
  registerClear: (fn: () => void) => () => void
  clearToolbarHints: () => void
}

const ToolbarHintContext = createContext<ToolbarHintContextValue | null>(null)

function isGridUserActionTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.closest('button, a[href], [role="button"], .main-tab')) return false
  return el.closest('input, textarea, select, [contenteditable="true"]') != null
}

export function ToolbarHintProvider({ children }: { children: ReactNode }) {
  const listenersRef = useRef(new Set<() => void>())

  const registerClear = useCallback((fn: () => void) => {
    listenersRef.current.add(fn)
    return () => {
      listenersRef.current.delete(fn)
    }
  }, [])

  const clearToolbarHints = useCallback(() => {
    listenersRef.current.forEach((fn) => fn())
  }, [])

  const onFocusCapture = useCallback(
    (e: FocusEvent) => {
      if (isGridUserActionTarget(e.target)) clearToolbarHints()
    },
    [clearToolbarHints]
  )

  return (
    <ToolbarHintContext.Provider value={{ registerClear, clearToolbarHints }}>
      <div className="erp-toolbar-hint-scope" onFocusCapture={onFocusCapture}>
        {children}
      </div>
    </ToolbarHintContext.Provider>
  )
}

export function useToolbarHintContext(): ToolbarHintContextValue | null {
  return useContext(ToolbarHintContext)
}

/** Register a callback cleared when the user edits a grid field or starts another toolbar action. */
export function useRegisterToolbarHintClear(clear: () => void): void {
  const ctx = useToolbarHintContext()
  useEffect(() => {
    if (!ctx) return
    return ctx.registerClear(clear)
  }, [ctx, clear])
}
