import { describe, it, expect, vi, beforeEach } from 'vitest'
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
})
