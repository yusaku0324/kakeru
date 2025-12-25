/**
 * Cache management utilities for API responses and static assets
 *
 * Implements intelligent caching strategies:
 * - Stale-while-revalidate for dynamic content
 * - Cache warming for critical data
 * - Automatic cache invalidation
 * - Memory and storage management
 */

import { useState, useEffect, useCallback } from 'react'

type CacheStrategy = 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'network-only'

interface CacheConfig {
  strategy: CacheStrategy
  ttl: number // Time to live in seconds
  staleTime?: number // Time before data is considered stale
  cacheKey?: (url: string, options?: RequestInit) => string
  shouldCache?: (response: Response) => boolean
}

interface CachedData<T = any> {
  data: T
  timestamp: number
  etag?: string
  maxAge?: number
}

/**
 * Enhanced fetch with caching strategies
 */
export class CacheManager {
  private memoryCache = new Map<string, CachedData>()
  private cacheVersion = 'v1'
  private maxMemorySize = 50 * 1024 * 1024 // 50MB
  private currentMemorySize = 0

  constructor(private defaultConfig: Partial<CacheConfig> = {}) {}

  /**
   * Fetch with intelligent caching
   */
  async fetch<T = any>(
    url: string,
    options?: RequestInit & { cacheConfig?: CacheConfig }
  ): Promise<T> {
    const config: CacheConfig = {
      strategy: 'stale-while-revalidate',
      ttl: 300, // 5 minutes default
      staleTime: 60, // 1 minute default
      cacheKey: this.defaultCacheKey,
      shouldCache: this.defaultShouldCache,
      ...this.defaultConfig,
    }

    // Apply cache options if they exist
    if (options?.cacheConfig) {
      Object.assign(config, options.cacheConfig)
    }

    const cacheKey = config.cacheKey!(url, options)

    switch (config.strategy) {
      case 'cache-first':
        return this.cacheFirst(cacheKey, url, options, config)

      case 'network-first':
        return this.networkFirst(cacheKey, url, options, config)

      case 'stale-while-revalidate':
        return this.staleWhileRevalidate(cacheKey, url, options, config)

      case 'network-only':
        return this.networkOnly(url, options)

      default:
        throw new Error(`Unknown cache strategy: ${config.strategy}`)
    }
  }

  /**
   * Cache-first strategy
   */
  private async cacheFirst<T>(
    cacheKey: string,
    url: string,
    options: RequestInit | undefined,
    config: CacheConfig
  ): Promise<T> {
    // Check memory cache
    const memoryData = this.getFromMemory<T>(cacheKey)
    if (memoryData && !this.isExpired(memoryData, config.ttl)) {
      return memoryData.data
    }

    // Check storage cache
    const storageData = await this.getFromStorage<T>(cacheKey)
    if (storageData && !this.isExpired(storageData, config.ttl)) {
      // Populate memory cache
      this.setToMemory(cacheKey, storageData)
      return storageData.data
    }

    // Fetch from network
    const response = await this.fetchFromNetwork(url, options)
    const data = await response.json()

    // Cache if successful
    if (config.shouldCache!(response)) {
      await this.cacheResponse(cacheKey, data, response, config.ttl)
    }

    return data
  }

  /**
   * Network-first strategy
   */
  private async networkFirst<T>(
    cacheKey: string,
    url: string,
    options: RequestInit | undefined,
    config: CacheConfig
  ): Promise<T> {
    try {
      // Try network first
      const response = await this.fetchFromNetwork(url, options)
      const data = await response.json()

      // Cache if successful
      if (config.shouldCache!(response)) {
        await this.cacheResponse(cacheKey, data, response, config.ttl)
      }

      return data
    } catch (error) {
      // Fall back to cache on network error
      const cachedData = this.getFromMemory<T>(cacheKey) || await this.getFromStorage<T>(cacheKey)

      if (cachedData) {
        console.warn('Network failed, using cached data:', error)
        return cachedData.data
      }

      throw error
    }
  }

  /**
   * Stale-while-revalidate strategy
   */
  private async staleWhileRevalidate<T>(
    cacheKey: string,
    url: string,
    options: RequestInit | undefined,
    config: CacheConfig
  ): Promise<T> {
    // Get cached data
    const cachedData = this.getFromMemory<T>(cacheKey) || await this.getFromStorage<T>(cacheKey)

    // Return stale data immediately if available
    if (cachedData) {
      const isStale = this.isExpired(cachedData, config.staleTime!)

      if (isStale || this.isExpired(cachedData, config.ttl)) {
        // Revalidate in background
        this.revalidateInBackground(cacheKey, url, options, config)
      }

      return cachedData.data
    }

    // No cache, fetch from network
    const response = await this.fetchFromNetwork(url, options)
    const data = await response.json()

    // Cache if successful
    if (config.shouldCache!(response)) {
      await this.cacheResponse(cacheKey, data, response, config.ttl)
    }

    return data
  }

  /**
   * Network-only strategy
   */
  private async networkOnly<T>(url: string, options: RequestInit | undefined): Promise<T> {
    const response = await this.fetchFromNetwork(url, options)
    return response.json()
  }

