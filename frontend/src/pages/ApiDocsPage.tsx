import { useCallback, useEffect, useMemo, useState } from 'react'
import { ErpScreen } from '../components/erp/ErpScreen'
import {
  methodLabel,
  parseOpenApi,
  type ApiEndpoint,
  type OpenApiInfo,
} from '../utils/openapi'

const SWAGGER_URL = 'http://127.0.0.1:8000/docs'

function MethodBadge({ method }: { method: ApiEndpoint['method'] }) {
  return <span className={`api-method api-method-${method}`}>{methodLabel(method)}</span>
}

export function ApiDocsPage() {
  const [info, setInfo] = useState<OpenApiInfo | null>(null)
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/openapi.json')
      if (!res.ok) throw new Error(`Failed to load OpenAPI (${res.status})`)
      const doc = await res.json()
      const parsed = parseOpenApi(doc)
      setInfo(parsed.info)
      setEndpoints(parsed.endpoints)
      setTags(parsed.tags)
      setSelectedId((prev) => {
        if (prev && parsed.endpoints.some((e) => e.id === prev)) return prev
        return parsed.endpoints[0]?.id ?? null
      })
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Failed to load API specification. Is the backend running on port 8000?',
      )
      setInfo(null)
      setEndpoints([])
      setTags([])
      setSelectedId(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return endpoints.filter((e) => {
      if (tagFilter && e.tag !== tagFilter) return false
      if (!q) return true
      return (
        e.path.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.tag.toLowerCase().includes(q) ||
        e.method.includes(q) ||
        e.operationId.toLowerCase().includes(q)
      )
    })
  }, [endpoints, query, tagFilter])

  const selected = useMemo(
    () => filtered.find((e) => e.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  )

  useEffect(() => {
    if (selectedId && filtered.some((e) => e.id === selectedId)) return
    setSelectedId(filtered[0]?.id ?? null)
  }, [filtered, selectedId])

  return (
    <ErpScreen
      error={error}
      className="erp-api-docs"
      title={info?.title ?? 'API Documentation'}
      onRefresh={() => void load()}
    >
      <div className="erp-panel erp-panel-search">
        <div className="erp-panel-body erp-search-body">
          <div className="erp-search-row erp-api-search-row">
            <div className="erp-api-info">
              <strong>{info?.title ?? 'API Documentation'}</strong>
              {info?.version ? <span className="erp-api-version">v{info.version}</span> : null}
              {info?.description ? (
                <p className="erp-api-desc muted">{info.description}</p>
              ) : null}
            </div>
            <label className="erp-search-field erp-search-field-reference">
              <input
                type="search"
                className="erp-input"
                value={query}
                placeholder="Filter path, summary, tag…"
                aria-label="Filter endpoints"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="erp-search-field erp-search-field-supplier">
              <select
                className={`erp-input${tagFilter === '' ? ' erp-input-empty' : ''}`}
                value={tagFilter}
                aria-label="Filter by tag"
                onChange={(e) => setTagFilter(e.target.value)}
              >
                <option value="">All tags</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>
            <div className="erp-search-actions">
              <a
                className="btn erp-btn erp-btn-search"
                href={SWAGGER_URL}
                target="_blank"
                rel="noreferrer"
              >
                Swagger UI
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="erp-panel erp-panel-grow erp-api-list-panel">
        <div className="erp-panel-title">Endpoints ({filtered.length})</div>
        <div className="erp-panel-content">
          <div className="erp-toolbar">
            <div className="erp-toolbar-left">
              <button
                type="button"
                className={`erp-tab ${tagFilter === '' ? 'active' : ''}`}
                onClick={() => setTagFilter('')}
              >
                All
              </button>
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`erp-tab ${tagFilter === tag ? 'active' : ''}`}
                  onClick={() => setTagFilter(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="muted erp-grid-empty">Loading API specification…</p>
          ) : filtered.length === 0 ? (
            <p className="muted erp-grid-empty">No endpoints match the filter.</p>
          ) : (
            <div className="erp-grid-wrap erp-grid-wrap-header">
              <table className="erp-grid erp-api-endpoints-grid">
                <thead>
                  <tr>
                    <th style={{ width: 72 }}>Method</th>
                    <th style={{ width: 280 }}>Path</th>
                    <th style={{ width: 120 }}>Tag</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={`${idx % 2 === 1 ? 'row-alt' : ''}${selected?.id === row.id ? ' selected' : ''}`}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <td>
                        <MethodBadge method={row.method} />
                      </td>
                      <td>
                        <code className="erp-api-path">{row.path}</code>
                      </td>
                      <td>{row.tag}</td>
                      <td title={row.summary}>{row.summary || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="erp-panel erp-panel-grow erp-detail-panel erp-api-detail-panel">
        <div className="erp-panel-body erp-panel-content">
          {!selected ? (
            <p className="muted erp-grid-empty erp-detail-hint">
              Select an endpoint above to view parameters and responses.
            </p>
          ) : (
            <>
              <div className="erp-panel-title erp-api-op-title">
                <MethodBadge method={selected.method} />
                <code className="erp-api-path">{selected.path}</code>
              </div>
              <div className="erp-detail-content erp-api-detail-content">
                {selected.summary ? (
                  <p className="erp-api-summary">
                    <strong>{selected.summary}</strong>
                  </p>
                ) : null}
                {selected.description && selected.description !== selected.summary ? (
                  <p className="muted erp-api-description">{selected.description}</p>
                ) : null}
                {selected.operationId ? (
                  <p className="muted erp-api-operation-id">
                    Operation ID: <code>{selected.operationId}</code>
                  </p>
                ) : null}
                {selected.requestBody ? (
                  <p className="erp-api-request-body">
                    <span className="erp-api-section-label">Request body:</span>{' '}
                    {selected.requestBody}
                  </p>
                ) : null}

                <div className="erp-api-section">
                  <div className="erp-panel-title">Parameters</div>
                  {selected.parameters.length === 0 ? (
                    <p className="muted erp-grid-empty">No parameters.</p>
                  ) : (
                    <div className="erp-grid-wrap erp-grid-wrap-detail">
                      <table className="erp-grid erp-api-params-grid">
                        <thead>
                          <tr>
                            <th style={{ width: 140 }}>Name</th>
                            <th style={{ width: 72 }}>In</th>
                            <th style={{ width: 64 }}>Required</th>
                            <th style={{ width: 100 }}>Type</th>
                            <th>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.parameters.map((p, idx) => (
                            <tr key={`${p.name}-${p.in}`} className={idx % 2 === 1 ? 'row-alt' : ''}>
                              <td>
                                <code>{p.name}</code>
                              </td>
                              <td>{p.in}</td>
                              <td className="erp-col-num">{p.required ? 'Yes' : '—'}</td>
                              <td>{p.type || '—'}</td>
                              <td title={p.description}>{p.description || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="erp-api-section">
                  <div className="erp-panel-title">Responses</div>
                  {selected.responses.length === 0 ? (
                    <p className="muted erp-grid-empty">No responses defined.</p>
                  ) : (
                    <div className="erp-grid-wrap erp-grid-wrap-detail">
                      <table className="erp-grid erp-api-responses-grid">
                        <thead>
                          <tr>
                            <th style={{ width: 72 }}>Status</th>
                            <th>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.responses.map((r, idx) => (
                            <tr key={r.status} className={idx % 2 === 1 ? 'row-alt' : ''}>
                              <td className="erp-col-num">
                                <span className={`api-status api-status-${r.status.charAt(0)}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td title={r.description}>{r.description || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </ErpScreen>
  )
}
