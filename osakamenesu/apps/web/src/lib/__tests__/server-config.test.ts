import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('server-config', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('getServerConfig', () => {
    it('returns config with required properties', async () => {
      const { getServerConfig } = await import('../server-config')
      const config = getServerConfig()

      expect(config).toHaveProperty('internalApiBase')
      expect(config).toHaveProperty('publicApiBase')
      expect(config).toHaveProperty('siteUrl')
    })

    it('uses OSAKAMENESU_API_INTERNAL_BASE when set', async () => {
      vi.stubEnv('OSAKAMENESU_API_INTERNAL_BASE', 'http://custom-api:9000/')

      const { getServerConfig } = await import('../server-config')
      const config = getServerConfig()

      expect(config.internalApiBase).toBe('http://custom-api:9000')
    })

    it('uses NEXT_PUBLIC_SITE_URL when set', async () => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com/')

      const { getServerConfig } = await import('../server-config')
      const config = getServerConfig()

      expect(config.siteUrl).toBe('https://example.com')
    })

    it('uses NEXT_PUBLIC_OSAKAMENESU_API_BASE for publicApiBase', async () => {
      vi.stubEnv('NEXT_PUBLIC_OSAKAMENESU_API_BASE', 'https://api.example.com/')

      const { getServerConfig } = await import('../server-config')
      const config = getServerConfig()

      expect(config.publicApiBase).toBe('https://api.example.com')
    })

    it('removes trailing slashes from all bases', async () => {
      vi.stubEnv('OSAKAMENESU_API_INTERNAL_BASE', 'http://api.test////')
      vi.stubEnv('NEXT_PUBLIC_OSAKAMENESU_API_BASE', 'https://public.test//')
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.test/')

      const { getServerConfig } = await import('../server-config')
      const config = getServerConfig()

      expect(config.internalApiBase).toBe('http://api.test')
      expect(config.publicApiBase).toBe('https://public.test')
      expect(config.siteUrl).toBe('https://site.test')
    })

  })

  describe('resolveInternalApiBase', () => {
    it('returns internal API base from config', async () => {
      vi.stubEnv('OSAKAMENESU_API_INTERNAL_BASE', 'http://internal-api:8000')

      const { resolveInternalApiBase } = await import('../server-config')
      const base = resolveInternalApiBase()

      expect(base).toBe('http://internal-api:8000')
    })
  })
})
