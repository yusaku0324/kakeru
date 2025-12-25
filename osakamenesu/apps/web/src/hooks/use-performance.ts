import { useEffect, useCallback, useRef, useState } from 'react'
import { useInView } from 'react-intersection-observer'

/**
 * Performance optimization hooks for React components
 */

/**
 * Hook for lazy loading components when they come into view
 */
export function useLazyComponent<T>(
  importFn: () => Promise<{ default: React.ComponentType<T> }>,
  options?: {
    rootMargin?: string
    threshold?: number | number[]
    preload?: boolean
  }
) {
  const [Component, setComponent] = useState<React.ComponentType<T> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: options?.rootMargin || '100px',
    threshold: options?.threshold || 0,
  })

  useEffect(() => {
    if (options?.preload) {
      // Preload on idle time
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          importFn().catch(() => {
            // Ignore preload errors
          })
        })
      }
    }
  }, [importFn, options?.preload])

  useEffect(() => {
    if (inView && !Component && !isLoading) {
      setIsLoading(true)
      importFn()
        .then((module) => {
          setComponent(() => module.default)
          setError(null)
        })
        .catch((err) => {
          setError(err)
          console.error('Failed to load component:', err)
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [inView, Component, isLoading, importFn])

  return {
    ref,
    Component,
    isLoading,
    error,
  }
}

/**
 * Hook for debouncing expensive operations
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const debouncedCallback = useCallback(
    function debouncedFn(...args: Parameters<T>) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  )

  return debouncedCallback as T
}

/**
 * Hook for throttling frequent operations
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const throttledCallback = useCallback(
    function throttledFn(...args: Parameters<T>) {
      const now = Date.now()

      if (now - lastRun.current >= delay) {
        callback(...args)
        lastRun.current = now
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        timeoutRef.current = setTimeout(() => {
          callback(...args)
          lastRun.current = Date.now()
        }, delay - (now - lastRun.current))
      }
    },
    [callback, delay]
  )

  return throttledCallback as T
}

/**
 * Hook for prefetching data on hover/focus
 */
export function usePrefetch(
  prefetchFn: () => void | Promise<void>,
  options?: {
    onHover?: boolean
    onFocus?: boolean
    delay?: number
  }
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isPrefetched = useRef(false)

  const prefetch = useCallback(() => {
    if (isPrefetched.current) return

    if (options?.delay) {
      timeoutRef.current = setTimeout(() => {
        prefetchFn()
        isPrefetched.current = true
      }, options.delay)
    } else {
      prefetchFn()
      isPrefetched.current = true
    }
  }, [prefetchFn, options?.delay])

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  const handlers = {
    ...(options?.onHover !== false && {
      onMouseEnter: prefetch,
      onMouseLeave: cancel,
    }),
    ...(options?.onFocus && {
      onFocus: prefetch,
      onBlur: cancel,
    }),
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return handlers
}

/**
 * Hook for virtual scrolling large lists
 */
export function useVirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 3,
}: {
  items: T[]
  itemHeight: number
  containerHeight: number
  overscan?: number
}) {
  const [scrollTop, setScrollTop] = useState(0)

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  )

  const visibleItems = items.slice(startIndex, endIndex + 1)

  const totalHeight = items.length * itemHeight
  const offsetY = startIndex * itemHeight

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    startIndex,
    endIndex,
  }
}

/**
 * Hook for measuring render performance
 */
export function useRenderMetrics(componentName: string) {
  const renderCount = useRef(0)
  const renderStart = useRef<number>(0)

  useEffect(() => {
    renderCount.current++
    const renderTime = performance.now() - renderStart.current

    if (renderCount.current > 1 && renderTime > 16.67) {
      console.warn(
        `[Performance] ${componentName} re-rendered in ${renderTime.toFixed(2)}ms (render #${renderCount.current})`
      )
    }

    renderStart.current = performance.now()
  })

  return {
    renderCount: renderCount.current,
  }
}

/**
 * Hook for optimizing expensive computations
 */
export function useOptimizedMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  options?: {
    maxAge?: number // Cache TTL in milliseconds
    key?: string // Cache key for persistence
  }
): T {
  const cache = useRef<{ value: T; timestamp: number } | null>(null)
  const [value, setValue] = useState<T>(() => {
    // Try to restore from sessionStorage if key provided
    if (options?.key && typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(`memo-${options.key}`)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (!options.maxAge || Date.now() - parsed.timestamp < options.maxAge) {
            return parsed.value
          }
        }
      } catch {
        // Ignore errors
      }
    }

    const result = factory()
    cache.current = { value: result, timestamp: Date.now() }
    return result
  })

  useEffect(() => {
    const now = Date.now()

    // Check if cache is still valid
    if (
      cache.current &&
      (!options?.maxAge || now - cache.current.timestamp < options.maxAge)
    ) {
      return
    }

    // Compute new value
    const newValue = factory()
    setValue(newValue)
    cache.current = { value: newValue, timestamp: now }

    // Persist to sessionStorage if key provided
    if (options?.key && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(
          `memo-${options.key}`,
          JSON.stringify({ value: newValue, timestamp: now })
        )
      } catch {
        // Ignore errors (quota exceeded, etc.)
      }
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  return value
}