import { NextResponse } from 'next/server'

import { getServerConfig } from '@/lib/server-config'

const SERVER_CONFIG = getServerConfig()

/**
 * Get the list of API base URLs to try (internal first, then public)
 */
export function resolveBases(): string[] {
  return [SERVER_CONFIG.internalApiBase, SERVER_CONFIG.publicApiBase]
}

/**
 * Standard API error response structure
 */
export type ApiErrorResponse = {
  detail: string
  status?: number
  code?: string
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  detail: string,
  status: number,
  code?: string,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ detail, status, code }, { status })
}

/**
 * Parse JSON body from request with error handling
 */
export async function parseRequestBody<T = Record<string, unknown>>(
  req: Request,
): Promise<{ data: T } | { error: NextResponse<ApiErrorResponse> }> {
  try {
    const data = (await req.json()) as T
    return { data }
  } catch {
    return { error: createErrorResponse('invalid JSON body', 400, 'INVALID_JSON') }
  }
}

/**
 * Parse response text as JSON, falling back to wrapping text in detail field
 */
export function parseResponseJson(text: string): Record<string, unknown> | null {
  if (!text) return null
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { detail: text }
  }
}

/**
 * Options for proxyToBackend
 */
export type ProxyOptions = {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Path on the backend (e.g., /api/guest/reservations) */
  path: string
  /** Request body (for POST/PUT/PATCH) */
  body?: string
  /** Additional headers */
  headers?: Record<string, string>
  /** Transform successful response before returning */
  transformResponse?: (json: Record<string, unknown>) => Record<string, unknown>
}

/**
 * Proxy a request to the backend, trying multiple bases with fallback
 */
export async function proxyToBackend(
  options: ProxyOptions,
): Promise<NextResponse<Record<string, unknown> | ApiErrorResponse>> {
  const { method, path, body, headers = {}, transformResponse } = options
  const bases = resolveBases()

  let lastError: { status?: number; body?: unknown } | null = null

  for (const base of bases) {
    try {
      const resp = await fetch(`${base}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body,
        cache: 'no-store',
      })

      const text = await resp.text()
      const json = parseResponseJson(text)

      if (resp.ok) {
        const responseData = transformResponse && json ? transformResponse(json) : json
        return NextResponse.json(responseData, { status: resp.status })
      }

      lastError = { status: resp.status, body: json }
    } catch (err) {
      console.error(`Error calling backend ${base}${path}:`, err)
      lastError = { body: err }
    }
  }

  if (lastError?.status && lastError.body) {
    return NextResponse.json(lastError.body as Record<string, unknown>, {
      status: lastError.status,
    })
  }

  return createErrorResponse('service unavailable', 503, 'SERVICE_UNAVAILABLE')
}
