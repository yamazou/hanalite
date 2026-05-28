import { FormEvent, useCallback, useEffect, useState } from 'react'
import { ErpGridPanel, erpRowClass } from '../erp/ErpGridPanel'
import { ErpScreen } from '../erp/ErpScreen'
import { ErpSearchPanel } from '../erp/ErpSearchPanel'
import { masterIdNameColumns } from '../erp/masterGridColumns'
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
  gridId: string
  loadRows: () => Promise<Row[]>
  onCreate: (name: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

export function SimpleMasterPage({
  title,
  nameLabel,
  placeholder,
  gridId,
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
    <ErpScreen error={error} success={success}>
      <ErpSearchPanel>
        <form onSubmit={onSubmit} className="erp-search-form">
          <label className="erp-search-field erp-search-field-grow">
            <input
              className="erp-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={placeholder ?? nameLabel}
              aria-label={nameLabel}
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
        gridId={gridId}
        title={title}
        columns={masterIdNameColumns}
        loading={loading}
        isEmpty={!loading && rows.length === 0}
        onRefresh={load}
      >
        {(layout) => (
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className={erpRowClass(index)}>
                {layout.orderedColumns.map((col) => {
                  switch (col.key) {
                    case 'id':
                      return <td key={col.key}>{row.id}</td>
                    case 'name':
                      return <td key={col.key}>{row.name}</td>
                    case 'created':
                      return <td key={col.key}>{formatDateTime(row.created_at)}</td>
                    case 'actions':
                      return (
                        <td key={col.key} className="erp-col-actions">
                          <button
                            type="button"
                            className="btn erp-btn erp-btn-cancel"
                            onClick={() => handleDelete(row.id)}
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
