import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Alert } from '../Alert'
import { formatDateTime } from '../../utils/format'

type Row = {
  id: number
  name: string
  created_at?: string | null
}

type SimpleMasterPageProps = {
  title: string
  nameLabel: string
  placeholder?: string
  loadRows: () => Promise<Row[]>
  onCreate: (name: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

export function SimpleMasterPage({
  title,
  nameLabel,
  placeholder,
  loadRows,
  onCreate,
  onDelete,
}: SimpleMasterPageProps) {
  const [rows, setRows] = useState<Row[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await loadRows())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [loadRows])

  useEffect(() => {
    load()
  }, [load])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      await onCreate(trimmed)
      setName('')
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
      await onDelete(id)
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
          <h1>{title}</h1>
        </div>
      </header>

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      <div className="grid-2">
        <div className="card">
          <h2>Add</h2>
          <form onSubmit={onSubmit}>
            <label>
              {nameLabel}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={placeholder}
                required
              />
            </label>
            <div className="form-actions">
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
                  <th>Name</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.name}</td>
                    <td>{formatDateTime(row.created_at)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(row.id)}
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
