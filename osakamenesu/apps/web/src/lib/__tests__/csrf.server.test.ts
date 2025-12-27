import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse, type NextRequest } from 'next/server'

// Mock dependencies
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
}

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}))

vi.mock('../session', () => ({
  sessionCookieOptions: () => ({
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 604800,
    domain: undefined,
  }),
}))

vi.mock('../csrf', () => ({
  CSRF_COOKIE_NAME: 'csrf_token',
  CSRF_HEADER_NAME: 'X-CSRF-Token',
  validateCsrfToken: vi.fn(() => true),
}))

import {
  generateCsrfToken,
  csrfCookieOptions,
  setCsrfCookie,
  clearCsrfCookie,
  getCsrfToken,
  validateCsrfToken,
} from '../csrf.server'
import { CSRF_COOKIE_NAME } from '../csrf'

describe('csrf.server', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateCsrfToken', () => {
    it('generates a token without hyphens', () => {
      const token = generateCsrfToken()

      expect(token).not.toContain('-')
    })

    it('generates unique tokens', () => {
      const token1 = generateCsrfToken()
      const token2 = generateCsrfToken()

      expect(token1).not.toBe(token2)
    })

    it('generates 32-character tokens', () => {
      const token = generateCsrfToken()

      // UUID without hyphens is 32 characters
      expect(token).toHaveLength(32)
    })

    it('generates hexadecimal tokens', () => {
      const token = generateCsrfToken()

      expect(token).toMatch(/^[a-f0-9]+$/i)
    })
  })

  describe('csrfCookieOptions', () => {
    it('returns cookie options based on session options', () => {
      const options = csrfCookieOptions()

      expect(options.sameSite).toBe('lax')
      expect(options.secure).toBe(false)
      expect(options.path).toBe('/')
      expect(options.maxAge).toBe(604800)
    })

    it('includes domain from session options', () => {
      const options = csrfCookieOptions()

      expect(options.domain).toBeUndefined()
    })
  })

  describe('setCsrfCookie', () => {
    it('sets CSRF cookie on response', () => {
      const mockResponse = {
        cookies: {
          set: vi.fn(),
        },
      } as unknown as NextResponse

      setCsrfCookie(mockResponse, 'test-token-123')

      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'csrf_token',
          value: 'test-token-123',
          httpOnly: false,
        }),
      )
    })

    it('sets httpOnly to false for client access', () => {
      const mockResponse = {
        cookies: {
          set: vi.fn(),
        },
      } as unknown as NextResponse

      setCsrfCookie(mockResponse, 'token')

      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        expect.objectContaining({
          httpOnly: false,
        }),
      )
    })
  })

  describe('clearCsrfCookie', () => {
    it('clears CSRF cookie by setting empty value', () => {
      const mockResponse = {
        cookies: {
          set: vi.fn(),
        },
      } as unknown as NextResponse

      clearCsrfCookie(mockResponse)

      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'csrf_token',
          value: '',
          maxAge: 0,
          expires: new Date(0),
        }),
      )
    })

    it('sets httpOnly to false when clearing', () => {
      const mockResponse = {
        cookies: {
          set: vi.fn(),
        },
      } as unknown as NextResponse

      clearCsrfCookie(mockResponse)

      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        expect.objectContaining({
          httpOnly: false,
        }),
      )
    })
  })

  describe('getCsrfToken', () => {
    it('returns token when cookie exists', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'existing-token' })

      const token = await getCsrfToken()

      expect(token).toBe('existing-token')
      expect(mockCookieStore.get).toHaveBeenCalledWith('csrf_token')
    })

    it('returns null when cookie does not exist', async () => {
      mockCookieStore.get.mockReturnValue(undefined)

      const token = await getCsrfToken()

      expect(token).toBeNull()
    })

    it('returns null when cookie value is undefined', async () => {
      mockCookieStore.get.mockReturnValue({})

      const token = await getCsrfToken()

      expect(token).toBeNull()
    })
  })

  describe('validateCsrfToken', () => {
    it('validates request CSRF token', () => {
      const mockRequest = {} as NextRequest

      const result = validateCsrfToken(mockRequest)

      expect(result).toBe(true)
    })
  })
})
