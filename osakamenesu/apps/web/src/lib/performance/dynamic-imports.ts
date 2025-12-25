/**
 * Dynamic import utilities for code splitting
 *
 * Implements route-based and component-based code splitting
 * to reduce initial bundle size and improve performance
 */

import { ComponentType, lazy, LazyExoticComponent } from 'react'

// Type for dynamic import with retry logic
type DynamicImportOptions = {
  retries?: number
  retryDelay?: number
  onError?: (error: Error) => void
  preload?: boolean
}

/**
 * Enhanced dynamic import with retry logic
 */
export async function dynamicImport<T = any>(
  importFn: () => Promise<{ default: T }>,
  options?: DynamicImportOptions
): Promise<{ default: T }> {
  const { retries = 3, retryDelay = 1000, onError } = options || {}

  let lastError: Error | null = null

  for (let i = 0; i < retries; i++) {
    try {
      const importedModule = await importFn()
      return importedModule
    } catch (error) {
      lastError = error as Error
      console.error(`Dynamic import failed (attempt ${i + 1}/${retries}):`, error)

      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (i + 1)))
      }
    }
  }

  onError?.(lastError!)
  throw lastError
}

/**
 * Create lazy component with error boundary and loading state
 */
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options?: DynamicImportOptions & {
    fallback?: ComponentType
    errorBoundary?: boolean
  }
): LazyExoticComponent<T> {
  return lazy(() =>
    dynamicImport<T>(importFn, options).catch(error => {
      console.error('Failed to load component:', error)

      // Return fallback component if provided
      if (options?.fallback) {
        return { default: options.fallback as T }
      }

      // Re-throw to trigger error boundary
      throw error
    })
  )
}

/**
 * Route prefetching configuration
 * Note: In Next.js App Router, pages are server components and cannot be dynamically imported
 * from client components. Use Next.js's built-in prefetching instead.
 */
export const routePaths = {
  // Public routes
  home: '/',
  shops: '/shops',
  shopDetail: (shopSlug: string) => `/shops/${shopSlug}`,
  therapists: '/therapists',
  therapistDetail: (shopSlug: string, therapistId: string) => `/shops/${shopSlug}/therapists/${therapistId}`,
  search: '/search',

  // Auth routes
  login: '/auth/login',

  // Guest routes
  guestReservations: '/guest/reservations',
  guestSearch: '/guest/search',

  // Dashboard routes
  dashboard: '/dashboard',
  dashboardProfile: (profileId: string) => `/dashboard/${profileId}`,
  dashboardShifts: (profileId: string) => `/dashboard/${profileId}/shifts`,
  dashboardReviews: (profileId: string) => `/dashboard/${profileId}/reviews`,

  // Admin routes
  adminDashboard: '/admin',
  adminShops: '/admin/shops',
  adminTherapists: '/admin/therapists',
  adminReservations: '/admin/reservations',
  adminShopDetail: (shopId: string) => `/admin/shops/${shopId}`,
}

/**
 * Component-level code splitting
 */
export const lazyComponents = {
  // Heavy components
  // TODO: Create editor/rich-text-editor component
  // RichTextEditor: createLazyComponent(
  //   () => import('@/components/editor/rich-text-editor')
  // ),

  // Import named export OptimizedImage
  OptimizedImage: createLazyComponent(
    () => import('@/components/ui/optimized-image').then(mod => ({
      default: mod.OptimizedImage,
    }))
  ),

  // Import named export OptimizedImageGallery
  OptimizedImageGallery: createLazyComponent(
    () => import('@/components/ui/optimized-image').then(mod => ({
      default: mod.OptimizedImageGallery,
    }))
  ),

  // Calendar component - using WeekAvailabilityGrid as the main calendar component
  Calendar: createLazyComponent(
    () => import('@/components/calendar/WeekAvailabilityGrid').then(mod => ({
      default: mod.WeekAvailabilityGrid,
    }))
  ),

  // TODO: Create map/map-view component
  // MapView: createLazyComponent(
  //   () => import('@/components/map/map-view')
  // ),

  // TODO: Create analytics components
  // AnalyticsChart: createLazyComponent(
  //   () => import('@/components/analytics/chart')
  // ),
  // RevenueChart: createLazyComponent(
  //   () => import('@/components/analytics/revenue-chart')
  // ),

  // TODO: Create modal components
  // ReservationModal: createLazyComponent(
  //   () => import('@/components/modals/reservation-modal')
  // ),
  // PhotoUploadModal: createLazyComponent(
  //   () => import('@/components/modals/photo-upload-modal')
  // ),
}

/**
 * Preload critical routes based on user behavior
 */
