const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const

export type HttpMethod = (typeof HTTP_METHODS)[number]

export type ApiParameterRow = {
  name: string
  in: string
  required: boolean
  type: string
  description: string
}

export type ApiResponseRow = {
  status: string
  description: string
}

export type ApiEndpoint = {
  id: string
  method: HttpMethod
  path: string
  tag: string
  summary: string
  description: string
  operationId: string
  parameters: ApiParameterRow[]
  requestBody: string
  responses: ApiResponseRow[]
}

export type OpenApiInfo = {
  title: string
  version: string
  description: string
}

export type ParsedOpenApi = {
  info: OpenApiInfo
  endpoints: ApiEndpoint[]
  tags: string[]
}

type JsonSchema = {
  type?: string
  format?: string
  $ref?: string
  items?: JsonSchema
  properties?: Record<string, JsonSchema>
  required?: string[]
  description?: string
}

type OpenApiParameter = {
  name?: string
  in?: string
  required?: boolean
  description?: string
  schema?: JsonSchema
}

type OpenApiOperation = {
  tags?: string[]
  summary?: string
  description?: string
  operationId?: string
  parameters?: OpenApiParameter[]
  requestBody?: {
    description?: string
    content?: Record<string, { schema?: JsonSchema }>
  }
  responses?: Record<string, { description?: string }>
}

type OpenApiPathItem = Partial<Record<HttpMethod, OpenApiOperation>>

type OpenApiDocument = {
  info?: { title?: string; version?: string; description?: string }
  paths?: Record<string, OpenApiPathItem>
}

function schemaTypeLabel(schema?: JsonSchema): string {
  if (!schema) return ''
  if (schema.$ref) {
    const name = schema.$ref.split('/').pop()
    return name ?? 'object'
  }
  if (schema.type === 'array' && schema.items) {
    return `${schemaTypeLabel(schema.items)}[]`
  }
  if (schema.type) {
    return schema.format ? `${schema.type} (${schema.format})` : schema.type
  }
  return 'object'
}

function parseParameters(params: OpenApiParameter[] | undefined): ApiParameterRow[] {
  if (!params?.length) return []
  return params.map((p) => ({
    name: p.name ?? '',
    in: p.in ?? '',
    required: Boolean(p.required),
    type: schemaTypeLabel(p.schema),
    description: p.description?.trim() ?? '',
  }))
}

function parseRequestBody(body: OpenApiOperation['requestBody']): string {
  if (!body) return ''
  const parts: string[] = []
  if (body.description?.trim()) parts.push(body.description.trim())
  const content = body.content ?? {}
  for (const [media, spec] of Object.entries(content)) {
    const type = schemaTypeLabel(spec.schema)
    parts.push(type ? `${media}: ${type}` : media)
  }
  return parts.join(' · ')
}

function parseResponses(
  responses: OpenApiOperation['responses'] | undefined,
): ApiResponseRow[] {
  if (!responses) return []
  return Object.entries(responses)
    .map(([status, res]) => ({
      status,
      description: res.description?.trim() ?? '',
    }))
    .sort((a, b) => a.status.localeCompare(b.status, undefined, { numeric: true }))
}

export function parseOpenApi(doc: OpenApiDocument): ParsedOpenApi {
  const endpoints: ApiEndpoint[] = []

  for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
    if (!pathItem) continue
    for (const method of HTTP_METHODS) {
      const op = pathItem[method]
      if (!op) continue
      const tag = op.tags?.[0] ?? 'Other'
      const operationId = op.operationId ?? `${method}_${path}`
      endpoints.push({
        id: `${method}:${path}`,
        method,
        path,
        tag,
        summary: op.summary?.trim() ?? '',
        description: op.description?.trim() ?? '',
        operationId,
        parameters: parseParameters(op.parameters),
        requestBody: parseRequestBody(op.requestBody),
        responses: parseResponses(op.responses),
      })
    }
  }

  endpoints.sort((a, b) => {
    const tagCmp = a.tag.localeCompare(b.tag)
    if (tagCmp !== 0) return tagCmp
    const pathCmp = a.path.localeCompare(b.path)
    if (pathCmp !== 0) return pathCmp
    return a.method.localeCompare(b.method)
  })

  const tagSet = new Set(endpoints.map((e) => e.tag))
  const tags = [...tagSet].sort((a, b) => a.localeCompare(b))

  return {
    info: {
      title: doc.info?.title?.trim() ?? 'API',
      version: doc.info?.version?.trim() ?? '',
      description: doc.info?.description?.trim() ?? '',
    },
    endpoints,
    tags,
  }
}

export function methodLabel(method: HttpMethod): string {
  return method.toUpperCase()
}
