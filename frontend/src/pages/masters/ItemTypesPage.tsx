import { useCallback } from 'react'
import { api } from '../../api/client'
import { SimpleMasterPage } from '../../components/masters/SimpleMasterPage'

export function ItemTypesPage() {
  const loadRows = useCallback(
    () =>
      api.listItemtyps().then((rows) =>
        rows.map((r) => ({
          id: r.itemtyp_id,
          name: r.itemtyp_nm,
          created_at: r.created_at,
        }))
      ),
    []
  )

  return (
    <SimpleMasterPage
      title="Item Types"
      nameLabel="Name"
      placeholder="RM, WIP, FG..."
      loadRows={loadRows}
      onCreate={(name) => api.createItemTyp(name).then(() => undefined)}
      onDelete={(id) => api.deleteItemTyp(id)}
    />
  )
}