  /**
   * Fetch from network with timeout
   */
  private async fetchFromNetwork(
    url: string,
    options: RequestInit | undefined,
    timeout = 10000
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  /**
   * Revalidate cache in background
   */
  private async revalidateInBackground(
    cacheKey: string,
    url: string,
    options: RequestInit | undefined,
    config: CacheConfig
  ): Promise<void> {
    try {
      const response = await this.fetchFromNetwork(url, options)
      const data = await response.json()

      if (config.shouldCache!(response)) {
        await this.cacheResponse(cacheKey, data, response, config.ttl)
      }
    } catch (error) {
      console.error('Background revalidation failed:', error)
    }
  }

  /**
   * Cache response data
   */
  private async cacheResponse(
    cacheKey: string,
    data: any,
    response: Response,
    ttl: number
  ): Promise<void> {
    const cachedData: CachedData = {
      data,
      timestamp: Date.now(),
      etag: response.headers.get('etag') || undefined,
      maxAge: this.parseMaxAge(response.headers.get('cache-control')),
    }

    // Store in memory
    this.setToMemory(cacheKey, cachedData)

    // Store in IndexedDB
    await this.setToStorage(cacheKey, cachedData)
  }

  /**
   * Memory cache operations
   */
  private getFromMemory<T>(key: string): CachedData<T> | null {
    return this.memoryCache.get(key) as CachedData<T> | undefined || null
  }

  private setToMemory(key: string, data: CachedData): void {
    const size = JSON.stringify(data).length

    // Check memory limit
    if (this.currentMemorySize + size > this.maxMemorySize) {
      // Evict oldest entries
      this.evictFromMemory(size)
    }

    this.memoryCache.set(key, data)
    this.currentMemorySize += size
  }

  private evictFromMemory(requiredSize: number): void {
    const entries = Array.from(this.memoryCache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)

    let freedSize = 0
    for (const [key, data] of entries) {
      const size = JSON.stringify(data).length
      this.memoryCache.delete(key)
      this.currentMemorySize -= size
      freedSize += size

      if (freedSize >= requiredSize) {
        break
      }
    }
  }

  /**
   * IndexedDB storage operations
   */
  private async getFromStorage<T>(key: string): Promise<CachedData<T> | null> {
    if (!('indexedDB' in window)) return null

    try {
      const db = await this.openDatabase()
      const transaction = db.transaction(['cache'], 'readonly')
      const store = transaction.objectStore('cache')
      const request = store.get(key)

      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || null)
        request.onerror = () => resolve(null)
      })
    } catch {
      return null
    }
  }

  private async setToStorage(key: string, data: CachedData): Promise<void> {
    if (!('indexedDB' in window)) return

    try {
      const db = await this.openDatabase()
      const transaction = db.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')
      store.put({ ...data, key })
    } catch (error) {
      console.error('Failed to cache to IndexedDB:', error)
    }
  }

  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(`cache-${this.cacheVersion}`, 1)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Cache utilities
   */
  private isExpired(data: CachedData, ttl: number): boolean {
    const age = Date.now() - data.timestamp
    const maxAge = data.maxAge || ttl

    return age > maxAge * 1000
  }

  private parseMaxAge(cacheControl: string | null): number | undefined {
    if (!cacheControl) return undefined

    const match = cacheControl.match(/max-age=(\d+)/)
    return match ? parseInt(match[1], 10) : undefined
  }

  private defaultCacheKey(url: string, options?: RequestInit): string {
    const method = options?.method || 'GET'
    const body = options?.body ? JSON.stringify(options.body) : ''
    return `${method}:${url}:${body}`
  }

  private defaultShouldCache(response: Response): boolean {
    return response.ok && response.status === 200
  }

  /**
   * Cache management methods
   */
  async clear(): Promise<void> {
    this.memoryCache.clear()
    this.currentMemorySize = 0

    if ('indexedDB' in window) {
      const db = await this.openDatabase()
      const transaction = db.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')
      store.clear()
    }
  }

  async invalidate(pattern: string | RegExp): Promise<void> {
    // Invalidate memory cache
    for (const key of this.memoryCache.keys()) {
      if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
        this.memoryCache.delete(key)
      }
    }

    // Invalidate storage cache
    if ('indexedDB' in window) {
      const db = await this.openDatabase()
      const transaction = db.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')
      const request = store.openCursor()

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          const key = cursor.value.key
          if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
            cursor.delete()
          }
          cursor.continue()
        }
      }
    }
  }

  /**
   * Preload critical data
   */
  async warmUp(urls: string[]): Promise<void> {
    const promises = urls.map(url =>
      this.fetch(url, {
        cacheConfig: {
          strategy: 'stale-while-revalidate',
          ttl: 3600, // 1 hour
        },
      }).catch(error => {
        console.error(`Failed to warm up cache for ${url}:`, error)
      })
    )

    await Promise.all(promises)
  }
}

// Global cache manager instance
export const apiCache = new CacheManager({
  strategy: 'stale-while-revalidate',
  ttl: 300, // 5 minutes
  staleTime: 30, // 30 seconds
})

/**
 * React hook for cached API calls
 */
export function useCachedFetch<T = any>(
  url: string,
  options?: RequestInit & { cacheConfig?: CacheConfig }
): {
  data: T | null
  error: Error | null
  loading: boolean
  revalidate: () => Promise<void>
} {
  const [state, setState] = useState<{
    data: T | null
    error: Error | null
    loading: boolean
  }>({
    data: null,
    error: null,
    loading: true,
  })

  const revalidate = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }))

    try {
      const data = await apiCache.fetch<T>(url, options)
      setState({ data, error: null, loading: false })
    } catch (error) {
      setState({ data: null, error: error as Error, loading: false })
    }
  }, [url, options])

  useEffect(() => {
    revalidate()
  }, [revalidate])

  return { ...state, revalidate }
}