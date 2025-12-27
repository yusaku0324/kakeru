import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  siteClient,
  dashboardClient,
  authClient,
  createAdminClient,
  apiRequest,
  type ApiErrorResult,
} from '../http-clients'

vi.mock('../api', () => ({
  resolveApiBases: () => ['http://localhost:8000'],
  buildApiUrl: (base: string, path: string) => `${base}/${path}`,
}))

describe('http-clients', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('apiRequest', () => {
    it('makes GET request and returns success', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: 1, name: 'Test' }),
      })

      const result = await apiRequest<{ id: number; name: string }>('test/path')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual({ id: 1, name: 'Test' })
        expect(result.status).toBe(200)
      }
    })

    it('handles 204 No Content response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
      })

      const result = await apiRequest('test/path')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.status).toBe(204)
      }
    })

    it('handles non-JSON response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
      })

      const result = await apiRequest('test/path')

      expect(result.ok).toBe(true)
    })

    it('makes POST request with body', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ created: true }),
      })

      const result = await apiRequest('test/path', {
        method: 'POST',
        body: { name: 'Test' },
      })

      expect(result.ok).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Test' }),
        }),
      )
    })

    it('handles error response with detail', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ detail: 'Bad request' }),
      })

      const result = await apiRequest('test/path')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        const errorResult = result as ApiErrorResult
        expect(errorResult.status).toBe(400)
        expect(errorResult.error).toBe('Bad request')
      }
    })

    it('handles error response with message', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Internal server error' }),
      })

      const result = await apiRequest('test/path')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        const errorResult = result as ApiErrorResult
        expect(errorResult.error).toBe('Internal server error')
      }
    })

    it('handles error response without JSON', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => {
          throw new Error('Not JSON')
        },
      })

      const result = await apiRequest('test/path')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        const errorResult = result as ApiErrorResult
        expect(errorResult.error).toBe('HTTP 500')
      }
    })

    it('handles network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await apiRequest('test/path')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        const errorResult = result as ApiErrorResult
        expect(errorResult.error).toBe('Network error')
      }
    })

    it('includes cookie header when provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      })

      await apiRequest('test/path', {
        cookieHeader: 'session=abc123',
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'omit',
        }),
      )
    })

    it('uses credentials: include when no cookie header', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      })

      await apiRequest('test/path')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'include',
        }),
      )
    })

    it('supports AbortSignal', async () => {
      const controller = new AbortController()
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      })

      await apiRequest('test/path', { signal: controller.signal })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: controller.signal,
        }),
      )
    })
  })

  describe('siteClient', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      })
    })

    it('makes GET request with site prefix', async () => {
      await siteClient.get('favorites')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api/site/favorites'),
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('makes POST request with site prefix', async () => {
      await siteClient.post('favorites', { shopId: '123' })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api/site/favorites'),
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('makes PUT request with site prefix', async () => {
      await siteClient.put('profile', { name: 'Test' })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api/site/profile'),
        expect.objectContaining({ method: 'PUT' }),
      )
    })

    it('makes PATCH request with site prefix', async () => {
      await siteClient.patch('settings', { theme: 'dark' })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api/site/settings'),
        expect.objectContaining({ method: 'PATCH' }),
      )
    })

    it('makes DELETE request with site prefix', async () => {
      await siteClient.delete('favorites/123')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api/site/favorites/123'),
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })

  describe('dashboardClient', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      })
    })

    it('makes GET request with dashboard prefix', async () => {
      await dashboardClient.get('shops')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api/dashboard/shops'),
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('makes POST request with dashboard prefix', async () => {
      await dashboardClient.post('reservations', { date: '2024-01-01' })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api/dashboard/reservations'),
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('makes PUT request with dashboard prefix', async () => {
      await dashboardClient.put('shop/123', { name: 'Updated' })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api/dashboard/shop/123'),
        expect.objectContaining({ method: 'PUT' }),
      )
    })

    it('makes PATCH request with dashboard prefix', async () => {
      await dashboardClient.patch('settings', { notifications: true })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api/dashboard/settings'),
        expect.objectContaining({ method: 'PATCH' }),
      )
    })

    it('makes DELETE request with dashboard prefix', async () => {
      await dashboardClient.delete('staff/456')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api/dashboard/staff/456'),
        expect.objectContaining({ method: 'DELETE' }),
      )
    })

    describe('uploadFormData', () => {
      it('uploads FormData successfully', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ url: 'https://example.com/image.jpg' }),
        })

        const formData = new FormData()
        formData.append('file', new Blob(['test']), 'test.jpg')

        const result = await dashboardClient.uploadFormData('photos', formData)

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data).toEqual({ url: 'https://example.com/image.jpg' })
        }
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('api/dashboard/photos'),
          expect.objectContaining({
            method: 'POST',
            body: formData,
          }),
        )
      })

      it('handles 204 response', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 204,
          headers: new Headers(),
        })

        const formData = new FormData()
        const result = await dashboardClient.uploadFormData('photos', formData)

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.status).toBe(204)
        }
      })

      it('handles non-JSON success response', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/plain' }),
        })

        const formData = new FormData()
        const result = await dashboardClient.uploadFormData('photos', formData)

        expect(result.ok).toBe(true)
      })

      it('handles error response with detail', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ detail: 'File too large' }),
        })

        const formData = new FormData()
        const result = await dashboardClient.uploadFormData('photos', formData)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          const errorResult = result as ApiErrorResult
          expect(errorResult.error).toBe('File too large')
        }
      })

      it('handles error response with message', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ message: 'Upload failed' }),
        })

        const formData = new FormData()
        const result = await dashboardClient.uploadFormData('photos', formData)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          const errorResult = result as ApiErrorResult
          expect(errorResult.error).toBe('Upload failed')
        }
      })

      it('handles error response without JSON', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          headers: new Headers(),
          json: async () => {
            throw new Error('Not JSON')
          },
        })

        const formData = new FormData()
        const result = await dashboardClient.uploadFormData('photos', formData)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          const errorResult = result as ApiErrorResult
          expect(errorResult.error).toBe('HTTP 500')
        }
      })

      it('handles network error', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

        const formData = new FormData()
        const result = await dashboardClient.uploadFormData('photos', formData)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          const errorResult = result as ApiErrorResult
          expect(errorResult.error).toBe('Network error')
        }
      })

      it('includes cookie header when provided', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({}),
        })

        const formData = new FormData()
        await dashboardClient.uploadFormData('photos', formData, {
          cookieHeader: 'session=abc123',
        })

        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            credentials: 'omit',
          }),
        )
      })

      it('uses credentials: include when no cookie header', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({}),
        })

        const formData = new FormData()
        await dashboardClient.uploadFormData('photos', formData)

        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            credentials: 'include',
          }),
        )
      })

      it('supports AbortSignal', async () => {
        const controller = new AbortController()
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({}),
        })

        const formData = new FormData()
        await dashboardClient.uploadFormData('photos', formData, {
          signal: controller.signal,
        })

        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            signal: controller.signal,
          }),
        )
      })

      it('supports custom cache option', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({}),
        })

        const formData = new FormData()
        await dashboardClient.uploadFormData('photos', formData, {
          cache: 'force-cache',
        })

        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            cache: 'force-cache',
          }),
        )
      })
    })
  })

  describe('authClient', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      })
    })

    it('makes GET request with auth prefix', async () => {
      await authClient.get('me')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api/auth/me'),
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('makes POST request with auth prefix', async () => {
      await authClient.post('login', { email: 'test@example.com' })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api/auth/login'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  describe('createAdminClient', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      })
    })

    it('creates client with admin key header', async () => {
      const adminClient = createAdminClient({ adminKey: 'test-admin-key' })
      await adminClient.get('shops')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api/admin/shops'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Headers),
        }),
      )

      const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(options.headers.get('X-Admin-Key')).toBe('test-admin-key')
    })

    it('includes basic auth when provided', async () => {
      const adminClient = createAdminClient({
        adminKey: 'test-admin-key',
        basicAuth: { user: 'admin', pass: 'secret' },
      })
      await adminClient.get('shops')

      const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const authHeader = options.headers.get('Authorization')
      expect(authHeader).toMatch(/^Basic /)
    })

    it('makes POST request with body', async () => {
      const adminClient = createAdminClient({ adminKey: 'test-admin-key' })
      await adminClient.post('shops', { name: 'New Shop' })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api/admin/shops'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'New Shop' }),
        }),
      )
    })

    it('makes PUT request', async () => {
      const adminClient = createAdminClient({ adminKey: 'key' })
      await adminClient.put('shops/123', { name: 'Updated' })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api/admin/shops/123'),
        expect.objectContaining({ method: 'PUT' }),
      )
    })

    it('makes PATCH request', async () => {
      const adminClient = createAdminClient({ adminKey: 'key' })
      await adminClient.patch('shops/123', { status: 'active' })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api/admin/shops/123'),
        expect.objectContaining({ method: 'PATCH' }),
      )
    })

    it('makes DELETE request', async () => {
      const adminClient = createAdminClient({ adminKey: 'key' })
      await adminClient.delete('shops/123')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api/admin/shops/123'),
        expect.objectContaining({ method: 'DELETE' }),
      )
    })

    it('handles admin request error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ detail: 'Forbidden' }),
      })

      const adminClient = createAdminClient({ adminKey: 'invalid' })
      const result = await adminClient.get('shops')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        const errorResult = result as ApiErrorResult
        expect(errorResult.status).toBe(403)
        expect(errorResult.error).toBe('Forbidden')
      }
    })

    it('handles admin network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'))

      const adminClient = createAdminClient({ adminKey: 'key' })
      const result = await adminClient.get('shops')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        const errorResult = result as ApiErrorResult
        expect(errorResult.error).toBe('Connection refused')
      }
    })

    it('handles 204 response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
      })

      const adminClient = createAdminClient({ adminKey: 'key' })
      const result = await adminClient.delete('shops/123')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.status).toBe(204)
      }
    })
  })
})
