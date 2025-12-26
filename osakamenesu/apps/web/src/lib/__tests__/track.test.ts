import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('track', () => {
  const originalWindow = global.window
  let mockGtag: ReturnType<typeof vi.fn>
  let mockMixpanel: { track: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    mockGtag = vi.fn()
    mockMixpanel = { track: vi.fn() }

    global.window = {
      gtag: mockGtag,
      mixpanel: mockMixpanel,
    } as unknown as Window & typeof globalThis
  })

  afterEach(() => {
    global.window = originalWindow
    vi.unstubAllEnvs()
  })

  describe('track', () => {
    it('logs to console in development', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { track } = await import('../track')
      track('test_event', { foo: 'bar' })

      expect(consoleSpy).toHaveBeenCalledWith('[track]', 'test_event', { foo: 'bar' })
      consoleSpy.mockRestore()
    })

    it('sends to Google Analytics in production when configured', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('NEXT_PUBLIC_GOOGLE_ANALYTICS_ID', 'GA-123')

      const { track } = await import('../track')
      track('test_event', { label: 'test', value: 42 })

      expect(mockGtag).toHaveBeenCalledWith('event', 'test_event', {
        event_category: 'engagement',
        event_label: 'test',
        value: 42,
        label: 'test',
      })
    })

    it('sends to Mixpanel in production when configured', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('NEXT_PUBLIC_MIXPANEL_TOKEN', 'mp-token')

      const { track } = await import('../track')
      track('test_event', { foo: 'bar' })

      expect(mockMixpanel.track).toHaveBeenCalledWith('test_event', { foo: 'bar' })
    })

    it('does not send analytics in development', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('NEXT_PUBLIC_GOOGLE_ANALYTICS_ID', 'GA-123')

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const { track } = await import('../track')
      track('test_event')

      expect(mockGtag).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('handles errors gracefully', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        throw new Error('Console error')
      })

      const { track } = await import('../track')
      // Should not throw
      expect(() => track('test_event')).not.toThrow()

      consoleLogSpy.mockRestore()
      consoleWarnSpy.mockRestore()
    })
  })

  describe('trackPageView', () => {
    it('tracks page_view event', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { trackPageView } = await import('../track')
      trackPageView('/search', { query: 'test' })

      expect(consoleSpy).toHaveBeenCalledWith('[track]', 'page_view', {
        page: '/search',
        query: 'test',
      })
      consoleSpy.mockRestore()
    })
  })

  describe('trackSearch', () => {
    it('tracks search event with query and results', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { trackSearch } = await import('../track')
      trackSearch('マッサージ', 10, { filters: { area: '大阪' } })

      expect(consoleSpy).toHaveBeenCalledWith('[track]', 'search', {
        query: 'マッサージ',
        results: 10,
        filters: { area: '大阪' },
      })
      consoleSpy.mockRestore()
    })
  })

  describe('trackReservation', () => {
    it('tracks reservation_created event', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { trackReservation } = await import('../track')
      trackReservation('therapist-1', 'shop-1', { course: 60 })

      expect(consoleSpy).toHaveBeenCalledWith('[track]', 'reservation_created', {
        therapistId: 'therapist-1',
        shopId: 'shop-1',
        course: 60,
      })
      consoleSpy.mockRestore()
    })
  })
})
