import { useCallback } from 'react'
import { api } from '../../api/client'
import { MasterNameEditPage } from '../../components/masters/MasterNameEditPage'

export function SuppliersPage() {
  const loadRecords = useCallback(
    () =>
      api.listSuppliersMaster().then((rows) =>
        rows.map((r) => ({ id: r.suppliers_id, name: r.suppliers_nm }))
      ),
    []
  )

  return (
    <MasterNameEditPage
      title="Suppliers"
      gridId="masters-suppliers-edit-v1"
      nameLabel="Supplier Name"
      sheetName="Suppliers"
      filenamePrefix="suppliers"
      loadRecords={loadRecords}
      createRecord={(name) => api.createSupplier(name).then(() => undefined)}
      updateRecord={(id, name) => api.updateSupplier(id, name).then(() => undefined)}
      deleteRecord={(id) => api.deleteSupplier(id).then(() => undefined)}
    />
  )
}
