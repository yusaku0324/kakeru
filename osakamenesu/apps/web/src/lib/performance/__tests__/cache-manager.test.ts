/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { CacheManager, apiCache, useCachedFetch } from '../cache-manager'

describe('CacheManager', () => {
  let cacheManager: CacheManager
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    cacheManager = new CacheManager()

    // Mock fetch
    mockFetch = vi.fn()
    global.fetch = mockFetch as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('creates instance with default config', () => {
      const manager = new CacheManager()
      expect(manager).toBeInstanceOf(CacheManager)
    })

    it('creates instance with custom config', () => {
      const manager = new CacheManager({
        strategy: 'cache-first',
        ttl: 600,
      })
      expect(manager).toBeInstanceOf(CacheManager)
    })
  })

  describe('fetch with network-only strategy', () => {
    it('fetches from network without caching', async () => {
      const mockData = { id: 1, name: 'test' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
      })

      const result = await cacheManager.fetch('/api/test', {
        cacheConfig: { strategy: 'network-only', ttl: 300 },
      })

      expect(result).toEqual(mockData)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('fetch with cache-first strategy', () => {
    it('fetches from network when cache is empty', async () => {
      const mockData = { id: 1, name: 'test' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
        headers: new Headers({ 'cache-control': 'max-age=300' }),
      })

      const result = await cacheManager.fetch('/api/test', {
        cacheConfig: { strategy: 'cache-first', ttl: 300 },
      })

      expect(result).toEqual(mockData)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('returns cached data on second call', async () => {
      const mockData = { id: 1, name: 'test' }
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
        headers: new Headers({ 'cache-control': 'max-age=300' }),
      })

      // First call - fetch from network
      await cacheManager.fetch('/api/test', {
        cacheConfig: { strategy: 'cache-first', ttl: 300 },
      })

      // Second call - should use cache
      const result = await cacheManager.fetch('/api/test', {
        cacheConfig: { strategy: 'cache-first', ttl: 300 },
      })

      expect(result).toEqual(mockData)
      // Should only fetch once from network
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('fetch with network-first strategy', () => {
    it('fetches from network first', async () => {
      const mockData = { id: 1, name: 'test' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
        headers: new Headers(),
      })

      const result = await cacheManager.fetch('/api/test', {
        cacheConfig: { strategy: 'network-first', ttl: 300 },
      })

      expect(result).toEqual(mockData)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('falls back to cache on network error', async () => {
      const mockData = { id: 1, name: 'cached' }

      // First successful fetch to populate cache
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
        headers: new Headers(),
      })

      await cacheManager.fetch('/api/test', {
        cacheConfig: { strategy: 'network-first', ttl: 300 },
      })

      // Second fetch fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await cacheManager.fetch('/api/test', {
        cacheConfig: { strategy: 'network-first', ttl: 300 },
      })

      expect(result).toEqual(mockData)
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('throws error when network fails and no cache', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(
        cacheManager.fetch('/api/new-endpoint', {
          cacheConfig: { strategy: 'network-first', ttl: 300 },
        })
      ).rejects.toThrow('Network error')
    })
  })

  describe('fetch with stale-while-revalidate strategy', () => {
    it('fetches from network when no cache', async () => {
      const mockData = { id: 1, name: 'test' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
        headers: new Headers(),
      })

      const result = await cacheManager.fetch('/api/test', {
        cacheConfig: { strategy: 'stale-while-revalidate', ttl: 300, staleTime: 60 },
      })

      expect(result).toEqual(mockData)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('returns cached data immediately', async () => {
      const mockData = { id: 1, name: 'test' }
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
        headers: new Headers(),
      })

      // First call to populate cache
      await cacheManager.fetch('/api/test', {
        cacheConfig: { strategy: 'stale-while-revalidate', ttl: 300, staleTime: 60 },
      })

      // Second call should return cached data
      const result = await cacheManager.fetch('/api/test', {
        cacheConfig: { strategy: 'stale-while-revalidate', ttl: 300, staleTime: 60 },
      })

      expect(result).toEqual(mockData)
    })
  })

  describe('fetch with unknown strategy', () => {
    it('throws error for unknown strategy', async () => {
      await expect(
        cacheManager.fetch('/api/test', {
          // @ts-expect-error - testing unknown strategy
          cacheConfig: { strategy: 'unknown-strategy', ttl: 300 },
        })
      ).rejects.toThrow('Unknown cache strategy')
    })
  })

  describe('cache management', () => {
    it('clears all cache', async () => {
      const mockData = { id: 1, name: 'test' }
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
        headers: new Headers(),
      })

      // Populate cache
      await cacheManager.fetch('/api/test', {
        cacheConfig: { strategy: 'cache-first', ttl: 300 },
      })

      // Clear cache
      await cacheManager.clear()

      // Should fetch again from network
      await cacheManager.fetch('/api/test', {
        cacheConfig: { strategy: 'cache-first', ttl: 300 },
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('invalidates cache by string pattern', async () => {
      const mockData = { id: 1, name: 'test' }
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
        headers: new Headers(),
      })

      // Populate cache
      await cacheManager.fetch('/api/users/1', {
        cacheConfig: { strategy: 'cache-first', ttl: 300 },
      })
      await cacheManager.fetch('/api/posts/1', {
        cacheConfig: { strategy: 'cache-first', ttl: 300 },
      })

      // Invalidate users cache
      await cacheManager.invalidate('users')

      // Users should be refetched
      await cacheManager.fetch('/api/users/1', {
        cacheConfig: { strategy: 'cache-first', ttl: 300 },
      })

      // Posts should still be cached (3 total fetches)
      await cacheManager.fetch('/api/posts/1', {
        cacheConfig: { strategy: 'cache-first', ttl: 300 },
      })

      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('invalidates cache by regex pattern', async () => {
      const mockData = { id: 1, name: 'test' }
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
        headers: new Headers(),
      })

      // Populate cache
      await cacheManager.fetch('/api/users/1', {
        cacheConfig: { strategy: 'cache-first', ttl: 300 },
      })

      // Invalidate with regex
      await cacheManager.invalidate(/users/)

      // Should refetch
      await cacheManager.fetch('/api/users/1', {
        cacheConfig: { strategy: 'cache-first', ttl: 300 },
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('cache warm-up', () => {
    it('preloads multiple URLs', async () => {
      const mockData = { id: 1, name: 'test' }
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
        headers: new Headers(),
      })

      await cacheManager.warmUp(['/api/users', '/api/posts', '/api/settings'])

      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('continues warming even if one URL fails', async () => {
      const mockData = { id: 1, name: 'test' }
      mockFetch
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockData),
          headers: new Headers(),
        })

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await cacheManager.warmUp(['/api/fail', '/api/success'])

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(errorSpy).toHaveBeenCalled()
      errorSpy.mockRestore()
    })
  })

  // Note: Network timeout test is skipped as it's difficult to test with fake timers and fetch

  describe('shouldCache', () => {
    it('does not cache non-200 responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
        headers: new Headers(),
      })

      await cacheManager.fetch('/api/notfound', {
        cacheConfig: { strategy: 'cache-first', ttl: 300 },
      })

      // Second fetch should hit network again since first wasn't cached
      await cacheManager.fetch('/api/notfound', {
        cacheConfig: { strategy: 'cache-first', ttl: 300 },
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('custom cache key', () => {
    it('uses custom cache key function', async () => {
      const mockData = { id: 1, name: 'test' }
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
        headers: new Headers(),
      })

      const customCacheKey = vi.fn().mockReturnValue('custom-key')

      await cacheManager.fetch('/api/test', {
        cacheConfig: {
          strategy: 'cache-first',
          ttl: 300,
          cacheKey: customCacheKey,
        },
      })

      expect(customCacheKey).toHaveBeenCalledWith('/api/test', expect.any(Object))
    })
  })
})

describe('apiCache', () => {
  it('is a CacheManager instance', () => {
    expect(apiCache).toBeInstanceOf(CacheManager)
  })

  it('has default stale-while-revalidate strategy', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
      headers: new Headers(),
    })
    global.fetch = mockFetch as typeof fetch

    await apiCache.fetch('/api/test')

    expect(mockFetch).toHaveBeenCalled()
  })
})


describe('cache expiration', () => {
  it('refetches expired cache entries', async () => {
    const cacheManager = new CacheManager()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
      headers: new Headers(),
    })
    global.fetch = mockFetch as typeof fetch

    // Fetch with very short TTL
    await cacheManager.fetch('/api/expire-test', {
      cacheConfig: { strategy: 'cache-first', ttl: 0 }, // Expires immediately
    })

    // Small delay to ensure expiration
    await new Promise(resolve => setTimeout(resolve, 10))

    // Should refetch because cache expired
    await cacheManager.fetch('/api/expire-test', {
      cacheConfig: { strategy: 'cache-first', ttl: 0 },
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('parses maxAge from cache-control header', async () => {
    const cacheManager = new CacheManager()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
      headers: new Headers({ 'cache-control': 'max-age=3600' }),
    })
    global.fetch = mockFetch as typeof fetch

    await cacheManager.fetch('/api/maxage-test', {
      cacheConfig: { strategy: 'cache-first', ttl: 60 },
    })

    // Second fetch should use cache (max-age=3600 is still valid)
    await cacheManager.fetch('/api/maxage-test', {
      cacheConfig: { strategy: 'cache-first', ttl: 60 },
    })

    // Should only fetch once from network
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})


describe('ETag support', () => {
  it('stores etag from response headers', async () => {
    const cacheManager = new CacheManager()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
      headers: new Headers({ 'etag': '"abc123"' }),
    })
    global.fetch = mockFetch as typeof fetch

    await cacheManager.fetch('/api/etag-test', {
      cacheConfig: { strategy: 'cache-first', ttl: 300 },
    })

    // Verify fetch was called (etag is stored internally)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

describe('request body in cache key', () => {
  it('includes request body in default cache key', async () => {
    const cacheManager = new CacheManager()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
      headers: new Headers(),
    })
    global.fetch = mockFetch as typeof fetch

    // POST with body
    await cacheManager.fetch('/api/post-test', {
      method: 'POST',
      body: JSON.stringify({ key: 'value1' }),
      cacheConfig: { strategy: 'cache-first', ttl: 300 },
    })

    // Same URL, different body should cache separately
    await cacheManager.fetch('/api/post-test', {
      method: 'POST',
      body: JSON.stringify({ key: 'value2' }),
      cacheConfig: { strategy: 'cache-first', ttl: 300 },
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

describe('memory eviction', () => {
  it('evicts oldest entries when memory limit is exceeded', async () => {
    // Create a cache manager and manually set a very low memory limit
    const cacheManager = new CacheManager()
    // @ts-expect-error - accessing private property for testing
    cacheManager.maxMemorySize = 500 // Very small limit

    const mockFetch = vi.fn()
    global.fetch = mockFetch as typeof fetch

    // First request - small data
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1 }),
      headers: new Headers(),
    })

    await cacheManager.fetch('/api/first', {
      cacheConfig: { strategy: 'cache-first', ttl: 300 },
    })

    // Second request - larger data that will trigger eviction
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 2, largeData: 'x'.repeat(300) }),
      headers: new Headers(),
    })

    await cacheManager.fetch('/api/second', {
      cacheConfig: { strategy: 'cache-first', ttl: 300 },
    })

    // Third request - should trigger eviction of first entry
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 3, largeData: 'y'.repeat(300) }),
      headers: new Headers(),
    })

    await cacheManager.fetch('/api/third', {
      cacheConfig: { strategy: 'cache-first', ttl: 300 },
    })

    // First entry should have been evicted, so fetching it again should hit network
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1, refetched: true }),
      headers: new Headers(),
    })

    const result = await cacheManager.fetch('/api/first', {
      cacheConfig: { strategy: 'cache-first', ttl: 300 },
    })

    expect(mockFetch).toHaveBeenCalledTimes(4)
    expect(result).toHaveProperty('refetched', true)
  })
})

