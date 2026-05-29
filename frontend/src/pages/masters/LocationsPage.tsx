import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel, erpRowClass } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { ErpSearchPanel } from '../../components/erp/ErpSearchPanel'
import { masterLocationColumns } from '../../components/erp/masterGridColumns'
import type { LocationMaster } from '../../types/masters'

export function LocationsPage() {
  const [rows, setRows] = useState<LocationMaster[]>([])
  const locationTypes: Array<LocationMaster['location_type']> = ['RM', 'Process', 'NG', 'FG']
  const [editId, setEditId] = useState<number | null>(null)
  const [locationCd, setLocationCd] = useState('')
  const [locationNm, setLocationNm] = useState('')
  const [locationType, setLocationType] = useState<LocationMaster['location_type']>('Process')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await api.listLocationsMaster())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const cd = locationCd.trim()
    const nm = locationNm.trim()
    if (!cd || !nm) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      if (editId) {
        await api.updateLocation(editId, cd, nm, locationType)
      } else {
        await api.createLocation(cd, nm, locationType)
      }
      setEditId(null)
      setLocationCd('')
      setLocationNm('')
      setLocationType('Process')
      setSuccess('Saved.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete?')) return
    setError(null)
    setSuccess(null)
    try {
      await api.deleteLocation(id)
      if (editId === id) {
        setEditId(null)
        setLocationCd('')
        setLocationNm('')
        setLocationType('Process')
      }
      setSuccess('Deleted.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const startEdit = (row: LocationMaster) => {
    setEditId(row.location_id)
    setLocationCd(row.location_cd)
    setLocationNm(row.location_nm)
    setLocationType(row.location_type)
    setError(null)
    setSuccess(null)
  }

  const cancelEdit = () => {
    setEditId(null)
    setLocationCd('')
    setLocationNm('')
    setLocationType('Process')
  }

  return (
    <ErpScreen error={error} success={success}>
      <ErpSearchPanel>
        <form onSubmit={onSubmit} className="erp-search-form">
          <label className="erp-search-field erp-search-field-grow">
            <input
              className="erp-input"
              value={locationCd}
              onChange={(e) => setLocationCd(e.target.value)}
              placeholder="Location Code"
              aria-label="Location Code"
              required
            />
          </label>
          <label className="erp-search-field erp-search-field-grow">
            <input
              className="erp-input"
              value={locationNm}
              onChange={(e) => setLocationNm(e.target.value)}
              placeholder="Location Name"
              aria-label="Location Name"
              required
            />
          </label>
          <label className="erp-search-field">
            <select
              className="erp-input"
              value={locationType}
              onChange={(e) => setLocationType(e.target.value as LocationMaster['location_type'])}
              aria-label="Location Type"
              required
            >
              {locationTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <div className="erp-search-actions">
            <button type="submit" className="btn erp-btn erp-btn-search" disabled={submitting}>
              {submitting ? 'Saving…' : editId ? 'Update' : 'Save'}
            </button>
            {editId && (
              <button type="button" className="btn erp-btn erp-btn-clear" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </ErpSearchPanel>

      <ErpGridPanel
        gridId="masters-locations-v1"
        title="Locations"
        columns={masterLocationColumns}
        loading={loading}
        isEmpty={!loading && rows.length === 0}
        onRefresh={load}
      >
        {(layout) => (
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.location_id}
                className={erpRowClass(index, editId === row.location_id)}
                onClick={() => startEdit(row)}
              >
                {layout.orderedColumns.map((col) => {
                  switch (col.key) {
                    case 'id':
                      return <td key={col.key}>{row.location_id}</td>
                    case 'code':
                      return (
                        <td key={col.key}>
                          <code>{row.location_cd}</code>
                        </td>
                      )
                    case 'name':
                      return <td key={col.key}>{row.location_nm}</td>
                    case 'type':
                      return <td key={col.key}>{row.location_type}</td>
                    case 'actions':
                      return (
                        <td
                          key={col.key}
                          className="erp-col-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="btn erp-btn erp-btn-search"
                            onClick={() => startEdit(row)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn erp-btn erp-btn-cancel"
                            onClick={() => handleDelete(row.location_id)}
                          >
                            Delete
                          </button>
                        </td>
                      )
                    default:
                      return <td key={col.key} />
                  }
                })}
              </tr>
            ))}
          </tbody>
        )}
      </ErpGridPanel>
    </ErpScreen>
  )
}
