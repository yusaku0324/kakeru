import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextResponse } from 'next/server'

// Mock getServerConfig
vi.mock('@/lib/server-config', () => ({
  getServerConfig: () => ({
    internalApiBase: 'http://internal:8000',
    publicApiBase: 'http://public:8000',
  }),
}))

import {
  resolveBases,
  createErrorResponse,
  parseRequestBody,
  parseResponseJson,
  proxyToBackend,
} from '../route-helpers'

describe('route-helpers', () => {
  describe('resolveBases', () => {
    it('returns internal and public bases', () => {
      const bases = resolveBases()
      expect(bases).toEqual(['http://internal:8000', 'http://public:8000'])
    })
  })

  describe('createErrorResponse', () => {
    it('creates a JSON response with error details', async () => {
      const response = createErrorResponse('something went wrong', 400, 'BAD_REQUEST')
      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(400)

      const body = await response.json()
      expect(body).toEqual({
        detail: 'something went wrong',
        status: 400,
        code: 'BAD_REQUEST',
      })
    })

    it('works without code', async () => {
      const response = createErrorResponse('not found', 404)
      const body = await response.json()
      expect(body.detail).toBe('not found')
      expect(body.status).toBe(404)
    })
  })

  describe('parseRequestBody', () => {
    it('parses valid JSON body', async () => {
      const req = new Request('http://test.com', {
        method: 'POST',
        body: JSON.stringify({ name: 'test', value: 123 }),
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await parseRequestBody(req)
      expect('data' in result).toBe(true)
      if ('data' in result) {
        expect(result.data).toEqual({ name: 'test', value: 123 })
      }
    })

    it('returns error for invalid JSON', async () => {
      const req = new Request('http://test.com', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await parseRequestBody(req)
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.status).toBe(400)
      }
    })
  })

  describe('parseResponseJson', () => {
    it('parses valid JSON string', () => {
      const result = parseResponseJson('{"key": "value"}')
      expect(result).toEqual({ key: 'value' })
    })

    it('returns null for empty string', () => {
      const result = parseResponseJson('')
      expect(result).toBeNull()
    })

    it('wraps non-JSON text in detail field', () => {
      const result = parseResponseJson('plain text error')
      expect(result).toEqual({ detail: 'plain text error' })
    })
  })

  describe('proxyToBackend', () => {
    const originalFetch = global.fetch

    beforeEach(() => {
      global.fetch = vi.fn()
    })

    afterEach(() => {
      global.fetch = originalFetch
    })

    it('returns successful response from first base', async () => {
      const mockResponse = { id: '123', name: 'test' }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      })

      const result = await proxyToBackend({
        method: 'GET',
        path: '/api/test',
      })

      expect(result.status).toBe(200)
      const body = await result.json()
      expect(body).toEqual(mockResponse)
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://internal:8000/api/test',
        expect.objectContaining({ method: 'GET' })
      )
    })

    it('falls back to second base when first fails', async () => {
      const mockResponse = { success: true }
      ;(global.fetch as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(mockResponse)),
        })

      const result = await proxyToBackend({
        method: 'GET',
        path: '/api/fallback',
      })

      expect(result.status).toBe(200)
      const body = await result.json()
      expect(body).toEqual(mockResponse)
      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'http://public:8000/api/fallback',
        expect.any(Object)
      )
    })

    it('returns error response when backend returns error', async () => {
      const errorResponse = { detail: 'Not found', code: 'NOT_FOUND' }
      // Mock both bases to return the same error (internal fails, public also fails)
      ;(global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: () => Promise.resolve(JSON.stringify(errorResponse)),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: () => Promise.resolve(JSON.stringify(errorResponse)),
        })

      const result = await proxyToBackend({
        method: 'GET',
        path: '/api/not-found',
      })

      expect(result.status).toBe(404)
      const body = await result.json()
      expect(body).toEqual(errorResponse)
    })

    it('returns 503 when all bases fail', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Internal connection failed'))
        .mockRejectedValueOnce(new Error('Public connection failed'))

      const result = await proxyToBackend({
        method: 'GET',
        path: '/api/unavailable',
      })

      expect(result.status).toBe(503)
      const body = await result.json()
      expect(body.detail).toBe('service unavailable')
      expect(body.code).toBe('SERVICE_UNAVAILABLE')
    })

    it('applies transformResponse to successful response', async () => {
      const mockResponse = { items: [1, 2, 3], total: 3 }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      })

      const result = await proxyToBackend({
        method: 'GET',
        path: '/api/transform',
        transformResponse: (json) => ({
          ...json,
          transformed: true,
        }),
      })

      expect(result.status).toBe(200)
      const body = await result.json()
      expect(body).toEqual({ items: [1, 2, 3], total: 3, transformed: true })
    })

    it('sends body for POST requests', async () => {
      const requestBody = { name: 'test', value: 42 }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: () => Promise.resolve(JSON.stringify({ id: 'new-id' })),
      })

      await proxyToBackend({
        method: 'POST',
        path: '/api/create',
        body: JSON.stringify(requestBody),
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://internal:8000/api/create',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
        })
      )
    })

    it('includes custom headers', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{}'),
      })

      await proxyToBackend({
        method: 'GET',
        path: '/api/auth',
        headers: {
          Authorization: 'Bearer token123',
          'X-Custom-Header': 'custom-value',
        },
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer token123',
            'X-Custom-Header': 'custom-value',
          }),
        })
      )
    })

    it('handles non-JSON error response from backend', async () => {
      // Mock both bases to return the same non-JSON error
      ;(global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        })

      const result = await proxyToBackend({
        method: 'GET',
        path: '/api/error',
      })

      expect(result.status).toBe(500)
      const body = await result.json()
      expect(body).toEqual({ detail: 'Internal Server Error' })
    })
  })
})
