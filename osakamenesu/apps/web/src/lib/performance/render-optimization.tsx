/**
 * Rendering performance optimization utilities
 *
 * Implements techniques to improve React rendering performance:
 * - Component memoization strategies
 * - Virtual DOM optimization
 * - Batch updates
 * - Concurrent features
 */

import React, {
  memo,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useState,
  ComponentType,
  DependencyList,
  MemoExoticComponent
} from 'react'
import { flushSync } from 'react-dom'

/**
 * Enhanced memo with deep comparison
 */
export function deepMemo<T extends ComponentType<any>>(
  Component: T,
  propsAreEqual?: (prevProps: any, nextProps: any) => boolean
): MemoExoticComponent<T> {
  return memo(Component, propsAreEqual || deepEqual)
}

/**
 * Deep equality check for props
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }

  if (!a || !b || (typeof a !== 'object' && typeof b !== 'object')) {
    return a === b
  }

  if (a === null || a === undefined || b === null || b === undefined) {
    return false
  }

  if (a.prototype !== b.prototype) return false

  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) {
    return false
  }

  return keys.every(k => deepEqual(a[k], b[k]))
}

/**
 * Batch state updates for better performance
 */
export function useBatchedState<T>(
  initialState: T
): [T, (updater: (prev: T) => T) => void] {
  const [state, setState] = useState(initialState)
  const pendingUpdates = useRef<Array<(prev: T) => T>>([])
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const batchedSetState = useCallback((updater: (prev: T) => T) => {
    pendingUpdates.current.push(updater)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      flushSync(() => {
        setState(prevState => {
          let newState = prevState
          for (const update of pendingUpdates.current) {
            newState = update(newState)
          }
          pendingUpdates.current = []
          return newState
        })
      })
    }, 0)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return [state, batchedSetState]
}

/**
 * Optimized list rendering with windowing
 */
export function useWindowedList<T>(
  items: T[],
  options: {
    itemHeight: number | ((index: number) => number)
    containerHeight: number
    overscan?: number
    scrollTop?: number
  }
): {
  visibleItems: { item: T; index: number; offset: number }[]
  totalHeight: number
  startIndex: number
  endIndex: number
} {
  const { itemHeight, containerHeight, overscan = 3, scrollTop = 0 } = options

  return useMemo(() => {
    const getItemHeight = typeof itemHeight === 'function'
      ? itemHeight
      : () => itemHeight

    // Calculate visible range
    let accumulatedHeight = 0
    let startIndex = 0
    let endIndex = items.length - 1

    // Find start index
    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i)
      if (accumulatedHeight + height >= scrollTop) {
        startIndex = Math.max(0, i - overscan)
        break
      }
      accumulatedHeight += height
    }

    // Find end index
    accumulatedHeight = 0
    for (let i = startIndex; i < items.length; i++) {
      if (accumulatedHeight >= containerHeight + scrollTop) {
        endIndex = Math.min(items.length - 1, i + overscan)
        break
      }
      accumulatedHeight += getItemHeight(i)
    }

    // Calculate positions
    const visibleItems: { item: T; index: number; offset: number }[] = []
    let offset = 0

    // Calculate offset for items before startIndex
    for (let i = 0; i < startIndex; i++) {
      offset += getItemHeight(i)
    }

    // Build visible items
    for (let i = startIndex; i <= endIndex; i++) {
      visibleItems.push({
        item: items[i],
        index: i,
        offset,
      })
      offset += getItemHeight(i)
    }

    // Calculate total height
    const totalHeight = items.reduce((sum, _, i) => sum + getItemHeight(i), 0)

    return {
      visibleItems,
      totalHeight,
      startIndex,
      endIndex,
    }
  }, [items, itemHeight, containerHeight, overscan, scrollTop])
}

/**
 * Defer non-critical updates
 */
export function useDeferredValue<T>(value: T, delay = 200): T {
  const [deferredValue, setDeferredValue] = useState(value)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      setDeferredValue(value)
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [value, delay])

  return deferredValue
}

/**
 * Optimize re-renders with stable callbacks
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef<T>(callback)

  useEffect(() => {
    callbackRef.current = callback
  })

  const stableCallback = useCallback(function stable(...args: any[]) {
    return callbackRef.current(...args)
  }, [])

  return stableCallback as T
}

/**
 * Skip expensive computations on fast scrolling
 */
