/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CacheManager, apiCache } from '../cache-manager'

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
