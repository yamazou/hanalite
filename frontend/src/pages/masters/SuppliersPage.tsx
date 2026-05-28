import { useCallback } from 'react'
import { api } from '../../api/client'
import { SimpleMasterPage } from '../../components/masters/SimpleMasterPage'

export function SuppliersPage() {
  const loadRows = useCallback(
    () =>
      api.listSuppliersMaster().then((rows) =>
        rows.map((r) => ({
          id: r.suppliers_id,
          name: r.suppliers_nm,
          created_at: r.created_at,
        }))
      ),
    []
  )

  return (
    <SimpleMasterPage
      title="Suppliers"
      gridId="masters-suppliers-v1"
      nameLabel="Name"
      loadRows={loadRows}
      onCreate={(name) => api.createSupplier(name).then(() => undefined)}
      onDelete={(id) => api.deleteSupplier(id)}
    />
  )
}
