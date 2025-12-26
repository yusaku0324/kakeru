import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getBrowserCsrfToken, withCredentials, apiFetch } from '../http'
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../csrf'

describe('getBrowserCsrfToken', () => {
  const originalDocument = global.document

  afterEach(() => {
    if (originalDocument) {
      Object.defineProperty(global, 'document', {
        value: originalDocument,
        writable: true,
      })
    }
  })

  it('returns null when document is undefined (server-side)', () => {
    Object.defineProperty(global, 'document', {
      value: undefined,
      writable: true,
    })
    expect(getBrowserCsrfToken()).toBeNull()
  })

  it('returns null when cookie is not found', () => {
    Object.defineProperty(global, 'document', {
      value: { cookie: 'other_cookie=value' },
      writable: true,
    })
    expect(getBrowserCsrfToken()).toBeNull()
  })

  it('returns token when CSRF cookie exists', () => {
    Object.defineProperty(global, 'document', {
      value: { cookie: `${CSRF_COOKIE_NAME}=test-token-123` },
      writable: true,
    })
    expect(getBrowserCsrfToken()).toBe('test-token-123')
  })

  it('returns token when CSRF cookie is among other cookies', () => {
    Object.defineProperty(global, 'document', {
      value: { cookie: `other=value;${CSRF_COOKIE_NAME}=my-token;another=data` },
      writable: true,
    })
    expect(getBrowserCsrfToken()).toBe('my-token')
  })

  it('decodes URL-encoded token', () => {
    Object.defineProperty(global, 'document', {
      value: { cookie: `${CSRF_COOKIE_NAME}=token%20with%20spaces` },
      writable: true,
    })
    expect(getBrowserCsrfToken()).toBe('token with spaces')
  })
})

describe('withCredentials', () => {
  it('adds credentials: include to empty init', () => {
    const result = withCredentials()
    expect(result).toEqual({ credentials: 'include' })
  })

  it('adds credentials: include to existing init', () => {
    const result = withCredentials({ method: 'POST' })
    expect(result).toEqual({ method: 'POST', credentials: 'include' })
  })

  it('preserves existing options', () => {
    const result = withCredentials({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    expect(result).toEqual({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
  })
})

describe('apiFetch', () => {
  const originalFetch = global.fetch
  const originalWindow = global.window

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(new Response('{}'))
    global.window = {} as typeof globalThis.window
    Object.defineProperty(global, 'document', {
      value: { cookie: `${CSRF_COOKIE_NAME}=csrf-token-abc` },
      writable: true,
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    global.window = originalWindow as typeof globalThis.window
  })

  it('calls fetch with credentials included', async () => {
    await apiFetch('/api/test')
    expect(global.fetch).toHaveBeenCalled()
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(init.credentials).toBe('include')
  })

  it('does not add CSRF header for GET requests', async () => {
    await apiFetch('/api/test', { method: 'GET' })
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    // GET requests don't get CSRF headers, so headers may be undefined or not contain the CSRF token
    const headers = init.headers instanceof Headers ? init.headers : new Headers(init.headers)
    expect(headers.has(CSRF_HEADER_NAME)).toBe(false)
  })

  it('adds CSRF header for POST requests', async () => {
    await apiFetch('/api/test', { method: 'POST' })
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(init.headers.get(CSRF_HEADER_NAME)).toBe('csrf-token-abc')
  })

  it('adds CSRF header for PUT requests', async () => {
    await apiFetch('/api/test', { method: 'PUT' })
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(init.headers.get(CSRF_HEADER_NAME)).toBe('csrf-token-abc')
  })

  it('adds CSRF header for DELETE requests', async () => {
    await apiFetch('/api/test', { method: 'DELETE' })
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(init.headers.get(CSRF_HEADER_NAME)).toBe('csrf-token-abc')
  })

  it('does not override existing CSRF header', async () => {
    const headers = new Headers()
    headers.set(CSRF_HEADER_NAME, 'existing-token')
    await apiFetch('/api/test', { method: 'POST', headers })
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(init.headers.get(CSRF_HEADER_NAME)).toBe('existing-token')
  })

  it('defaults to GET method', async () => {
    await apiFetch('/api/test')
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    // GET doesn't need CSRF, so no header should be added
    const headers = init.headers instanceof Headers ? init.headers : new Headers(init.headers)
    expect(headers.has(CSRF_HEADER_NAME)).toBe(false)
  })
})
