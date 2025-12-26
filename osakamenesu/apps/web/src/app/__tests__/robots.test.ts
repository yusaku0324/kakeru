import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('robots', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns valid robots.txt configuration', async () => {
    const { default: robots } = await import('../robots')
    const result = robots()

    expect(result).toHaveProperty('rules')
    expect(result).toHaveProperty('sitemap')
    expect(result).toHaveProperty('host')
  })

  it('includes standard disallow paths', async () => {
    const { default: robots } = await import('../robots')
    const result = robots()

    expect(result.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userAgent: '*',
          allow: '/',
          disallow: expect.arrayContaining([
            '/dashboard',
            '/dashboard/*',
            '/admin',
            '/admin/*',
            '/api',
            '/api/*',
          ]),
        }),
      ])
    )
  })

  it('uses NEXT_PUBLIC_SITE_URL for sitemap and host', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com/')
    const { default: robots } = await import('../robots')
    const result = robots()

    expect(result.sitemap).toContain('https://example.com/sitemap.xml')
    expect(result.host).toBe('https://example.com')
  })

  it('strips trailing slash from base URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://test.com/')
    const { default: robots } = await import('../robots')
    const result = robots()

    expect(result.host).toBe('https://test.com')
  })
})
