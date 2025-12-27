import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  DASHBOARD_SESSION_COOKIE_NAME,
  SITE_SESSION_COOKIE_NAME,
  sessionCookieOptions,
  getSession,
  getSessionByScope,
  setSessionCookie,
  clearSessionCookie,
} from '../session'

// Mock next/headers cookies
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
}

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}))

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

  describe('getSession', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns dashboard session when available', async () => {
      mockCookieStore.get.mockImplementation((name: string) => {
        if (name === DASHBOARD_SESSION_COOKIE_NAME) {
          return { value: 'dashboard-token' }
        }
        return undefined
      })

      const session = await getSession()
      expect(session).toBe('dashboard-token')
    })

    it('returns site session when dashboard is not available', async () => {
      mockCookieStore.get.mockImplementation((name: string) => {
        if (name === SITE_SESSION_COOKIE_NAME) {
          return { value: 'site-token' }
        }
        return undefined
      })

      const session = await getSession()
      expect(session).toBe('site-token')
    })

    it('returns null when no session exists', async () => {
      mockCookieStore.get.mockReturnValue(undefined)

      const session = await getSession()
      expect(session).toBeNull()
    })

    it('prefers dashboard over site session', async () => {
      mockCookieStore.get.mockImplementation((name: string) => {
        if (name === DASHBOARD_SESSION_COOKIE_NAME) {
          return { value: 'dashboard-token' }
        }
        if (name === SITE_SESSION_COOKIE_NAME) {
          return { value: 'site-token' }
        }
        return undefined
      })

      const session = await getSession()
      expect(session).toBe('dashboard-token')
    })
  })

  describe('getSessionByScope', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns dashboard session for dashboard scope', async () => {
      mockCookieStore.get.mockImplementation((name: string) => {
        if (name === DASHBOARD_SESSION_COOKIE_NAME) {
          return { value: 'dashboard-token' }
        }
        return undefined
      })

      const session = await getSessionByScope('dashboard')
      expect(session).toBe('dashboard-token')
      expect(mockCookieStore.get).toHaveBeenCalledWith(DASHBOARD_SESSION_COOKIE_NAME)
    })

    it('returns site session for site scope', async () => {
      mockCookieStore.get.mockImplementation((name: string) => {
        if (name === SITE_SESSION_COOKIE_NAME) {
          return { value: 'site-token' }
        }
        return undefined
      })

      const session = await getSessionByScope('site')
      expect(session).toBe('site-token')
      expect(mockCookieStore.get).toHaveBeenCalledWith(SITE_SESSION_COOKIE_NAME)
    })

    it('returns null when scope session does not exist', async () => {
      mockCookieStore.get.mockReturnValue(undefined)

      const session = await getSessionByScope('dashboard')
      expect(session).toBeNull()
    })
  })

  describe('setSessionCookie', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('sets dashboard session cookie by default', async () => {
      await setSessionCookie('new-token')

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: DASHBOARD_SESSION_COOKIE_NAME,
          value: 'new-token',
        }),
      )
    })

    it('sets site session cookie when scope is site', async () => {
      await setSessionCookie('new-token', 'site')

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: SITE_SESSION_COOKIE_NAME,
          value: 'new-token',
        }),
      )
    })

    it('throws error for empty value', async () => {
      await expect(setSessionCookie('')).rejects.toThrow(
        'Session value must be a non-empty string.',
      )
    })
  })

  describe('clearSessionCookie', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('clears specific scope when provided', async () => {
      await clearSessionCookie('dashboard')

      expect(mockCookieStore.set).toHaveBeenCalledTimes(1)
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: DASHBOARD_SESSION_COOKIE_NAME,
          value: '',
          maxAge: 0,
        }),
      )
    })

    it('clears both scopes when no scope provided', async () => {
      await clearSessionCookie()

      expect(mockCookieStore.set).toHaveBeenCalledTimes(2)
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: DASHBOARD_SESSION_COOKIE_NAME,
          value: '',
          maxAge: 0,
        }),
      )
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: SITE_SESSION_COOKIE_NAME,
          value: '',
          maxAge: 0,
        }),
      )
    })

    it('sets expires to epoch when clearing', async () => {
      await clearSessionCookie('site')

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        expect.objectContaining({
          expires: new Date(0),
        }),
      )
    })
  })
})
