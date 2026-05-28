import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { ErpGridPanel, erpRowClass } from '../../components/erp/ErpGridPanel'
import { ErpScreen } from '../../components/erp/ErpScreen'
import { ErpSearchPanel } from '../../components/erp/ErpSearchPanel'
import { masterLocationColumns } from '../../components/erp/masterGridColumns'
import type { LocationMaster } from '../../types/masters'

export function LocationsPage() {
  const [rows, setRows] = useState<LocationMaster[]>([])
  const [locationCd, setLocationCd] = useState('')
  const [locationNm, setLocationNm] = useState('')
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
      await api.createLocation(cd, nm)
      setLocationCd('')
      setLocationNm('')
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
      setSuccess('Deleted.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
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
          <div className="erp-search-actions">
            <button type="submit" className="btn erp-btn erp-btn-search" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
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
              <tr key={row.location_id} className={erpRowClass(index)}>
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
                    case 'actions':
                      return (
                        <td key={col.key} className="erp-col-actions">
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
