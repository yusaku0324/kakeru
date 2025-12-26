import { describe, it, expect } from 'vitest'
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  isCsrfProtectedMethod,
  shouldBypassCsrf,
  validateCsrfToken,
} from '../csrf'

describe('CSRF constants', () => {
  it('has correct cookie name', () => {
    expect(CSRF_COOKIE_NAME).toBe('osakamenesu_csrf')
  })

  it('has correct header name', () => {
    expect(CSRF_HEADER_NAME).toBe('x-csrf-token')
  })
})

describe('isCsrfProtectedMethod', () => {
  it('returns true for POST', () => {
    expect(isCsrfProtectedMethod('POST')).toBe(true)
    expect(isCsrfProtectedMethod('post')).toBe(true)
  })

  it('returns true for PUT', () => {
    expect(isCsrfProtectedMethod('PUT')).toBe(true)
    expect(isCsrfProtectedMethod('put')).toBe(true)
  })

  it('returns true for PATCH', () => {
    expect(isCsrfProtectedMethod('PATCH')).toBe(true)
    expect(isCsrfProtectedMethod('patch')).toBe(true)
  })

  it('returns true for DELETE', () => {
    expect(isCsrfProtectedMethod('DELETE')).toBe(true)
    expect(isCsrfProtectedMethod('delete')).toBe(true)
  })

  it('returns false for GET', () => {
    expect(isCsrfProtectedMethod('GET')).toBe(false)
    expect(isCsrfProtectedMethod('get')).toBe(false)
  })

  it('returns false for HEAD', () => {
    expect(isCsrfProtectedMethod('HEAD')).toBe(false)
  })

  it('returns false for OPTIONS', () => {
    expect(isCsrfProtectedMethod('OPTIONS')).toBe(false)
  })
})

describe('shouldBypassCsrf', () => {
  it('returns true for /api/auth/login', () => {
    expect(shouldBypassCsrf('/api/auth/login')).toBe(true)
  })

  it('returns true for /api/auth/login with query params', () => {
    expect(shouldBypassCsrf('/api/auth/login?redirect=/')).toBe(true)
  })

  it('returns true for /api/health', () => {
    expect(shouldBypassCsrf('/api/health')).toBe(true)
  })

  it('returns false for other API routes', () => {
    expect(shouldBypassCsrf('/api/admin/shops')).toBe(false)
    expect(shouldBypassCsrf('/api/reservations')).toBe(false)
    expect(shouldBypassCsrf('/api/auth/logout')).toBe(false)
  })

  it('returns false for non-API routes', () => {
    expect(shouldBypassCsrf('/dashboard')).toBe(false)
    expect(shouldBypassCsrf('/')).toBe(false)
  })
})

describe('validateCsrfToken', () => {
  function createMockRequest(
    method: string,
    options: {
      headerToken?: string
      cookieToken?: string
    } = {}
  ): Request {
    const headers = new Headers()
    if (options.headerToken) {
      headers.set(CSRF_HEADER_NAME, options.headerToken)
    }
    if (options.cookieToken) {
      headers.set('cookie', `${CSRF_COOKIE_NAME}=${options.cookieToken}`)
    }
    return new Request('http://localhost/api/test', {
      method,
      headers,
    })
  }

  it('returns true for GET requests without token', () => {
    const request = createMockRequest('GET')
    expect(validateCsrfToken(request)).toBe(true)
  })

  it('returns true for HEAD requests without token', () => {
    const request = createMockRequest('HEAD')
    expect(validateCsrfToken(request)).toBe(true)
  })

  it('returns false for POST without header', () => {
    const request = createMockRequest('POST', { cookieToken: 'token123' })
    expect(validateCsrfToken(request)).toBe(false)
  })

  it('returns false for POST without cookie', () => {
    const request = createMockRequest('POST', { headerToken: 'token123' })
    expect(validateCsrfToken(request)).toBe(false)
  })

  it('returns true for POST with matching tokens', () => {
    const request = createMockRequest('POST', {
      headerToken: 'token123',
      cookieToken: 'token123',
    })
    expect(validateCsrfToken(request)).toBe(true)
  })

  it('returns false for POST with mismatched tokens', () => {
    const request = createMockRequest('POST', {
      headerToken: 'token123',
      cookieToken: 'different',
    })
    expect(validateCsrfToken(request)).toBe(false)
  })

  it('returns true for PUT with matching tokens', () => {
    const request = createMockRequest('PUT', {
      headerToken: 'token456',
      cookieToken: 'token456',
    })
    expect(validateCsrfToken(request)).toBe(true)
  })

  it('returns true for DELETE with matching tokens', () => {
    const request = createMockRequest('DELETE', {
      headerToken: 'token789',
      cookieToken: 'token789',
    })
    expect(validateCsrfToken(request)).toBe(true)
  })

  it('returns false for tokens with different lengths', () => {
    const request = createMockRequest('POST', {
      headerToken: 'short',
      cookieToken: 'muchlongertoken',
    })
    expect(validateCsrfToken(request)).toBe(false)
  })

  it('handles empty header token', () => {
    const request = createMockRequest('POST', {
      headerToken: '',
      cookieToken: 'token123',
    })
    expect(validateCsrfToken(request)).toBe(false)
  })
})