export function useScrollOptimizedValue<T>(
  computeValue: () => T,
  deps: DependencyList,
  options?: {
    scrollThreshold?: number
    debounceMs?: number
  }
): T | null {
  const { scrollThreshold = 50, debounceMs = 100 } = options || {}
  const [value, setValue] = useState<T | null>(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastScrollY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrollSpeed = Math.abs(window.scrollY - lastScrollY.current)
      lastScrollY.current = window.scrollY

      if (scrollSpeed > scrollThreshold) {
        setIsScrolling(true)

        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }

        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false)
        }, debounceMs)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [scrollThreshold, debounceMs])

  useEffect(() => {
    if (!isScrolling) {
      setValue(computeValue())
    }
  }, [...deps, isScrolling]) // eslint-disable-line react-hooks/exhaustive-deps

  return isScrolling ? null : value
}

/**
 * Intersection observer for lazy rendering
 */
export function useLazyRender(
  options?: IntersectionObserverInit
): [boolean, (element: HTMLElement | null) => void] {
  const [isVisible, setIsVisible] = useState(false)
  const [element, setElement] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      options
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [element, options])

  return [isVisible, setElement]
}

/**
 * Component for progressive hydration
 * Delays hydration until browser is idle to improve initial load performance
 */
export function ProgressiveHydration({
  children,
  fallback,
  ssrOnly = false,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
  ssrOnly?: boolean
}): React.ReactNode {
  const [isHydrated, setIsHydrated] = useState(ssrOnly)

  useEffect(() => {
    if (!ssrOnly) {
      // Hydrate after initial render using requestIdleCallback if available
      const callback = () => setIsHydrated(true)
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        const id = window.requestIdleCallback(callback, { timeout: 1000 })
        return () => window.cancelIdleCallback(id)
      } else {
        // Fallback for browsers without requestIdleCallback
        const id = setTimeout(callback, 0)
        return () => clearTimeout(id)
      }
    }
  }, [ssrOnly])

  return isHydrated ? children : (fallback ?? children)
}

/**
 * Optimize large lists with virtualization
 */
export function VirtualList<T>({
  items,
  renderItem,
  itemHeight,
  height,
  className,
  overscan = 3,
}: {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  itemHeight: number | ((index: number) => number)
  height: number
  className?: string
  overscan?: number
}) {
  const [scrollTop, setScrollTop] = useState(0)
  const scrollElementRef = useRef<HTMLDivElement>(null)

  const { visibleItems, totalHeight } = useWindowedList(items, {
    itemHeight,
    containerHeight: height,
    overscan,
    scrollTop,
  })

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return (
    <div
      ref={scrollElementRef}
      className={className}
      style={{ height, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index, offset }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: offset,
              left: 0,
              right: 0,
              height: typeof itemHeight === 'function' ? itemHeight(index) : itemHeight,
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Optimize images with lazy loading and progressive enhancement
 */
export function useProgressiveImage(src: string, placeholder?: string): string {
  const [currentSrc, setCurrentSrc] = useState(placeholder || src)

  useEffect(() => {
    if (!placeholder) return

    const img = new Image()
    img.src = src

    img.onload = () => {
      setCurrentSrc(src)
    }

    return () => {
      img.onload = null
    }
  }, [src, placeholder])

  return currentSrc
}

/**
 * Skip render during fast interactions
 */
export function useSkipRenderOnInteraction<T>(
  value: T,
  options?: {
    events?: string[]
    delay?: number
  }
): T | null {
  const { events = ['wheel', 'touchmove'], delay = 100 } = options || {}
  const [isInteracting, setIsInteracting] = useState(false)
  const [renderValue, setRenderValue] = useState<T | null>(value)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleInteractionStart = () => {
      setIsInteracting(true)

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        setIsInteracting(false)
      }, delay)
    }

    events.forEach(event => {
      window.addEventListener(event, handleInteractionStart, { passive: true })
    })

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleInteractionStart)
      })

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [events, delay])

  useEffect(() => {
    if (!isInteracting) {
      setRenderValue(value)
    }
  }, [value, isInteracting])

  return isInteracting ? null : renderValue
}
