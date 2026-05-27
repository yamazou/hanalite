import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { Alert } from '../../components/Alert'
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
    <>
      <header className="page-header">
        <div>
          <h1>Locations</h1>
        </div>
      </header>

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      <div className="grid-2">
        <div className="card">
          <h2>Add Location</h2>
          <form className="form-grid" onSubmit={onSubmit}>
            <label className="full">
              Location Code
              <input
                value={locationCd}
                onChange={(e) => setLocationCd(e.target.value)}
                placeholder="WH-001"
                required
              />
            </label>
            <label className="full">
              Location Name
              <input
                value={locationNm}
                onChange={(e) => setLocationNm(e.target.value)}
                placeholder="Main Warehouse"
                required
              />
            </label>
            <div className="form-actions full">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="card-header-row">
            <h2>List</h2>
            <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
              Refresh
            </button>
          </div>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="muted">No data</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Code</th>
                  <th>Name</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.location_id}>
                    <td>{row.location_id}</td>
                    <td>
                      <code>{row.location_cd}</code>
                    </td>
                    <td>{row.location_nm}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(row.location_id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
