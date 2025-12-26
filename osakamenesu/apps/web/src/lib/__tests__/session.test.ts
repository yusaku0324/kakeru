import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  DASHBOARD_SESSION_COOKIE_NAME,
  SITE_SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '../session'

describe('session', () => {
  describe('constants', () => {
    it('has correct dashboard session cookie name', () => {
      expect(DASHBOARD_SESSION_COOKIE_NAME).toBe('osakamenesu_dashboard_session')
    })

    it('has correct site session cookie name', () => {
      expect(SITE_SESSION_COOKIE_NAME).toBe('osakamenesu_site_session')
    })
  })

  describe('sessionCookieOptions', () => {
    beforeEach(() => {
      vi.resetModules()
      vi.unstubAllEnvs()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('returns development options when not in production', async () => {
      vi.stubEnv('NODE_ENV', 'development')

      const { sessionCookieOptions: getOptions } = await import('../session')
      const options = getOptions()

      expect(options.httpOnly).toBe(true)
      expect(options.sameSite).toBe('lax')
      expect(options.secure).toBe(false)
      expect(options.path).toBe('/')
      expect(options.maxAge).toBe(60 * 60 * 24 * 7) // 1 week
    })

    it('returns production options when in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')

      const { sessionCookieOptions: getOptions } = await import('../session')
      const options = getOptions()

      expect(options.httpOnly).toBe(true)
      expect(options.sameSite).toBe('none')
      expect(options.secure).toBe(true)
      expect(options.path).toBe('/')
    })

    it('sets domain when SESSION_COOKIE_DOMAIN is configured', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('SESSION_COOKIE_DOMAIN', '.example.com')

      const { sessionCookieOptions: getOptions } = await import('../session')
      const options = getOptions()

      expect(options.domain).toBe('.example.com')
    })

    it('does not set domain when SESSION_COOKIE_DOMAIN is not configured', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      // Don't set SESSION_COOKIE_DOMAIN

      const { sessionCookieOptions: getOptions } = await import('../session')
      const options = getOptions()

      expect(options.domain).toBeUndefined()
    })

    it('has correct maxAge of one week', async () => {
      vi.stubEnv('NODE_ENV', 'development')

      const { sessionCookieOptions: getOptions } = await import('../session')
      const options = getOptions()

      const oneWeekInSeconds = 60 * 60 * 24 * 7
      expect(options.maxAge).toBe(oneWeekInSeconds)
    })
  })
})
