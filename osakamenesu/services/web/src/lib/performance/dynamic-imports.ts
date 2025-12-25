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
      const module = await importFn()
      return module
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
 * Route-based code splitting configuration
 */
export const routeComponents = {
  // Public routes
  home: () => import('@/app/page'),
  shops: () => import('@/app/shops/page'),
  shopDetail: () => import('@/app/shops/[id]/page'),
  therapists: () => import('@/app/therapists/page'),
  therapistDetail: () => import('@/app/therapists/[id]/page'),
  search: () => import('@/app/search/page'),
  favorites: () => import('@/app/favorites/page'),

  // Auth routes
  login: () => import('@/app/auth/login/page'),
  register: () => import('@/app/auth/register/page'),
  forgotPassword: () => import('@/app/auth/forgot-password/page'),

  // User dashboard
  userDashboard: () => import('@/app/user/dashboard/page'),
  userReservations: () => import('@/app/user/reservations/page'),
  userProfile: () => import('@/app/user/profile/page'),
  userSettings: () => import('@/app/user/settings/page'),

  // Admin routes
  adminDashboard: () => import('@/app/admin/page'),
  adminShops: () => import('@/app/admin/shops/page'),
  adminTherapists: () => import('@/app/admin/therapists/page'),
  adminReservations: () => import('@/app/admin/reservations/page'),
  adminUsers: () => import('@/app/admin/users/page'),
  adminAnalytics: () => import('@/app/admin/analytics/page'),
}

/**
 * Component-level code splitting
 */
export const lazyComponents = {
  // Heavy components
  RichTextEditor: createLazyComponent(
    () => import('@/components/editor/rich-text-editor')
  ),
  ImageGallery: createLazyComponent(
    () => import('@/components/ui/optimized-image').then(mod => ({
      default: mod.OptimizedImageGallery,
    }))
  ),
  Calendar: createLazyComponent(
    () => import('@/components/calendar/calendar')
  ),
  MapView: createLazyComponent(
    () => import('@/components/map/map-view')
  ),

  // Charts and analytics
  AnalyticsChart: createLazyComponent(
    () => import('@/components/analytics/chart')
  ),
  RevenueChart: createLazyComponent(
    () => import('@/components/analytics/revenue-chart')
  ),

  // Modals
  ReservationModal: createLazyComponent(
    () => import('@/components/modals/reservation-modal')
  ),
  PhotoUploadModal: createLazyComponent(
    () => import('@/components/modals/photo-upload-modal')
  ),
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
 * Route preloading map
 */
const routePreloadMap: Record<string, () => Promise<any>> = {
  '/': routeComponents.home,
  '/shops': routeComponents.shops,
  '/therapists': routeComponents.therapists,
  '/search': routeComponents.search,
  '/login': routeComponents.login,
  '/admin': routeComponents.adminDashboard,
}

/**
 * Preload a specific route
 */
export function preloadRoute(path: string): void {
  // Extract base path
  const basePath = path.split('/').slice(0, 2).join('/')

  const preloadFn = routePreloadMap[basePath] || routePreloadMap[path]

  if (preloadFn) {
    preloadFn().catch(error => {
      console.error(`Failed to preload route ${path}:`, error)
    })
  }
}

/**
 * Preload components based on viewport visibility
 */
export function preloadVisibleComponents(): void {
  if (typeof window === 'undefined') return

  const componentsToPreload = [
    { selector: '[data-preload="calendar"]', component: lazyComponents.Calendar },
    { selector: '[data-preload="gallery"]', component: lazyComponents.ImageGallery },
    { selector: '[data-preload="map"]', component: lazyComponents.MapView },
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
        lazyComponents.RichTextEditor
        lazyComponents.AnalyticsChart
        lazyComponents.MapView
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