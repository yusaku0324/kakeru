/**
 * Scope-specific HTTP clients for authenticated API requests.
 *
 * Each client handles:
 * - Cookie-based authentication (credentials: 'include')
 * - CSRF token attachment for mutating requests
 * - API base URL resolution with fallback
 * - Consistent error handling
 */

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, isCsrfProtectedMethod } from '@/lib/csrf'
import { buildApiUrl, resolveApiBases } from '@/lib/api'

// ============================================================================
// Types
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type ApiScope = 'site' | 'dashboard' | 'admin'

export type ApiRequestOptions = {
  method?: HttpMethod
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  cache?: RequestCache
  /** Server-side only: Pass cookie header for SSR requests */
  cookieHeader?: string
}

export type ApiSuccessResult<T> = { ok: true; status: number; data: T }
export type ApiErrorResult = { ok: false; status: number; error: string; detail?: unknown }
export type ApiResult<T> = ApiSuccessResult<T> | ApiErrorResult

// ============================================================================
// CSRF Token Helpers
// ============================================================================

function getBrowserCsrfToken(): string | null {
  if (typeof document === 'undefined') {
    return null
  }
  const pattern = new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`)
  const match = document.cookie.match(pattern)
  return match ? decodeURIComponent(match[1]) : null
}

function attachCsrfHeader(headers: Headers, method: string): void {
  if (typeof window === 'undefined') return
  if (!isCsrfProtectedMethod(method)) return

  const token = getBrowserCsrfToken()
  if (token && !headers.has(CSRF_HEADER_NAME)) {
    headers.set(CSRF_HEADER_NAME, token)
  }
}

// ============================================================================
// Base HTTP Client
// ============================================================================

async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<T>> {
  const {
    method = 'GET',
    body,
    headers: customHeaders,
    signal,
    cache = 'no-store',
    cookieHeader,
  } = options

  const headers = new Headers(customHeaders ?? {})
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  // Server-side: use explicit cookie header; Client-side: use credentials
  if (cookieHeader) {
    headers.set('cookie', cookieHeader)
  }
  attachCsrfHeader(headers, method)

  const init: RequestInit = {
    method,
    headers,
    credentials: cookieHeader ? 'omit' : 'include',
    cache,
    signal,
  }

  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }

  let lastError: string = 'Request failed'

  for (const base of resolveApiBases()) {
    try {
      const url = buildApiUrl(base, path)
      const response = await fetch(url, init)

      if (response.ok) {
        const contentType = response.headers.get('content-type')
        if (response.status === 204 || !contentType?.includes('json')) {
          return { ok: true, status: response.status, data: undefined as T }
        }
        const data = (await response.json()) as T
        return { ok: true, status: response.status, data }
      }

      // Handle error responses
      let detail: unknown
      try {
        detail = await response.json()
      } catch {
        detail = undefined
      }

      const errorMessage =
        typeof detail === 'object' && detail !== null
          ? (detail as Record<string, unknown>).detail ?? (detail as Record<string, unknown>).message
          : undefined

      return {
        ok: false,
        status: response.status,
        error: typeof errorMessage === 'string' ? errorMessage : `HTTP ${response.status}`,
        detail,
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error'
      // Try next base
    }
  }

  return { ok: false, status: 0, error: lastError }
}

// ============================================================================
// Scope-Specific Clients
// ============================================================================

/**
 * Site API client - for guest/user features (favorites, reviews, etc.)
 * Uses `osakamenesu_site_session` cookie
 */
export const siteClient = {
  get<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(`api/site/${path}`, { ...options, method: 'GET' })
  },
  post<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(`api/site/${path}`, { ...options, method: 'POST', body })
  },
  put<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(`api/site/${path}`, { ...options, method: 'PUT', body })
  },
  patch<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(`api/site/${path}`, { ...options, method: 'PATCH', body })
  },
  delete<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(`api/site/${path}`, { ...options, method: 'DELETE' })
  },
}

/**
 * Dashboard API client - for shop staff features
 * Uses `osakamenesu_dashboard_session` cookie
 */
export const dashboardClient = {
  get<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(`api/dashboard/${path}`, { ...options, method: 'GET' })
  },
  post<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(`api/dashboard/${path}`, { ...options, method: 'POST', body })
  },
  put<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(`api/dashboard/${path}`, { ...options, method: 'PUT', body })
  },
  patch<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(`api/dashboard/${path}`, { ...options, method: 'PATCH', body })
  },
  delete<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(`api/dashboard/${path}`, { ...options, method: 'DELETE' })
  },
  /**
   * Upload file using FormData (multipart/form-data)
   * Does not set Content-Type header to let browser set it with boundary
   */
  async uploadFormData<T>(
    path: string,
    formData: FormData,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ): Promise<ApiResult<T>> {
    const { signal, cache = 'no-store', cookieHeader } = options ?? {}

    const headers: Record<string, string> = {}
    if (cookieHeader) {
      headers.cookie = cookieHeader
    }

    // Attach CSRF token for browser requests
    if (typeof window !== 'undefined') {
      const pattern = new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`)
      const match = document.cookie.match(pattern)
      if (match) {
        headers[CSRF_HEADER_NAME] = decodeURIComponent(match[1])
      }
    }

    const init: RequestInit = {
      method: 'POST',
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      credentials: cookieHeader ? 'omit' : 'include',
      cache,
      signal,
      body: formData,
    }

    let lastError: string = 'Request failed'

    for (const base of resolveApiBases()) {
      try {
        const url = buildApiUrl(base, `api/dashboard/${path}`)
        const response = await fetch(url, init)

        if (response.ok) {
          const contentType = response.headers.get('content-type')
          if (response.status === 204 || !contentType?.includes('json')) {
            return { ok: true, status: response.status, data: undefined as T }
          }
          const data = (await response.json()) as T
          return { ok: true, status: response.status, data }
        }

        // Handle error responses
        let detail: unknown
        try {
          detail = await response.json()
        } catch {
          detail = undefined
        }

        const errorMessage =
          typeof detail === 'object' && detail !== null
            ? (detail as Record<string, unknown>).detail ?? (detail as Record<string, unknown>).message
            : undefined

        return {
          ok: false,
          status: response.status,
          error: typeof errorMessage === 'string' ? errorMessage : `HTTP ${response.status}`,
          detail,
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Network error'
        // Try next base
      }
    }

    return { ok: false, status: 0, error: lastError }
  },
}

