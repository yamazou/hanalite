import type { ReactNode } from 'react'
import { ReloadButton } from './ReloadButton'
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
  onRefresh?: () => void | Promise<void>
  refreshLabel?: string
  refreshSuccessMessage?: string
  refreshDisabled?: boolean
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
  refreshLabel = 'Reset',
  refreshSuccessMessage,
  refreshDisabled,
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
        <ReloadButton
          onReload={onRefresh}
          disabled={refreshDisabled}
          label={refreshLabel}
          successMessage={refreshSuccessMessage}
        />
      ) : null}
    </>
  )
}
