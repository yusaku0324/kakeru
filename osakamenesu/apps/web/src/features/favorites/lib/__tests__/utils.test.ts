import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  normalizeId,
  isMockMode,
  isClientMockMode,
  FAVORITES_MOCK_COOKIE_NAME,
  SHOP_FAVORITES_MOCK_COOKIE_NAME,
  DEFAULT_SHOP_ID,
} from '../utils'

describe('favorites/lib/utils', () => {
  describe('normalizeId', () => {
    it('returns null for null input', () => {
      expect(normalizeId(null)).toBeNull()
    })

    it('returns null for undefined input', () => {
      expect(normalizeId(undefined)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(normalizeId('')).toBeNull()
    })

    it('returns null for whitespace-only string', () => {
      expect(normalizeId('   ')).toBeNull()
      expect(normalizeId('\t')).toBeNull()
      expect(normalizeId('\n')).toBeNull()
    })

    it('trims whitespace from id', () => {
      expect(normalizeId('  abc  ')).toBe('abc')
      expect(normalizeId(' test-id ')).toBe('test-id')
    })

    it('returns valid id as-is', () => {
      expect(normalizeId('valid-id')).toBe('valid-id')
      expect(normalizeId('12345')).toBe('12345')
    })
  })

  describe('isMockMode', () => {
    const originalEnv = process.env

    beforeEach(() => {
      vi.resetModules()
      process.env = { ...originalEnv }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('returns false when FAVORITES_E2E_MODE is real', () => {
      process.env.FAVORITES_E2E_MODE = 'real'
      expect(isMockMode()).toBe(false)
    })

    it('returns true when FAVORITES_E2E_MODE is mock', () => {
      process.env.FAVORITES_E2E_MODE = 'mock'
      expect(isMockMode()).toBe(true)
    })

    it('handles case-insensitive FAVORITES_E2E_MODE', () => {
      process.env.FAVORITES_E2E_MODE = 'REAL'
      expect(isMockMode()).toBe(false)

      process.env.FAVORITES_E2E_MODE = 'MOCK'
      expect(isMockMode()).toBe(true)
    })

    it('falls back to FAVORITES_API_MODE when E2E mode not set', () => {
      delete process.env.FAVORITES_E2E_MODE
      process.env.FAVORITES_API_MODE = 'mock'
      expect(isMockMode()).toBe(true)
    })

    it('falls back to NEXT_PUBLIC_FAVORITES_API_MODE', () => {
      delete process.env.FAVORITES_E2E_MODE
      delete process.env.FAVORITES_API_MODE
      process.env.NEXT_PUBLIC_FAVORITES_API_MODE = 'mock'
      expect(isMockMode()).toBe(true)
    })

    it('returns false when no mock mode env vars are set', () => {
      delete process.env.FAVORITES_E2E_MODE
      delete process.env.FAVORITES_API_MODE
      delete process.env.NEXT_PUBLIC_FAVORITES_API_MODE
      expect(isMockMode()).toBe(false)
    })
  })

  describe('isClientMockMode', () => {
    const originalEnv = process.env

    beforeEach(() => {
      vi.resetModules()
      process.env = { ...originalEnv }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('returns true when NEXT_PUBLIC_FAVORITES_API_MODE includes mock', () => {
      process.env.NEXT_PUBLIC_FAVORITES_API_MODE = 'mock'
      expect(isClientMockMode()).toBe(true)
    })

    it('returns true when FAVORITES_API_MODE includes mock', () => {
      delete process.env.NEXT_PUBLIC_FAVORITES_API_MODE
      process.env.FAVORITES_API_MODE = 'mock'
      expect(isClientMockMode()).toBe(true)
    })

    it('returns false when no mock mode is set', () => {
      delete process.env.NEXT_PUBLIC_FAVORITES_API_MODE
      delete process.env.FAVORITES_API_MODE
      expect(isClientMockMode()).toBe(false)
    })
  })

  describe('constants', () => {
    it('exports cookie name constants', () => {
      expect(FAVORITES_MOCK_COOKIE_NAME).toBe('osakamenesu_favorites_mock')
      expect(SHOP_FAVORITES_MOCK_COOKIE_NAME).toBe('osakamenesu_shop_favorites_mock')
    })

    it('exports default shop ID', () => {
      expect(DEFAULT_SHOP_ID).toBe('00000001-0000-0000-0000-000000000001')
    })
  })
})
