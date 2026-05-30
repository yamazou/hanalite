import type { ReactNode } from 'react'
import { SaveGridButton } from './SaveGridButton'

type Props = {
  titleActions?: ReactNode
  showSaveGridButton?: boolean
  onSaveGrid?: () => void
  saveGridIsDirty?: boolean
  saveGridDisabled?: boolean
  saveGridLabel?: string
  saveGridSuccessMessage?: string
  saveGridNoChangesMessage?: string
  onRefresh?: () => void
  refreshLabel?: string
}

export function ErpTitleBarActions({
  titleActions,
  showSaveGridButton = false,
  onSaveGrid,
  saveGridIsDirty,
  saveGridDisabled,
  saveGridLabel,
  saveGridSuccessMessage,
  saveGridNoChangesMessage,
  onRefresh,
  refreshLabel = 'Refresh',
}: Props) {
  const showSaveGrid = showSaveGridButton || onSaveGrid != null
  if (!titleActions && !showSaveGrid && !onRefresh) return null
  return (
    <>
      {titleActions}
      {showSaveGrid ? (
        <SaveGridButton
          onSave={onSaveGrid ?? (() => {})}
          isDirty={saveGridIsDirty}
          disabled={saveGridDisabled}
          label={saveGridLabel}
          successMessage={saveGridSuccessMessage}
          noChangesMessage={saveGridNoChangesMessage}
        />
      ) : null}
      {onRefresh ? (
        <button type="button" className="btn erp-btn erp-btn-clear" onClick={onRefresh}>
          {refreshLabel}
        </button>
      ) : null}
    </>
  )
}