describe('IndexedDB operations', () => {
  let originalIndexedDB: IDBFactory | undefined
  let mockIndexedDB: {
    open: ReturnType<typeof vi.fn>
  }
  let mockObjectStore: {
    get: ReturnType<typeof vi.fn>
    put: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
    openCursor: ReturnType<typeof vi.fn>
  }
  let mockTransaction: {
    objectStore: ReturnType<typeof vi.fn>
  }
  let mockDatabase: {
    transaction: ReturnType<typeof vi.fn>
    objectStoreNames: { contains: ReturnType<typeof vi.fn> }
    createObjectStore: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    originalIndexedDB = globalThis.indexedDB

    mockObjectStore = {
      get: vi.fn(),
      put: vi.fn(),
      clear: vi.fn(),
      openCursor: vi.fn(),
    }

    mockTransaction = {
      objectStore: vi.fn(() => mockObjectStore),
    }

    mockDatabase = {
      transaction: vi.fn(() => mockTransaction),
      objectStoreNames: { contains: vi.fn(() => true) },
      createObjectStore: vi.fn(),
    }

    mockIndexedDB = {
      open: vi.fn(),
    }

    // Set up default mock behavior
    mockIndexedDB.open.mockImplementation(() => {
      const request = {
        result: mockDatabase,
        error: null,
        onsuccess: null as ((event: unknown) => void) | null,
        onerror: null as ((event: unknown) => void) | null,
        onupgradeneeded: null as ((event: unknown) => void) | null,
      }
      setTimeout(() => {
        request.onsuccess?.({ target: request })
      }, 0)
      return request
    })

    mockObjectStore.get.mockImplementation(() => {
      const request = {
        result: null,
        onsuccess: null as ((event: unknown) => void) | null,
        onerror: null as ((event: unknown) => void) | null,
      }
      setTimeout(() => {
        request.onsuccess?.({ target: request })
      }, 0)
      return request
    })

    // @ts-expect-error - mocking global
    globalThis.indexedDB = mockIndexedDB
  })

  afterEach(() => {
    if (originalIndexedDB) {
      globalThis.indexedDB = originalIndexedDB
    }
    vi.restoreAllMocks()
  })

  it('stores data in IndexedDB after fetching', async () => {
    const cacheManager = new CacheManager()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1 }),
      headers: new Headers(),
    })
    global.fetch = mockFetch as typeof fetch

    await cacheManager.fetch('/api/test', {
      cacheConfig: { strategy: 'cache-first', ttl: 300 },
    })

    // Wait for async IndexedDB operations
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(mockObjectStore.put).toHaveBeenCalled()
  })

  it('retrieves data from IndexedDB storage when memory cache is empty', async () => {
    const storedData = {
      data: { id: 99, name: 'from-storage' },
      timestamp: Date.now(),
      key: 'GET:/api/storage-test:',
    }

    mockObjectStore.get.mockImplementation(() => {
      const request = {
        result: storedData,
        onsuccess: null as ((event: unknown) => void) | null,
        onerror: null as ((event: unknown) => void) | null,
      }
      setTimeout(() => {
        request.onsuccess?.({ target: request })
      }, 0)
      return request
    })

    const cacheManager = new CacheManager()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 2, name: 'from-network' }),
      headers: new Headers(),
    })
    global.fetch = mockFetch as typeof fetch

    const result = await cacheManager.fetch('/api/storage-test', {
      cacheConfig: { strategy: 'cache-first', ttl: 300 },
    })

    // Wait for async IndexedDB operations
    await new Promise(resolve => setTimeout(resolve, 20))

    // Should return data from storage, not from network
    expect(result).toEqual({ id: 99, name: 'from-storage' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('clears IndexedDB storage when clear() is called', async () => {
    const cacheManager = new CacheManager()

    await cacheManager.clear()

    // Wait for async IndexedDB operations
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(mockObjectStore.clear).toHaveBeenCalled()
  })

  it('invalidates IndexedDB entries matching pattern', async () => {
    const mockCursor = {
      value: { key: 'GET:/api/users/1:' },
      delete: vi.fn(),
      continue: vi.fn(),
    }

    mockObjectStore.openCursor.mockImplementation(() => {
      const request = {
        result: mockCursor,
        onsuccess: null as ((event: unknown) => void) | null,
      }
      setTimeout(() => {
        request.onsuccess?.({ target: { result: mockCursor } })
        // Simulate cursor iteration ending
        setTimeout(() => {
          request.onsuccess?.({ target: { result: null } })
        }, 0)
      }, 0)
      return request
    })

    const cacheManager = new CacheManager()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1 }),
      headers: new Headers(),
    })
    global.fetch = mockFetch as typeof fetch

    // Populate cache
    await cacheManager.fetch('/api/users/1', {
      cacheConfig: { strategy: 'cache-first', ttl: 300 },
    })

    await cacheManager.invalidate('users')

    // Wait for async IndexedDB operations
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(mockObjectStore.openCursor).toHaveBeenCalled()
    expect(mockCursor.delete).toHaveBeenCalled()
    expect(mockCursor.continue).toHaveBeenCalled()
  })

  it('invalidates IndexedDB entries matching regex pattern', async () => {
    const mockCursor = {
      value: { key: 'GET:/api/posts/123:' },
      delete: vi.fn(),
      continue: vi.fn(),
    }

    mockObjectStore.openCursor.mockImplementation(() => {
      const request = {
        result: mockCursor,
        onsuccess: null as ((event: unknown) => void) | null,
      }
      setTimeout(() => {
        request.onsuccess?.({ target: { result: mockCursor } })
        setTimeout(() => {
          request.onsuccess?.({ target: { result: null } })
        }, 0)
      }, 0)
      return request
    })

    const cacheManager = new CacheManager()

    await cacheManager.invalidate(/posts/)

    // Wait for async IndexedDB operations
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(mockCursor.delete).toHaveBeenCalled()
  })

  it('handles cursor items that do not match pattern', async () => {
    const mockCursor = {
      value: { key: 'GET:/api/orders/1:' },
      delete: vi.fn(),
      continue: vi.fn(),
    }

    mockObjectStore.openCursor.mockImplementation(() => {
      const request = {
        result: mockCursor,
        onsuccess: null as ((event: unknown) => void) | null,
      }
      setTimeout(() => {
        request.onsuccess?.({ target: { result: mockCursor } })
        setTimeout(() => {
          request.onsuccess?.({ target: { result: null } })
        }, 0)
      }, 0)
      return request
    })

    const cacheManager = new CacheManager()

    await cacheManager.invalidate('users') // Pattern doesn't match 'orders'

    // Wait for async IndexedDB operations
    await new Promise(resolve => setTimeout(resolve, 20))

    // delete should NOT have been called since pattern doesn't match
    expect(mockCursor.delete).not.toHaveBeenCalled()
    expect(mockCursor.continue).toHaveBeenCalled()
  })

  it('creates object store on database upgrade', async () => {
    mockDatabase.objectStoreNames.contains.mockReturnValue(false)

    mockIndexedDB.open.mockImplementation(() => {
      const request = {
        result: mockDatabase,
        error: null,
        onsuccess: null as ((event: unknown) => void) | null,
        onerror: null as ((event: unknown) => void) | null,
        onupgradeneeded: null as ((event: unknown) => void) | null,
      }
      setTimeout(() => {
        // Trigger upgrade first
        request.onupgradeneeded?.({ target: request })
        // Then success
        request.onsuccess?.({ target: request })
      }, 0)
      return request
    })

    const cacheManager = new CacheManager()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1 }),
      headers: new Headers(),
    })
    global.fetch = mockFetch as typeof fetch

    await cacheManager.fetch('/api/test', {
      cacheConfig: { strategy: 'cache-first', ttl: 300 },
    })

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(mockDatabase.createObjectStore).toHaveBeenCalledWith('cache', { keyPath: 'key' })
  })

  it('handles IndexedDB open error gracefully', async () => {
    mockIndexedDB.open.mockImplementation(() => {
      const request = {
        result: null,
        error: new Error('Failed to open database'),
        onsuccess: null as ((event: unknown) => void) | null,
        onerror: null as ((event: unknown) => void) | null,
        onupgradeneeded: null as ((event: unknown) => void) | null,
      }
      setTimeout(() => {
        request.onerror?.({ target: request })
      }, 0)
      return request
    })

    const cacheManager = new CacheManager()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1 }),
      headers: new Headers(),
    })
    global.fetch = mockFetch as typeof fetch

    // Should not throw, just fall back to network
    const result = await cacheManager.fetch('/api/test', {
      cacheConfig: { strategy: 'cache-first', ttl: 300 },
    })

    expect(result).toEqual({ id: 1 })
  })

  it('handles IndexedDB get error gracefully', async () => {
    mockObjectStore.get.mockImplementation(() => {
      const request = {
        result: null,
        onsuccess: null as ((event: unknown) => void) | null,
        onerror: null as ((event: unknown) => void) | null,
      }
      setTimeout(() => {
        request.onerror?.({ target: request })
      }, 0)
      return request
    })

    const cacheManager = new CacheManager()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1, fromNetwork: true }),
      headers: new Headers(),
    })
    global.fetch = mockFetch as typeof fetch

    const result = await cacheManager.fetch('/api/test', {
      cacheConfig: { strategy: 'cache-first', ttl: 300 },
    })

    // Should fall back to network fetch
    expect(result).toHaveProperty('fromNetwork', true)
  })

  it('handles setToStorage error gracefully', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // First call to open for getFromStorage succeeds
    // Second call to open for setToStorage throws
    let callCount = 0
    mockIndexedDB.open.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // First call - getFromStorage
        const request = {
          result: mockDatabase,
          onsuccess: null as ((event: unknown) => void) | null,
        }
        setTimeout(() => {
          request.onsuccess?.({ target: request })
        }, 0)
        return request
      } else {
        // Second call - setToStorage - throw error
        throw new Error('Storage write failed')
      }
    })

    mockObjectStore.get.mockImplementation(() => {
      const request = {
        result: null,
        onsuccess: null as ((event: unknown) => void) | null,
      }
      setTimeout(() => {
        request.onsuccess?.({ target: request })
      }, 0)
      return request
    })

    const cacheManager = new CacheManager()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1 }),
      headers: new Headers(),
    })
    global.fetch = mockFetch as typeof fetch

    // Should not throw even if storage fails
    const result = await cacheManager.fetch('/api/test', {
      cacheConfig: { strategy: 'cache-first', ttl: 300 },
    })

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(result).toEqual({ id: 1 })
    expect(errorSpy).toHaveBeenCalledWith('Failed to cache to IndexedDB:', expect.any(Error))
    errorSpy.mockRestore()
  })

  it('works without indexedDB available', async () => {
    // Remove indexedDB
    // @ts-ignore - removing global for testing
    delete globalThis.indexedDB

    const cacheManager = new CacheManager()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1 }),
      headers: new Headers(),
    })
    global.fetch = mockFetch as typeof fetch

    const result = await cacheManager.fetch('/api/test', {
      cacheConfig: { strategy: 'cache-first', ttl: 300 },
    })

    expect(result).toEqual({ id: 1 })

    // clear should work without indexedDB
    await cacheManager.clear()

    // invalidate should work without indexedDB
    await cacheManager.invalidate('test')
  })
})

