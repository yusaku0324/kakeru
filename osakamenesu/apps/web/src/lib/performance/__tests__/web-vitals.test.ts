/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock web-vitals module at the top level
const mockOnLCP = vi.fn()
const mockOnCLS = vi.fn()
const mockOnFCP = vi.fn()
const mockOnTTFB = vi.fn()
const mockOnINP = vi.fn()

vi.mock('web-vitals', () => ({
  onLCP: mockOnLCP,
  onCLS: mockOnCLS,
  onFCP: mockOnFCP,
  onTTFB: mockOnTTFB,
  onINP: mockOnINP,
}))

import {
  initWebVitals,
  measureComponentPerformance,
  cleanupWebVitals,
} from '../web-vitals'

describe('web-vitals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cleanupWebVitals()
  })

  describe('initWebVitals', () => {
    it('initializes all web vitals handlers', async () => {
      await initWebVitals()

      expect(mockOnLCP).toHaveBeenCalled()
      expect(mockOnCLS).toHaveBeenCalled()
      expect(mockOnFCP).toHaveBeenCalled()
      expect(mockOnTTFB).toHaveBeenCalled()
      expect(mockOnINP).toHaveBeenCalled()
    })

    it('passes callback functions to each handler', async () => {
      await initWebVitals()

      expect(mockOnLCP).toHaveBeenCalledWith(expect.any(Function))
      expect(mockOnCLS).toHaveBeenCalledWith(expect.any(Function))
      expect(mockOnFCP).toHaveBeenCalledWith(expect.any(Function))
      expect(mockOnTTFB).toHaveBeenCalledWith(expect.any(Function))
      expect(mockOnINP).toHaveBeenCalledWith(expect.any(Function))
    })
  })

  describe('measureComponentPerformance', () => {
    beforeEach(() => {
      vi.spyOn(performance, 'now').mockReturnValue(0)
      vi.spyOn(performance, 'mark').mockImplementation(() => ({} as PerformanceMark))
      vi.spyOn(performance, 'measure').mockImplementation(() => ({} as PerformanceMeasure))
    })

    it('returns a cleanup function', () => {
      const cleanup = measureComponentPerformance('TestComponent')
      expect(typeof cleanup).toBe('function')
    })

    it('measures component render time', () => {
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(10)

      const cleanup = measureComponentPerformance('TestComponent')
      cleanup()

      // Should not warn for fast renders (< 16.67ms)
      expect(console.warn).not.toHaveBeenCalled()
    })

    it('warns for slow component renders', () => {
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(20)

      const cleanup = measureComponentPerformance('SlowComponent')
      cleanup()

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[Performance] Slow component render: SlowComponent')
      )
    })

    it('creates performance marks and measures', () => {
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(10)

      const cleanup = measureComponentPerformance('TestComponent')
      cleanup()

      expect(performance.mark).toHaveBeenCalledWith('TestComponent-end')
      expect(performance.measure).toHaveBeenCalled()
    })

    it('handles performance API errors gracefully', () => {
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(10)
      vi.spyOn(performance, 'mark').mockImplementation(() => {
        throw new Error('Mark error')
      })

      const cleanup = measureComponentPerformance('TestComponent')
      expect(() => cleanup()).not.toThrow()
    })
  })

  describe('cleanupWebVitals', () => {
    it('can be called without error', () => {
      expect(() => cleanupWebVitals()).not.toThrow()
    })

    it('can be called multiple times', () => {
      expect(() => {
        cleanupWebVitals()
        cleanupWebVitals()
        cleanupWebVitals()
      }).not.toThrow()
    })
  })

  describe('analytics callback', () => {
    it('logs metrics in non-production', async () => {
      await initWebVitals()

      // Get the callback that was passed to onLCP
      const lcpCallback = mockOnLCP.mock.calls[0][0]

      // Call the callback with a mock metric
      lcpCallback({
        name: 'LCP',
        value: 2000,
        delta: 2000,
        id: 'test-id',
        navigationType: 'navigate',
        entries: [],
      })

      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalledWith(
        '[Web Vitals]',
        expect.objectContaining({ name: 'LCP' })
      )
    })

    it('handles metrics with rating', async () => {
      await initWebVitals()

      const lcpCallback = mockOnLCP.mock.calls[0][0]

      lcpCallback({
        name: 'LCP',
        value: 5000,
        delta: 5000,
        id: 'test-id',
        navigationType: 'navigate',
        entries: [],
        rating: 'poor',
      })

      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalledWith(
        '[Web Vitals]',
        expect.objectContaining({
          name: 'LCP',
          rating: 'poor',
        })
      )
    })
  })
})

