import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  dynamicImport,
  routePaths,
  preloadRoute,
} from '../dynamic-imports'

describe('dynamic-imports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('dynamicImport', () => {
    it('successfully imports on first try', async () => {
      const mockModule = { default: { name: 'TestComponent' } }
      const importFn = vi.fn().mockResolvedValue(mockModule)

      const result = await dynamicImport(importFn)

      expect(result).toBe(mockModule)
      expect(importFn).toHaveBeenCalledTimes(1)
    })

    it('retries on failure', async () => {
      const mockModule = { default: { name: 'TestComponent' } }
      const importFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(mockModule)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const resultPromise = dynamicImport(importFn, { retries: 3, retryDelay: 100 })

      // Run all timers to allow retries to complete
      await vi.runAllTimersAsync()

      const result = await resultPromise

      expect(result).toBe(mockModule)
      expect(importFn).toHaveBeenCalledTimes(3)
      consoleSpy.mockRestore()
    })

    it('throws after all retries exhausted', async () => {
      const error = new Error('Network error')
      const importFn = vi.fn().mockRejectedValue(error)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Catch the rejection immediately to prevent unhandled rejection warnings
      let caughtError: Error | null = null
      const resultPromise = dynamicImport(importFn, { retries: 2, retryDelay: 100 }).catch(e => {
        caughtError = e
      })

      // Run all timers to allow all retries to complete
      await vi.runAllTimersAsync()
      await resultPromise

      expect(caughtError).toBeInstanceOf(Error)
      expect((caughtError as Error).message).toBe('Network error')
      expect(importFn).toHaveBeenCalledTimes(2)
      consoleSpy.mockRestore()
    })

    it('calls onError callback on failure', async () => {
      const error = new Error('Import failed')
      const importFn = vi.fn().mockRejectedValue(error)
      const onError = vi.fn()

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Catch immediately to prevent unhandled rejection warnings
      let caughtError: Error | null = null
      const resultPromise = dynamicImport(importFn, { retries: 1, retryDelay: 10, onError }).catch(e => {
        caughtError = e
      })

      // Run all timers to complete retries
      await vi.runAllTimersAsync()
      await resultPromise

      expect(caughtError).toBeInstanceOf(Error)
      expect((caughtError as Error).message).toBe('Import failed')
      expect(onError).toHaveBeenCalledWith(error)
      consoleSpy.mockRestore()
    })

    it('uses default retry count of 3', async () => {
      const error = new Error('Network error')
      const importFn = vi.fn().mockRejectedValue(error)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Catch immediately to prevent unhandled rejection warnings
      let caughtError: Error | null = null
      const resultPromise = dynamicImport(importFn, { retryDelay: 10 }).catch(e => {
        caughtError = e
      })

      // Run all timers to complete all retries
      await vi.runAllTimersAsync()
      await resultPromise

      expect(caughtError).toBeInstanceOf(Error)
      expect(importFn).toHaveBeenCalledTimes(3)
      consoleSpy.mockRestore()
    })
  })

  describe('routePaths', () => {
    describe('static routes', () => {
      it('has correct home path', () => {
        expect(routePaths.home).toBe('/')
      })

      it('has correct shops path', () => {
        expect(routePaths.shops).toBe('/shops')
      })

      it('has correct therapists path', () => {
        expect(routePaths.therapists).toBe('/therapists')
      })

      it('has correct search path', () => {
        expect(routePaths.search).toBe('/search')
      })

      it('has correct login path', () => {
        expect(routePaths.login).toBe('/auth/login')
      })

      it('has correct guest routes', () => {
        expect(routePaths.guestReservations).toBe('/guest/reservations')
        expect(routePaths.guestSearch).toBe('/guest/search')
      })

      it('has correct dashboard path', () => {
        expect(routePaths.dashboard).toBe('/dashboard')
      })

      it('has correct admin routes', () => {
        expect(routePaths.adminDashboard).toBe('/admin')
        expect(routePaths.adminShops).toBe('/admin/shops')
        expect(routePaths.adminTherapists).toBe('/admin/therapists')
        expect(routePaths.adminReservations).toBe('/admin/reservations')
      })
    })

    describe('dynamic routes', () => {
      it('generates correct shop detail path', () => {
        expect(routePaths.shopDetail('my-shop')).toBe('/shops/my-shop')
      })

      it('generates correct therapist detail path', () => {
        expect(routePaths.therapistDetail('my-shop', 'therapist-123')).toBe(
          '/shops/my-shop/therapists/therapist-123'
        )
      })

      it('generates correct dashboard profile path', () => {
        expect(routePaths.dashboardProfile('profile-123')).toBe('/dashboard/profile-123')
      })

      it('generates correct dashboard shifts path', () => {
        expect(routePaths.dashboardShifts('profile-123')).toBe('/dashboard/profile-123/shifts')
      })

      it('generates correct dashboard reviews path', () => {
        expect(routePaths.dashboardReviews('profile-123')).toBe('/dashboard/profile-123/reviews')
      })

      it('generates correct admin shop detail path', () => {
        expect(routePaths.adminShopDetail('shop-456')).toBe('/admin/shops/shop-456')
      })
    })
  })

  describe('preloadRoute', () => {
    it('is a no-op function (Next.js handles prefetching)', () => {
      // Should not throw
      expect(() => preloadRoute('/some-path')).not.toThrow()
    })

    it('accepts any path string', () => {
      expect(() => preloadRoute('/')).not.toThrow()
      expect(() => preloadRoute('/shops/my-shop')).not.toThrow()
      expect(() => preloadRoute('/admin/shops')).not.toThrow()
    })
  })
})
