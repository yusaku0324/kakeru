/**
 * Web Vitals monitoring and reporting
 *
 * Tracks Core Web Vitals:
 * - LCP (Largest Contentful Paint)
 * - FID (First Input Delay)
 * - CLS (Cumulative Layout Shift)
 * - FCP (First Contentful Paint)
 * - TTFB (Time to First Byte)
 */

import type { Metric } from 'web-vitals'

// Thresholds for Core Web Vitals (in milliseconds)
const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint
  FID: { good: 100, needsImprovement: 300 },   // First Input Delay
  CLS: { good: 0.1, needsImprovement: 0.25 },  // Cumulative Layout Shift
  FCP: { good: 1800, needsImprovement: 3000 }, // First Contentful Paint
  TTFB: { good: 800, needsImprovement: 1800 }, // Time to First Byte
}

// Performance observer for custom metrics
let performanceObserver: PerformanceObserver | null = null

/**
 * Get rating for a metric value
 */
function getRating(metricName: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = WEB_VITALS_THRESHOLDS[metricName as keyof typeof WEB_VITALS_THRESHOLDS]
  if (!thresholds) return 'good'

  if (value <= thresholds.good) return 'good'
  if (value <= thresholds.needsImprovement) return 'needs-improvement'
  return 'poor'
}

/**
 * Report metric to analytics service
 */
function sendToAnalytics(metric: Metric & { rating?: string }) {
  // Only send in production
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Web Vitals]', metric)
    return
  }

  const body = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating || getRating(metric.name, metric.value),
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
  }

  // Send to analytics endpoint
  if ('sendBeacon' in navigator) {
    navigator.sendBeacon('/api/analytics/vitals', JSON.stringify(body))
  } else {
    fetch('/api/analytics/vitals', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {
      // Ignore errors in analytics reporting
    })
  }

  // Also send to Sentry if available
  if (typeof window !== 'undefined' && 'Sentry' in window) {
    const Sentry = (window as any).Sentry
    Sentry.captureMessage(`Web Vital: ${metric.name}`, {
      level: metric.rating === 'poor' ? 'warning' : 'info',
      contexts: {
        webVital: body,
      },
    })
  }
}

/**
 * Initialize Web Vitals monitoring
 */
export async function initWebVitals() {
  if (typeof window === 'undefined') return

  try {
    const { onLCP, onFID, onCLS, onFCP, onTTFB, onINP } = await import('web-vitals')

    // Core Web Vitals
    onLCP(sendToAnalytics)
    onFID(sendToAnalytics)
    onCLS(sendToAnalytics)

    // Other metrics
    onFCP(sendToAnalytics)
    onTTFB(sendToAnalytics)
    onINP(sendToAnalytics) // Interaction to Next Paint (replacing FID)

    // Custom performance monitoring
    initCustomMetrics()
  } catch (error) {
    console.error('Failed to initialize Web Vitals:', error)
  }
}

/**
 * Initialize custom performance metrics
 */
function initCustomMetrics() {
  if (!('PerformanceObserver' in window)) return

  // Monitor long tasks
  try {
    performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) { // Tasks longer than 50ms
          console.warn('[Performance] Long task detected:', {
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name,
          })

          // Report significant long tasks
          if (entry.duration > 100) {
            sendToAnalytics({
              name: 'long-task',
              value: entry.duration,
              delta: entry.duration,
              id: `lt-${Date.now()}`,
              navigationType: 'navigate',
              rating: getRating('FID', entry.duration),
            } as Metric)
          }
        }
      }
    })

    performanceObserver.observe({ entryTypes: ['longtask'] })
  } catch (error) {
    console.error('Failed to setup long task monitoring:', error)
  }

  // Monitor resource loading
  if ('PerformanceResourceTiming' in window) {
    window.addEventListener('load', () => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]

      // Find slow resources
      const slowResources = resources
        .filter(r => r.duration > 1000) // Resources taking more than 1s
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5) // Top 5 slowest

      if (slowResources.length > 0) {
        console.warn('[Performance] Slow resources detected:', slowResources.map(r => ({
          name: r.name,
          duration: Math.round(r.duration),
          size: r.transferSize,
          type: r.initiatorType,
        })))
      }

      // Report total resource metrics
      const totalSize = resources.reduce((sum, r) => sum + r.transferSize, 0)
      const totalDuration = Math.max(...resources.map(r => r.responseEnd)) - Math.min(...resources.map(r => r.startTime))

      sendToAnalytics({
        name: 'resource-load',
        value: totalDuration,
        delta: totalDuration,
        id: `rl-${Date.now()}`,
        navigationType: 'navigate',
        rating: getRating('LCP', totalDuration),
      } as Metric)
    })
  }
}

/**
 * Measure component render performance
 */
export function measureComponentPerformance(componentName: string) {
  const startTime = performance.now()

  return () => {
    const endTime = performance.now()
    const duration = endTime - startTime

    if (duration > 16.67) { // Longer than one frame (60fps)
      console.warn(`[Performance] Slow component render: ${componentName} took ${duration.toFixed(2)}ms`)
    }

    // Mark in performance timeline
    if ('performance' in window && 'measure' in performance) {
      try {
        performance.mark(`${componentName}-end`)
        performance.measure(componentName, `${componentName}-start`, `${componentName}-end`)
      } catch {
        // Ignore errors in marking
      }
    }
  }
}

/**
 * Cleanup performance monitoring
 */
export function cleanupWebVitals() {
  if (performanceObserver) {
    performanceObserver.disconnect()
    performanceObserver = null
  }
}