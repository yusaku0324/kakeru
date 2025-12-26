import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  normalizeId,
  isMockMode,
  isClientMockMode,
  FAVORITES_MOCK_COOKIE_NAME,
  SHOP_FAVORITES_MOCK_COOKIE_NAME,
  DEFAULT_SHOP_ID,
} from '../lib/utils'

describe('favorites utils', () => {
  describe('normalizeId', () => {
    it('returns null for null input', () => {
      expect(normalizeId(null)).toBe(null)
    })

    it('returns null for undefined input', () => {
      expect(normalizeId(undefined)).toBe(null)
    })

    it('returns null for empty string', () => {
      expect(normalizeId('')).toBe(null)
    })

    it('returns null for whitespace-only string', () => {
      expect(normalizeId('   ')).toBe(null)
    })

    it('trims and returns valid string', () => {
      expect(normalizeId('  abc123  ')).toBe('abc123')
    })

    it('returns valid string as-is', () => {
      expect(normalizeId('valid-id')).toBe('valid-id')
    })
  })

  describe('isMockMode', () => {
    beforeEach(() => {
      vi.resetModules()
      vi.unstubAllEnvs()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('returns false when FAVORITES_E2E_MODE is "real"', async () => {
      vi.stubEnv('FAVORITES_E2E_MODE', 'real')

      const { isMockMode } = await import('../lib/utils')
      expect(isMockMode()).toBe(false)
    })

    it('returns true when FAVORITES_E2E_MODE is "mock"', async () => {
      vi.stubEnv('FAVORITES_E2E_MODE', 'mock')

      const { isMockMode } = await import('../lib/utils')
      expect(isMockMode()).toBe(true)
    })

    it('is case-insensitive for FAVORITES_E2E_MODE', async () => {
      vi.stubEnv('FAVORITES_E2E_MODE', 'MOCK')

      const { isMockMode } = await import('../lib/utils')
      expect(isMockMode()).toBe(true)
    })
  })

  describe('isClientMockMode', () => {
    beforeEach(() => {
      vi.resetModules()
      vi.unstubAllEnvs()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('returns true when NEXT_PUBLIC_FAVORITES_API_MODE includes "mock"', async () => {
      vi.stubEnv('NEXT_PUBLIC_FAVORITES_API_MODE', 'mock')

      const { isClientMockMode } = await import('../lib/utils')
      expect(isClientMockMode()).toBe(true)
    })

    it('returns true when FAVORITES_API_MODE includes "mock"', async () => {
      vi.stubEnv('FAVORITES_API_MODE', 'mock-local')

      const { isClientMockMode } = await import('../lib/utils')
      expect(isClientMockMode()).toBe(true)
    })
  })

  describe('constants', () => {
    it('has correct FAVORITES_MOCK_COOKIE_NAME', () => {
      expect(FAVORITES_MOCK_COOKIE_NAME).toBe('osakamenesu_favorites_mock')
    })

    it('has correct SHOP_FAVORITES_MOCK_COOKIE_NAME', () => {
      expect(SHOP_FAVORITES_MOCK_COOKIE_NAME).toBe('osakamenesu_shop_favorites_mock')
    })

    it('has correct DEFAULT_SHOP_ID', () => {
      expect(DEFAULT_SHOP_ID).toBe('00000001-0000-0000-0000-000000000001')
    })
  })
})