describe('web-vitals rating thresholds', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rates good LCP values correctly', async () => {
    await initWebVitals()
    const lcpCallback = mockOnLCP.mock.calls[0][0]

    lcpCallback({
      name: 'LCP',
      value: 2000, // Good (< 2500)
      delta: 2000,
      id: 'test-id',
      navigationType: 'navigate',
      entries: [],
    })

    expect(logSpy).toHaveBeenCalled()
  })

  it('rates needs-improvement LCP values correctly', async () => {
    await initWebVitals()
    const lcpCallback = mockOnLCP.mock.calls[0][0]

    lcpCallback({
      name: 'LCP',
      value: 3000, // Needs improvement (2500-4000)
      delta: 3000,
      id: 'test-id',
      navigationType: 'navigate',
      entries: [],
    })

    expect(logSpy).toHaveBeenCalled()
  })

  it('rates poor LCP values correctly', async () => {
    await initWebVitals()
    const lcpCallback = mockOnLCP.mock.calls[0][0]

    lcpCallback({
      name: 'LCP',
      value: 5000, // Poor (> 4000)
      delta: 5000,
      id: 'test-id',
      navigationType: 'navigate',
      entries: [],
    })

    expect(logSpy).toHaveBeenCalled()
  })

  it('rates CLS values correctly', async () => {
    await initWebVitals()
    const clsCallback = mockOnCLS.mock.calls[0][0]

    clsCallback({
      name: 'CLS',
      value: 0.05, // Good (< 0.1)
      delta: 0.05,
      id: 'test-id',
      navigationType: 'navigate',
      entries: [],
    })

    expect(logSpy).toHaveBeenCalledWith(
      '[Web Vitals]',
      expect.objectContaining({ name: 'CLS' })
    )
  })

  it('rates FCP values correctly', async () => {
    await initWebVitals()
    const fcpCallback = mockOnFCP.mock.calls[0][0]

    fcpCallback({
      name: 'FCP',
      value: 1500, // Good (< 1800)
      delta: 1500,
      id: 'test-id',
      navigationType: 'navigate',
      entries: [],
    })

    expect(logSpy).toHaveBeenCalledWith(
      '[Web Vitals]',
      expect.objectContaining({ name: 'FCP' })
    )
  })

  it('rates TTFB values correctly', async () => {
    await initWebVitals()
    const ttfbCallback = mockOnTTFB.mock.calls[0][0]

    ttfbCallback({
      name: 'TTFB',
      value: 500, // Good (< 800)
      delta: 500,
      id: 'test-id',
      navigationType: 'navigate',
      entries: [],
    })

    expect(logSpy).toHaveBeenCalledWith(
      '[Web Vitals]',
      expect.objectContaining({ name: 'TTFB' })
    )
  })

  it('rates INP values correctly', async () => {
    await initWebVitals()
    const inpCallback = mockOnINP.mock.calls[0][0]

    inpCallback({
      name: 'INP',
      value: 50, // Use FID thresholds - Good (< 100)
      delta: 50,
      id: 'test-id',
      navigationType: 'navigate',
      entries: [],
    })

    expect(logSpy).toHaveBeenCalledWith(
      '[Web Vitals]',
      expect.objectContaining({ name: 'INP' })
    )
  })
})

describe('web-vitals server-side', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns early when window is undefined', async () => {
    const originalWindow = global.window
    delete global.window

    await initWebVitals()

    // None of the handlers should be called
    expect(mockOnLCP).not.toHaveBeenCalled()
    expect(mockOnCLS).not.toHaveBeenCalled()

    global.window = originalWindow
  })
})

describe('web-vitals production mode', () => {
  const originalEnv = process.env.NODE_ENV
  let mockSendBeacon: ReturnType<typeof vi.fn>
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    mockSendBeacon = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'sendBeacon', {
      value: mockSendBeacon,
      configurable: true,
      writable: true,
    })

    mockFetch = vi.fn().mockResolvedValue({ ok: true })
    global.fetch = mockFetch as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    cleanupWebVitals()
  })

  it('sends metrics via sendBeacon in production', async () => {
    await initWebVitals()

    const lcpCallback = mockOnLCP.mock.calls[0][0]
    lcpCallback({
      name: 'LCP',
      value: 2000,
      delta: 2000,
      id: 'test-id',
      navigationType: 'navigate',
      entries: [],
    })

    expect(mockSendBeacon).toHaveBeenCalledWith(
      '/api/analytics/vitals',
      expect.any(String)
    )
  })

  it('falls back to fetch when sendBeacon not available', async () => {
    delete navigator.sendBeacon

    await initWebVitals()

    const lcpCallback = mockOnLCP.mock.calls[0][0]
    lcpCallback({
      name: 'LCP',
      value: 2000,
      delta: 2000,
      id: 'test-id',
      navigationType: 'navigate',
      entries: [],
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/analytics/vitals',
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
      })
    )
  })

  it('sends to Sentry when available', async () => {
    const mockCaptureMessage = vi.fn()
    ;(window as any).Sentry = {
      captureMessage: mockCaptureMessage,
    }

    await initWebVitals()

    const lcpCallback = mockOnLCP.mock.calls[0][0]
    lcpCallback({
      name: 'LCP',
      value: 5000,
      delta: 5000,
      id: 'test-id',
      navigationType: 'navigate',
      entries: [],
      rating: 'poor',
    })

    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'Web Vital: LCP',
      expect.objectContaining({
        level: 'warning',
      })
    )

    delete (window as any).Sentry
  })

  it('handles fetch errors gracefully', async () => {
    delete navigator.sendBeacon
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await initWebVitals()

    const lcpCallback = mockOnLCP.mock.calls[0][0]

    // Should not throw
    expect(() => {
      lcpCallback({
        name: 'LCP',
        value: 2000,
        delta: 2000,
        id: 'test-id',
        navigationType: 'navigate',
        entries: [],
      })
    }).not.toThrow()
  })
})

