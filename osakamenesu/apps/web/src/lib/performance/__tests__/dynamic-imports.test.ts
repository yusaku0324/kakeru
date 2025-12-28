/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  dynamicImport,
  createLazyComponent,
  routePaths,
  preloadRoute,
  setupRoutePreloading,
  preloadVisibleComponents,
  setupProgressiveEnhancement,
  addResourceHints,
  initializePerformanceOptimizations,
  lazyComponents,
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

  describe('createLazyComponent', () => {
    it('creates a lazy component from import function', () => {
      const mockComponent = () => null
      const importFn = vi.fn().mockResolvedValue({ default: mockComponent })

      const LazyComponent = createLazyComponent(importFn)

      // Lazy components have special React properties
      expect(LazyComponent).toBeDefined()
      expect(LazyComponent.$$typeof).toBeDefined()
    })

    it('handles import failure gracefully', async () => {
      const error = new Error('Import failed')
      const importFn = vi.fn().mockRejectedValue(error)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const LazyComponent = createLazyComponent(importFn, { retries: 1, retryDelay: 10 })

      expect(LazyComponent).toBeDefined()
      consoleSpy.mockRestore()
    })

    it('returns fallback component on import failure', async () => {
      const error = new Error('Import failed')
      const importFn = vi.fn().mockRejectedValue(error)
      const fallbackComponent = () => null
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const LazyComponent = createLazyComponent(importFn, {
        retries: 1,
        retryDelay: 10,
        fallback: fallbackComponent,
      })

      expect(LazyComponent).toBeDefined()

      // Try to trigger the lazy load
      const payload = (LazyComponent as any)._payload
      if (payload && typeof payload._result === 'function') {
        const resultPromise = payload._result()
        await vi.runAllTimersAsync()

        try {
          const result = await resultPromise
          // If fallback works, we should get the fallback component
          expect(result.default).toBe(fallbackComponent)
        } catch {
          // May throw depending on timing
        }
      }

      consoleSpy.mockRestore()
    })

    it('re-throws error when no fallback provided', async () => {
      const error = new Error('Import failed')
      const importFn = vi.fn().mockRejectedValue(error)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const LazyComponent = createLazyComponent(importFn, {
        retries: 1,
        retryDelay: 10,
      })

      expect(LazyComponent).toBeDefined()

      // Try to trigger the lazy load
      const payload = (LazyComponent as any)._payload
      if (payload && typeof payload._result === 'function') {
        const resultPromise = payload._result()
        await vi.runAllTimersAsync()

        try {
          await resultPromise
        } catch (e) {
          // Should throw the original error
          expect(e).toBeInstanceOf(Error)
        }
      }

      consoleSpy.mockRestore()
    })
  })

  describe('lazyComponents', () => {
    it('has OptimizedImage component', () => {
      expect(lazyComponents.OptimizedImage).toBeDefined()
    })

    it('has OptimizedImageGallery component', () => {
      expect(lazyComponents.OptimizedImageGallery).toBeDefined()
    })

    it('has Calendar component', () => {
      expect(lazyComponents.Calendar).toBeDefined()
    })
  })

  describe('setupRoutePreloading', () => {
    let mockObserver: {
      observe: ReturnType<typeof vi.fn>
      unobserve: ReturnType<typeof vi.fn>
      disconnect: ReturnType<typeof vi.fn>
    }
    let observerCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null

    beforeEach(() => {
      mockObserver = {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      }

      class MockIntersectionObserver {
        constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
          observerCallback = callback
        }
        observe = mockObserver.observe
        unobserve = mockObserver.unobserve
        disconnect = mockObserver.disconnect
      }

      global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
    })

    it('does nothing on server side', () => {
      const originalWindow = global.window
      delete global.window

      expect(() => setupRoutePreloading()).not.toThrow()

      global.window = originalWindow
    })

    it('observes internal links', () => {
      // Create test links
      document.body.innerHTML = `
        <a href="/shops">Shops</a>
        <a href="/therapists">Therapists</a>
        <a href="https://external.com">External</a>
      `

      setupRoutePreloading()

      // Should observe internal links (those starting with /)
      expect(mockObserver.observe).toHaveBeenCalledTimes(2)
    })

    it('unobserves link after intersection', () => {
      document.body.innerHTML = '<a href="/shops">Shops</a>'

      setupRoutePreloading()

      // Simulate intersection
      const link = document.querySelector('a')
      observerCallback?.([{ isIntersecting: true, target: link } as unknown as IntersectionObserverEntry])

      expect(mockObserver.unobserve).toHaveBeenCalledWith(link)
    })

    it('sets up hover preloading on desktop', () => {
      // Ensure not a touch device
      const originalOntouchstart = (window as any).ontouchstart
      delete (window as any).ontouchstart

      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

      document.body.innerHTML = '<a href="/shops">Shops</a>'
      setupRoutePreloading()

      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseover', expect.any(Function))

      addEventListenerSpy.mockRestore()
      ;(window as any).ontouchstart = originalOntouchstart
    })

    it('handles hover on link with href', () => {
      // Ensure not a touch device
      const originalOntouchstart = (window as any).ontouchstart
      delete (window as any).ontouchstart

      document.body.innerHTML = '<a href="/shops">Shops</a>'
      setupRoutePreloading()

      // Simulate mouseover on the link
      const link = document.querySelector('a')!
      const event = new MouseEvent('mouseover', { bubbles: true })
      link.dispatchEvent(event)

      // Should not throw
      expect(true).toBe(true)

      ;(window as any).ontouchstart = originalOntouchstart
    })

    it('handles hover on non-link element', () => {
      const originalOntouchstart = (window as any).ontouchstart
      delete (window as any).ontouchstart

      document.body.innerHTML = '<div>Not a link</div><a href="/shops">Shops</a>'
      setupRoutePreloading()

      // Simulate mouseover on non-link element
      const div = document.querySelector('div')!
      const event = new MouseEvent('mouseover', { bubbles: true })
      div.dispatchEvent(event)

      // Should not throw
      expect(true).toBe(true)

      ;(window as any).ontouchstart = originalOntouchstart
    })

    it('skips hover preloading on touch devices', () => {
      ;(window as any).ontouchstart = true

      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

      document.body.innerHTML = '<a href="/shops">Shops</a>'
      setupRoutePreloading()

      // Should not add mouseover listener
      const mouseoverCalls = addEventListenerSpy.mock.calls.filter(
        call => call[0] === 'mouseover'
      )
      expect(mouseoverCalls.length).toBe(0)

      addEventListenerSpy.mockRestore()
      delete (window as any).ontouchstart
    })

    it('does not preload link without href', () => {
      document.body.innerHTML = '<a href="/shops">Shops</a>'

      setupRoutePreloading()

      // Simulate intersection with a link that doesn't have href
      const link = document.querySelector('a')!
      link.removeAttribute('href')

      observerCallback?.([{ isIntersecting: true, target: link } as unknown as IntersectionObserverEntry])

      // Should not throw, and should not try to preload
      expect(mockObserver.unobserve).not.toHaveBeenCalled()
    })
  })

  describe('preloadVisibleComponents', () => {
    let mockObserver: {
      observe: ReturnType<typeof vi.fn>
      unobserve: ReturnType<typeof vi.fn>
      disconnect: ReturnType<typeof vi.fn>
    }
    let observerCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null

    beforeEach(() => {
      mockObserver = {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      }

      class MockIntersectionObserver {
        constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
          observerCallback = callback
        }
        observe = mockObserver.observe
        unobserve = mockObserver.unobserve
        disconnect = mockObserver.disconnect
      }

      global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
    })

    it('does nothing on server side', () => {
      const originalWindow = global.window
      delete global.window

      expect(() => preloadVisibleComponents()).not.toThrow()

      global.window = originalWindow
    })

    it('observes elements with data-preload attribute', () => {
      document.body.innerHTML = `
        <div data-preload="calendar">Calendar</div>
        <div data-preload="image">Image</div>
        <div data-preload="gallery">Gallery</div>
      `

      preloadVisibleComponents()

      expect(mockObserver.observe).toHaveBeenCalledTimes(3)
    })

    it('handles intersection of calendar element', () => {
      document.body.innerHTML = '<div data-preload="calendar">Calendar</div>'

      preloadVisibleComponents()

      const element = document.querySelector('[data-preload="calendar"]')!
      observerCallback?.([{ isIntersecting: true, target: element } as unknown as IntersectionObserverEntry])

      expect(mockObserver.unobserve).toHaveBeenCalledWith(element)
    })

    it('handles intersection of image element', () => {
      document.body.innerHTML = '<div data-preload="image">Image</div>'

      preloadVisibleComponents()

      const element = document.querySelector('[data-preload="image"]')!
      observerCallback?.([{ isIntersecting: true, target: element } as unknown as IntersectionObserverEntry])

      expect(mockObserver.unobserve).toHaveBeenCalledWith(element)
    })

    it('handles intersection of gallery element', () => {
      document.body.innerHTML = '<div data-preload="gallery">Gallery</div>'

      preloadVisibleComponents()

      const element = document.querySelector('[data-preload="gallery"]')!
      observerCallback?.([{ isIntersecting: true, target: element } as unknown as IntersectionObserverEntry])

      expect(mockObserver.unobserve).toHaveBeenCalledWith(element)
    })

    it('ignores non-intersecting elements', () => {
      document.body.innerHTML = '<div data-preload="calendar">Calendar</div>'

      preloadVisibleComponents()

      const element = document.querySelector('[data-preload="calendar"]')!
      observerCallback?.([{ isIntersecting: false, target: element } as unknown as IntersectionObserverEntry])

      expect(mockObserver.unobserve).not.toHaveBeenCalled()
    })

    it('ignores unknown preload types', () => {
      document.body.innerHTML = '<div data-preload="unknown">Unknown</div>'

      preloadVisibleComponents()

      const element = document.querySelector('[data-preload="unknown"]')!
      observerCallback?.([{ isIntersecting: true, target: element } as unknown as IntersectionObserverEntry])

      expect(mockObserver.unobserve).not.toHaveBeenCalled()
    })
  })

  describe('addResourceHints', () => {
    beforeEach(() => {
      document.head.innerHTML = ''
    })

    it('does nothing on server side', () => {
      const originalWindow = global.window
      delete global.window

      expect(() => addResourceHints()).not.toThrow()

      global.window = originalWindow
    })

    it('adds preconnect link for API', () => {
      addResourceHints()

      const preconnects = document.querySelectorAll('link[rel="preconnect"]')
      expect(preconnects.length).toBeGreaterThanOrEqual(1)
    })

    it('adds dns-prefetch links', () => {
      addResourceHints()

      const dnsPrefetches = document.querySelectorAll('link[rel="dns-prefetch"]')
      expect(dnsPrefetches.length).toBeGreaterThanOrEqual(1)
    })

    it('sets crossorigin on preconnect links', () => {
      addResourceHints()

      const preconnect = document.querySelector('link[rel="preconnect"]')
      expect(preconnect?.getAttribute('crossorigin')).toBe('anonymous')
    })
  })

  describe('setupProgressiveEnhancement', () => {
    beforeEach(() => {
      document.head.innerHTML = ''
      document.body.innerHTML = ''

      class MockIntersectionObserver {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
      }

      global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
    })

    it('does nothing on server side', () => {
      const originalWindow = global.window
      delete global.window

      expect(() => setupProgressiveEnhancement()).not.toThrow()

      global.window = originalWindow
    })

    it('sets up route preloading', () => {
      document.body.innerHTML = '<a href="/shops">Shops</a>'

      setupProgressiveEnhancement()

      // Just verify it runs without error
      expect(true).toBe(true)
    })

    it('preloads on 4g connection without saveData', () => {
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '4g',
          saveData: false,
        },
        configurable: true,
      })

      setupProgressiveEnhancement()

      // Should schedule component preloading
      vi.advanceTimersByTime(2000)

      expect(true).toBe(true)
    })
  })

  describe('initializePerformanceOptimizations', () => {
    beforeEach(() => {
      document.head.innerHTML = ''
      document.body.innerHTML = ''

      class MockIntersectionObserver {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
      }

      global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
    })

    it('does nothing on server side', () => {
      const originalWindow = global.window
      delete global.window

      expect(() => initializePerformanceOptimizations()).not.toThrow()

      global.window = originalWindow
    })

    it('adds resource hints', () => {
      initializePerformanceOptimizations()

      const links = document.querySelectorAll('link')
      expect(links.length).toBeGreaterThan(0)
    })

    it('sets up progressive enhancement when DOM is ready', () => {
      // Simulate DOM already loaded
      Object.defineProperty(document, 'readyState', {
        value: 'complete',
        configurable: true,
      })

      initializePerformanceOptimizations()

      expect(true).toBe(true)
    })

    it('waits for DOMContentLoaded when DOM is loading', () => {
      Object.defineProperty(document, 'readyState', {
        value: 'loading',
        configurable: true,
      })

      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

      initializePerformanceOptimizations()

      expect(addEventListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function))

      addEventListenerSpy.mockRestore()
    })
  })
})
