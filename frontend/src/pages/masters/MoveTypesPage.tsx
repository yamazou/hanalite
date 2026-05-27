import { useCallback } from 'react'
import { api } from '../../api/client'
import { SimpleMasterPage } from '../../components/masters/SimpleMasterPage'

export function MoveTypesPage() {
  const loadRows = useCallback(
    () =>
      api.listMovetypsMaster().then((rows) =>
        rows.map((r) => ({
          id: r.movetyps_id,
          name: r.movetyps_nm,
          created_at: r.created_at,
        }))
      ),
    []
  )

  return (
    <SimpleMasterPage
      title="Move Types"
      nameLabel="Name"
      placeholder="GR, GI..."
      loadRows={loadRows}
      onCreate={(name) => api.createMoveTyp(name).then(() => undefined)}
      onDelete={(id) => api.deleteMoveTyp(id)}
    />
  )
}