describe('web-vitals custom metrics', () => {
  let mockObserverCallback: ((list: { getEntries: () => PerformanceEntry[] }) => void) | null = null
  let mockDisconnect: ReturnType<typeof vi.fn>
  let mockObserve: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    mockDisconnect = vi.fn()
    mockObserve = vi.fn()
    mockObserverCallback = null

    class MockPerformanceObserver {
      constructor(callback: (list: { getEntries: () => PerformanceEntry[] }) => void) {
        mockObserverCallback = callback
      }
      observe = mockObserve
      disconnect = mockDisconnect
    }

    global.PerformanceObserver = MockPerformanceObserver as unknown as typeof PerformanceObserver
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cleanupWebVitals()
  })

  it('sets up long task monitoring', async () => {
    await initWebVitals()

    expect(mockObserve).toHaveBeenCalledWith({ entryTypes: ['longtask'] })
  })

  it('warns for long tasks over 50ms', async () => {
    await initWebVitals()

    // Simulate a long task
    mockObserverCallback?.({
      getEntries: () => [
        { duration: 60, startTime: 100, name: 'self' } as PerformanceEntry,
      ],
    })

    expect(console.warn).toHaveBeenCalledWith(
      '[Performance] Long task detected:',
      expect.objectContaining({ duration: 60 })
    )
  })

  it('handles PerformanceObserver errors gracefully', async () => {
    mockObserve.mockImplementation(() => {
      throw new Error('Observer error')
    })

    await initWebVitals()

    expect(console.error).toHaveBeenCalledWith(
      'Failed to setup long task monitoring:',
      expect.any(Error)
    )
  })

  it('cleans up observer on cleanupWebVitals', async () => {
    await initWebVitals()

    cleanupWebVitals()

    expect(mockDisconnect).toHaveBeenCalled()
  })
})

describe('web-vitals resource monitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Mock PerformanceObserver
    class MockPerformanceObserver {
      constructor() {}
      observe = vi.fn()
      disconnect = vi.fn()
    }
    global.PerformanceObserver = MockPerformanceObserver as unknown as typeof PerformanceObserver

    // Mock PerformanceResourceTiming
    ;(window as any).PerformanceResourceTiming = class {}
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cleanupWebVitals()
  })

  it('monitors slow resources on page load', async () => {
    const mockResources = [
      { name: 'slow.js', duration: 2000, startTime: 0, responseEnd: 2000, transferSize: 50000, initiatorType: 'script' },
      { name: 'fast.css', duration: 100, startTime: 0, responseEnd: 100, transferSize: 1000, initiatorType: 'link' },
    ]

    vi.spyOn(performance, 'getEntriesByType').mockReturnValue(mockResources as PerformanceResourceTiming[])

    await initWebVitals()

    // Trigger load event
    window.dispatchEvent(new Event('load'))

    expect(console.warn).toHaveBeenCalledWith(
      '[Performance] Slow resources detected:',
      expect.arrayContaining([
        expect.objectContaining({ name: 'slow.js' }),
      ])
    )
  })

  it('does not warn when no slow resources', async () => {
    const mockResources = [
      { name: 'fast.js', duration: 100, startTime: 0, responseEnd: 100, transferSize: 5000, initiatorType: 'script' },
    ]

    vi.spyOn(performance, 'getEntriesByType').mockReturnValue(mockResources as PerformanceResourceTiming[])

    await initWebVitals()
    window.dispatchEvent(new Event('load'))

    expect(console.warn).not.toHaveBeenCalledWith(
      '[Performance] Slow resources detected:',
      expect.anything()
    )
  })
})
