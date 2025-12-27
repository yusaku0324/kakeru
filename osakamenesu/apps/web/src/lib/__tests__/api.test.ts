import { describe, it, expect, vi, afterEach } from 'vitest'

import { buildApiUrl, resolveApiBases } from '../api'

describe('api', () => {
  describe('buildApiUrl', () => {
    const originalWindow = global.window

    afterEach(() => {
      global.window = originalWindow
    })

    it('handles http:// base URL', () => {
      const url = buildApiUrl('http://localhost:8000', '/test/path')
      expect(url).toBe('http://localhost:8000/test/path')
    })

    it('handles https:// base URL', () => {
      const url = buildApiUrl('https://api.example.com', '/test/path')
      expect(url).toBe('https://api.example.com/test/path')
    })

    it('removes trailing slashes from base', () => {
      const url = buildApiUrl('http://localhost:8000/', '/test/path')
      expect(url).toBe('http://localhost:8000/test/path')
    })

    it('handles protocol-relative base URL', () => {
      const url = buildApiUrl('//api.example.com', '/test/path')
      expect(url).toBe('https://api.example.com/test/path')
    })

    it('handles path without leading slash', () => {
      const url = buildApiUrl('http://localhost:8000', 'test/path')
      expect(url).toBe('http://localhost:8000/test/path')
    })

    it('handles relative base path', () => {
      global.window = { location: { origin: 'http://localhost:3000' } } as any
      const url = buildApiUrl('/api', '/test/path')
      expect(url).toBe('http://localhost:3000/api/test/path')
    })

    it('avoids duplicating prefix when path already includes it', () => {
      global.window = { location: { origin: 'http://localhost:3000' } } as any
      const url = buildApiUrl('/api', '/api/test')
      expect(url).toBe('http://localhost:3000/api/test')
    })

    it('handles empty base', () => {
      global.window = { location: { origin: 'http://localhost:3000' } } as any
      const url = buildApiUrl('', '/test/path')
      expect(url).toBe('http://localhost:3000/test/path')
    })

    it('uses default origin when window is undefined', () => {
      global.window = undefined as unknown as Window & typeof globalThis
      const url = buildApiUrl('/api', '/test/path')
      expect(url).toContain('/api/test/path')
    })

    it('handles complex path', () => {
      const url = buildApiUrl('http://localhost:8000', '/api/v1/users/123/profile')
      expect(url).toBe('http://localhost:8000/api/v1/users/123/profile')
    })

    it('handles path that equals the prefix', () => {
      global.window = { location: { origin: 'http://localhost:3000' } } as any
      const url = buildApiUrl('/api', '/api')
      expect(url).toBe('http://localhost:3000/api')
    })
  })

  describe('resolveApiBases', () => {
    const originalWindow = global.window

    afterEach(() => {
      global.window = originalWindow
    })

    it('returns /api as fallback when in browser', () => {
      global.window = { location: { origin: 'http://localhost:3000' } } as any
      const bases = resolveApiBases()
      expect(bases).toContain('/api')
    })

    it('does not duplicate bases', () => {
      global.window = { location: { origin: 'http://localhost:3000' } } as any
      const bases = resolveApiBases()
      const uniqueBases = [...new Set(bases)]
      expect(bases.length).toBe(uniqueBases.length)
    })

    it('always has at least one base', () => {
      global.window = { location: { origin: 'http://localhost:3000' } } as any
      const bases = resolveApiBases()
      expect(bases.length).toBeGreaterThanOrEqual(1)
    })

    // Note: Server-side path with loadServerBases() is tested via integration
    // Cannot easily mock dynamic require('./server-config') in unit tests
  })

  describe('buildApiUrl edge cases', () => {
    const originalWindow = global.window

    afterEach(() => {
      global.window = originalWindow
    })

    it('handles empty prefix (base normalizes to empty string)', () => {
      global.window = { location: { origin: 'http://localhost:3000' } } as any
      const url = buildApiUrl('/', '/test/path')
      expect(url).toBe('http://localhost:3000/test/path')
    })

    it('handles result starting with //', () => {
      global.window = undefined as unknown as Window & typeof globalThis
      const url = buildApiUrl('//api.example.com/', '/test')
      expect(url).toBe('https://api.example.com/test')
    })

    it('handles path without leading slash in relative base', () => {
      global.window = { location: { origin: 'http://localhost:3000' } } as any
      const url = buildApiUrl('', 'test/path')
      expect(url).toBe('http://localhost:3000/test/path')
    })
  })
})
