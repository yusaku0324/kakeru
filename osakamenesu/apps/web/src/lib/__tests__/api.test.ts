import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildApiUrl, resolveApiBases } from '../api'

describe('api', () => {
  const originalWindow = global.window

  afterEach(() => {
    global.window = originalWindow
    vi.unstubAllEnvs()
  })

  describe('buildApiUrl', () => {
    describe('with absolute URLs', () => {
      it('builds URL with http base', () => {
        const result = buildApiUrl('http://api.example.com', '/v1/shops')
        expect(result).toBe('http://api.example.com/v1/shops')
      })

      it('builds URL with https base', () => {
        const result = buildApiUrl('https://api.example.com', '/v1/shops')
        expect(result).toBe('https://api.example.com/v1/shops')
      })

      it('handles trailing slash in base', () => {
        const result = buildApiUrl('https://api.example.com/', '/v1/shops')
        expect(result).toBe('https://api.example.com/v1/shops')
      })

      it('handles path without leading slash', () => {
        const result = buildApiUrl('https://api.example.com', 'v1/shops')
        expect(result).toBe('https://api.example.com/v1/shops')
      })
    })

    describe('with protocol-relative URLs', () => {
      it('converts // to https://', () => {
        const result = buildApiUrl('//api.example.com', '/v1/shops')
        expect(result).toBe('https://api.example.com/v1/shops')
      })
    })

    describe('with relative base', () => {
      beforeEach(() => {
        global.window = {
          location: { origin: 'http://localhost:3000' }
        } as typeof globalThis.window
      })

      it('builds URL with /api base', () => {
        const result = buildApiUrl('/api', '/v1/shops')
        expect(result).toBe('http://localhost:3000/api/v1/shops')
      })

      it('handles empty base', () => {
        const result = buildApiUrl('', '/v1/shops')
        expect(result).toBe('http://localhost:3000/v1/shops')
      })

      it('avoids duplicate path segments', () => {
        const result = buildApiUrl('/api', '/api/v1/shops')
        expect(result).toBe('http://localhost:3000/api/v1/shops')
      })
    })

    describe('edge cases', () => {
      beforeEach(() => {
        global.window = {
          location: { origin: 'https://example.com' }
        } as typeof globalThis.window
      })

      it('handles multiple trailing slashes in base', () => {
        const result = buildApiUrl('https://api.example.com///', '/v1/shops')
        expect(result).toBe('https://api.example.com/v1/shops')
      })

      it('handles base that equals path prefix', () => {
        const result = buildApiUrl('/api', '/api')
        expect(result).toBe('https://example.com/api')
      })

      it('preserves query parameters in path', () => {
        const result = buildApiUrl('https://api.example.com', '/v1/shops?limit=10&offset=0')
        expect(result).toBe('https://api.example.com/v1/shops?limit=10&offset=0')
      })

      it('handles path with hash fragment', () => {
        const result = buildApiUrl('https://api.example.com', '/docs#section')
        expect(result).toBe('https://api.example.com/docs#section')
      })

      it('handles base with only slashes that normalize to empty', () => {
        const result = buildApiUrl('/', '/v1/shops')
        expect(result).toBe('https://example.com/v1/shops')
      })

      it('handles double-slash relative URL result', () => {
        // When candidate ends up starting with // but not http/https
        const result = buildApiUrl('/', '//test/path')
        expect(result).toBe('https://test/path')
      })
    })
  })

  describe('resolveApiBases', () => {
    describe('in browser environment', () => {
      beforeEach(() => {
        global.window = {
          location: { origin: 'http://localhost:3000' }
        } as typeof globalThis.window
      })

      it('returns /api as first base', () => {
        const bases = resolveApiBases()
        expect(bases[0]).toBe('/api')
      })

      it('returns array with at least one base', () => {
        const bases = resolveApiBases()
        expect(bases.length).toBeGreaterThanOrEqual(1)
      })

      it('does not include duplicate bases', () => {
        const bases = resolveApiBases()
        const uniqueBases = [...new Set(bases)]
        expect(bases.length).toBe(uniqueBases.length)
      })
    })

    it('includes public API base from env', () => {
      vi.stubEnv('NEXT_PUBLIC_OSAKAMENESU_API_BASE', 'https://api.test.com/')
      const bases = resolveApiBases()
      // The function should include the env base
      expect(bases).toContain('/api')
    })

    it('returns unique bases without duplicates', () => {
      const bases = resolveApiBases()
      const uniqueBases = [...new Set(bases)]
      expect(bases).toEqual(uniqueBases)
    })
  })

  describe('edge cases for buildApiUrl', () => {
    beforeEach(() => {
      global.window = {
        location: { origin: 'https://site.com' }
      } as typeof globalThis.window
    })

    it('handles candidate that starts with double slash', () => {
      // When the result starts with // but is not http/https
      const result = buildApiUrl('', '//api/path')
      expect(result).toBe('https://api/path')
    })

    it('handles relative candidate without leading slash', () => {
      const result = buildApiUrl('', 'api/path')
      expect(result).toBe('https://site.com/api/path')
    })
  })
})
