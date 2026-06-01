type CloseFn = () => void

let activeClose: CloseFn | null = null

export function activateGridColumnFilter(close: CloseFn): void {
  if (activeClose && activeClose !== close) {
    activeClose()
  }
  activeClose = close
}

export function deactivateGridColumnFilter(close: CloseFn): void {
  if (activeClose === close) {
    activeClose = null
  }
}
