import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, isCsrfProtectedMethod } from '@/lib/csrf'

export function getBrowserCsrfToken(): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const pattern = new RegExp(`(?:^|;\s*)${CSRF_COOKIE_NAME}=([^;]*)`)
  const match = document.cookie.match(pattern)
  return match ? decodeURIComponent(match[1]) : null
}

export function withCredentials(init: RequestInit = {}): RequestInit {
  return { ...init, credentials: 'include' as RequestCredentials }
}

function attachCsrfHeader(init: RequestInit, method: string): RequestInit {
  if (typeof window === 'undefined') {
    return init
  }

  if (!isCsrfProtectedMethod(method)) {
    return init
  }

  const token = getBrowserCsrfToken()
  if (!token) {
    return init
  }

  const headers = new Headers(init.headers ?? {})
  if (!headers.has(CSRF_HEADER_NAME)) {
    headers.set(CSRF_HEADER_NAME, token)
  }

  return { ...init, headers }
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const method = (init.method ?? 'GET').toUpperCase()
  const baseInit = withCredentials(init)
  const finalInit = attachCsrfHeader(baseInit, method)
  return fetch(input, finalInit)
}
