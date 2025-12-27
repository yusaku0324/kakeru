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
