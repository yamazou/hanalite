import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export type GridContextMenuState = {
  x: number
  y: number
} | null

type Props = {
  menu: GridContextMenuState
  excelLabel: string
  onExcel: () => void
  onClose: () => void
}

export function GridContextMenu({ menu, excelLabel, onExcel, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menu, onClose])

  if (!menu) return null

  let left = menu.x
  let top = menu.y
  const width = 120
  if (left + width > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - width - 8)
  }
  if (top + 40 > window.innerHeight - 8) {
    top = Math.max(8, window.innerHeight - 48)
  }

  return createPortal(
    <div
      ref={panelRef}
      className="erp-grid-context-menu"
      style={{ left, top }}
      role="menu"
    >
      <button
        type="button"
        className="erp-grid-context-item"
        role="menuitem"
        onClick={() => {
          onExcel()
          onClose()
        }}
      >
        {excelLabel}
      </button>
    </div>,
    document.body
  )
}