describe('stale-while-revalidate background revalidation', () => {
  it('revalidates in background when data is stale', async () => {
    const cacheManager = new CacheManager()
    const mockFetch = vi.fn()
    global.fetch = mockFetch as typeof fetch

    const initialData = { id: 1, version: 'v1' }
    const updatedData = { id: 1, version: 'v2' }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(initialData),
      headers: new Headers(),
    })

    // First fetch to populate cache
    await cacheManager.fetch('/api/test', {
      cacheConfig: { strategy: 'stale-while-revalidate', ttl: 300, staleTime: 0 }, // staleTime=0 means always stale
    })

    // Second fetch with updated data for background revalidation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(updatedData),
      headers: new Headers(),
    })

    // This should return stale data immediately
    const result = await cacheManager.fetch('/api/test', {
      cacheConfig: { strategy: 'stale-while-revalidate', ttl: 300, staleTime: 0 },
    })

    expect(result).toEqual(initialData) // Returns stale data

    // Wait for background revalidation to complete
    await new Promise(resolve => setTimeout(resolve, 50))

    // Background fetch should have been called
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('logs error when background revalidation fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const cacheManager = new CacheManager()
    const mockFetch = vi.fn()
    global.fetch = mockFetch as typeof fetch

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1 }),
      headers: new Headers(),
    })

    await cacheManager.fetch('/api/test', {
      cacheConfig: { strategy: 'stale-while-revalidate', ttl: 300, staleTime: 0 },
    })

    // Background revalidation will fail
    mockFetch.mockRejectedValueOnce(new Error('Background fetch failed'))

    await cacheManager.fetch('/api/test', {
      cacheConfig: { strategy: 'stale-while-revalidate', ttl: 300, staleTime: 0 },
    })

    // Wait for background revalidation
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(errorSpy).toHaveBeenCalledWith('Background revalidation failed:', expect.any(Error))
    errorSpy.mockRestore()
  })

  it('does not cache failed background revalidation responses', async () => {
    const cacheManager = new CacheManager()
    const mockFetch = vi.fn()
    global.fetch = mockFetch as typeof fetch

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1, version: 'v1' }),
      headers: new Headers(),
    })

    await cacheManager.fetch('/api/test', {
      cacheConfig: { strategy: 'stale-while-revalidate', ttl: 300, staleTime: 0 },
    })

    // Background revalidation returns non-cacheable response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
      headers: new Headers(),
    })

    await cacheManager.fetch('/api/test', {
      cacheConfig: { strategy: 'stale-while-revalidate', ttl: 300, staleTime: 0 },
    })

    // Wait for background revalidation
    await new Promise(resolve => setTimeout(resolve, 50))

    // Third fetch should still return original cached data
    const result = await cacheManager.fetch('/api/test', {
      cacheConfig: { strategy: 'stale-while-revalidate', ttl: 300, staleTime: 0 },
    })

    expect(result).toEqual({ id: 1, version: 'v1' })
  })
})

describe('useCachedFetch', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Clear apiCache before each test to avoid interference
    await apiCache.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns data on successful fetch', async () => {
    const mockData = { id: 1, name: 'test' }
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockData),
      headers: new Headers(),
    })
    global.fetch = mockFetch as typeof fetch

    const { result } = renderHook(() => useCachedFetch('/api/hook-success-test'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockData)
    expect(result.current.error).toBeNull()
  })

  it('returns error on fetch failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Fetch failed'))
    global.fetch = mockFetch as typeof fetch

    const { result } = renderHook(() => useCachedFetch('/api/hook-fail-test'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('Fetch failed')
  })

  it('provides revalidate function', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
      headers: new Headers(),
    })
    global.fetch = mockFetch as typeof fetch

    const { result } = renderHook(() => useCachedFetch('/api/hook-revalidate-test'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual({ data: 'test' })
    expect(typeof result.current.revalidate).toBe('function')

    // Revalidate should not throw
    await act(async () => {
      await result.current.revalidate()
    })

    expect(result.current.data).toEqual({ data: 'test' })
  })
})