export function setupRoutePreloading(): void {
  if (typeof window === 'undefined') return

  // Intersection observer for link preloading
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const link = entry.target as HTMLAnchorElement
          const href = link.getAttribute('href')

          if (href) {
            preloadRoute(href)
            observer.unobserve(link)
          }
        }
      })
    },
    {
      rootMargin: '50px',
    }
  )

  // Observe internal links
  document.querySelectorAll('a[href^="/"]').forEach(link => {
    observer.observe(link)
  })

  // Preload on hover (desktop)
  if (!('ontouchstart' in window)) {
    document.addEventListener('mouseover', (e) => {
      const target = e.target as HTMLElement
      const link = target.closest('a[href^="/"]') as HTMLAnchorElement

      if (link) {
        const href = link.getAttribute('href')
        if (href) {
          preloadRoute(href)
        }
      }
    })
  }
}

/**
 * Routes to prefetch on hover or visibility
 * Note: Using Next.js's built-in router.prefetch() instead of dynamic imports
 */
const routesToPrefetch = [
  '/',
  '/shops',
  '/therapists',
  '/search',
  '/auth/login',
  '/admin',
  '/dashboard',
]

/**
 * Preload a specific route using Next.js router
 * Note: This function is kept for compatibility but should be replaced
 * with router.prefetch() in components
 */
export function preloadRoute(path: string): void {
  // In Next.js App Router, route prefetching should be done via:
  // 1. <Link prefetch={true}> (default behavior)
  // 2. router.prefetch(path) in client components
  // 3. Next.js automatically prefetches visible links

  // This function is now a no-op as prefetching should be handled by Next.js
  // Route prefetch is handled by Next.js Link component with prefetch={true}
  void path // Acknowledge unused parameter
}

/**
 * Preload components based on viewport visibility
 */
export function preloadVisibleComponents(): void {
  if (typeof window === 'undefined') return

  const componentsToPreload = [
    { selector: '[data-preload="calendar"]', component: lazyComponents.Calendar },
    { selector: '[data-preload="image"]', component: lazyComponents.OptimizedImage },
    { selector: '[data-preload="gallery"]', component: lazyComponents.OptimizedImageGallery },
    // TODO: Add map component when created
    // { selector: '[data-preload="map"]', component: lazyComponents.MapView },
  ]

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target
          const preloadType = element.getAttribute('data-preload')

          const config = componentsToPreload.find(c =>
            c.selector.includes(preloadType!)
          )

          if (config) {
            // Trigger component preload
            const component = config.component as any
            if (component._payload?._status === -1) {
              component._payload._status = 0
              component._payload._result = component._payload._result()
            }

            observer.unobserve(element)
          }
        }
      })
    },
    {
      rootMargin: '100px',
    }
  )

  // Start observing elements
  componentsToPreload.forEach(config => {
    document.querySelectorAll(config.selector).forEach(element => {
      observer.observe(element)
    })
  })
}

/**
 * Progressive enhancement for dynamic imports
 */
export function setupProgressiveEnhancement(): void {
  if (typeof window === 'undefined') return

  // Only load heavy features on good connections
  if ('connection' in navigator) {
    const connection = (navigator as any).connection

    if (connection.effectiveType === '4g' && !connection.saveData) {
      // Preload heavy components on fast connections
      setTimeout(() => {
        lazyComponents.Calendar
        lazyComponents.OptimizedImage
        lazyComponents.OptimizedImageGallery
        // TODO: Add these when components are created
        // lazyComponents.RichTextEditor
        // lazyComponents.AnalyticsChart
        // lazyComponents.MapView
      }, 2000)
    }
  }

  // Setup route preloading
  setupRoutePreloading()

  // Setup component preloading
  setTimeout(() => {
    preloadVisibleComponents()
  }, 1000)
}

/**
 * Resource hints for better preloading
 */
export function addResourceHints(): void {
  if (typeof window === 'undefined') return

  const head = document.head

  // Preconnect to API
  const apiPreconnect = document.createElement('link')
  apiPreconnect.rel = 'preconnect'
  apiPreconnect.href = process.env.NEXT_PUBLIC_API_URL || 'https://api.osakamenesu.com'
  apiPreconnect.crossOrigin = 'anonymous'
  head.appendChild(apiPreconnect)

  // Preconnect to CDN (if using)
  const cdnPreconnect = document.createElement('link')
  cdnPreconnect.rel = 'preconnect'
  cdnPreconnect.href = 'https://cdn.osakamenesu.com'
  cdnPreconnect.crossOrigin = 'anonymous'
  head.appendChild(cdnPreconnect)

  // DNS prefetch for external services
  const dnsPrefetches = [
    'https://www.google-analytics.com',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
  ]

  dnsPrefetches.forEach(url => {
    const link = document.createElement('link')
    link.rel = 'dns-prefetch'
    link.href = url
    head.appendChild(link)
  })
}

/**
 * Export all setup functions for app initialization
 */
export function initializePerformanceOptimizations(): void {
  if (typeof window === 'undefined') return

  // Add resource hints immediately
  addResourceHints()

  // Setup progressive enhancement when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupProgressiveEnhancement)
  } else {
    setupProgressiveEnhancement()
  }
}