/**
 * Auth API client - for authentication endpoints
 * No scope prefix, handles both site and dashboard auth
 */
export const authClient = {
  get<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(`api/auth/${path}`, { ...options, method: 'GET' })
  },
  post<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(`api/auth/${path}`, { ...options, method: 'POST', body })
  },
}

// ============================================================================
// Admin API Client (Server-side only, uses X-Admin-Key)
// ============================================================================

type AdminRequestOptions = Omit<ApiRequestOptions, 'cookieHeader'> & {
  /** Admin API key - required for all admin requests */
  adminKey: string
  /** Optional Basic Auth credentials */
  basicAuth?: { user: string; pass: string }
}

async function adminApiRequest<T>(
  path: string,
  options: AdminRequestOptions,
): Promise<ApiResult<T>> {
  const { method = 'GET', body, headers: customHeaders, signal, cache = 'no-store', adminKey, basicAuth } = options

  const headers = new Headers(customHeaders ?? {})
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  // Admin auth headers
  if (adminKey) {
    headers.set('X-Admin-Key', adminKey)
  }
  if (basicAuth?.user && basicAuth?.pass) {
    const credentials = Buffer.from(`${basicAuth.user}:${basicAuth.pass}`, 'utf8').toString('base64')
    headers.set('Authorization', `Basic ${credentials}`)
  }

  const init: RequestInit = {
    method,
    headers,
    cache,
    signal,
  }

  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }

  let lastError: string = 'Request failed'

  for (const base of resolveApiBases()) {
    try {
      const url = buildApiUrl(base, path)
      const response = await fetch(url, init)

      if (response.ok) {
        const contentType = response.headers.get('content-type')
        if (response.status === 204 || !contentType?.includes('json')) {
          return { ok: true, status: response.status, data: undefined as T }
        }
        const data = (await response.json()) as T
        return { ok: true, status: response.status, data }
      }

      // Handle error responses
      let detail: unknown
      try {
        detail = await response.json()
      } catch {
        detail = undefined
      }

      const errorMessage =
        typeof detail === 'object' && detail !== null
          ? (detail as Record<string, unknown>).detail ?? (detail as Record<string, unknown>).message
          : undefined

      return {
        ok: false,
        status: response.status,
        error: typeof errorMessage === 'string' ? errorMessage : `HTTP ${response.status}`,
        detail,
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error'
      // Try next base
    }
  }

  return { ok: false, status: 0, error: lastError }
}

type AdminClientOptions = {
  adminKey: string
  basicAuth?: { user: string; pass: string }
}

/**
 * Create an Admin API client instance
 * Server-side only - uses X-Admin-Key header authentication
 *
 * Usage:
 * ```ts
 * const adminClient = createAdminClient({ adminKey: process.env.ADMIN_API_KEY! })
 * const result = await adminClient.get<Shop[]>('shops')
 * ```
 */
export function createAdminClient(clientOptions: AdminClientOptions) {
  const { adminKey, basicAuth } = clientOptions

  return {
    get<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body' | 'cookieHeader'>) {
      return adminApiRequest<T>(`api/admin/${path}`, { ...options, method: 'GET', adminKey, basicAuth })
    },
    post<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body' | 'cookieHeader'>) {
      return adminApiRequest<T>(`api/admin/${path}`, { ...options, method: 'POST', body, adminKey, basicAuth })
    },
    put<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body' | 'cookieHeader'>) {
      return adminApiRequest<T>(`api/admin/${path}`, { ...options, method: 'PUT', body, adminKey, basicAuth })
    },
    patch<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body' | 'cookieHeader'>) {
      return adminApiRequest<T>(`api/admin/${path}`, { ...options, method: 'PATCH', body, adminKey, basicAuth })
    },
    delete<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body' | 'cookieHeader'>) {
      return adminApiRequest<T>(`api/admin/${path}`, { ...options, method: 'DELETE', adminKey, basicAuth })
    },
  }
}

/**
 * Generic API request (for paths that don't fit a specific client)
 */
export { apiRequest }
