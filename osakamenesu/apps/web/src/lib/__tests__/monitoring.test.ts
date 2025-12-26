import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

// Mock fetch for Slack
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('monitoring', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    mockFetch.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('captureError', () => {
    it('logs to console in development', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { captureError } = await import('../monitoring')
      const error = new Error('Test error')
      captureError(error, { userId: '123' })

      expect(consoleSpy).toHaveBeenCalledWith('Captured error', error, { userId: '123' })
      consoleSpy.mockRestore()
    })

    it('sends Error to Sentry when configured', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('SENTRY_DSN', 'https://example@sentry.io/123')

      const { captureError } = await import('../monitoring')
      const error = new Error('Test error')
      captureError(error, { userId: '123' })

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        extra: { userId: '123' },
      })
    })

    it('sends string error to Sentry as message', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('SENTRY_DSN', 'https://example@sentry.io/123')

      const { captureError } = await import('../monitoring')
      captureError('String error', { userId: '123' })

      expect(Sentry.captureMessage).toHaveBeenCalledWith('String error', {
        level: 'error',
        extra: { userId: '123' },
      })
    })

    it('sends to Slack when webhook is configured', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('SLACK_ERROR_WEBHOOK_URL', 'https://hooks.slack.com/test')

      const { captureError } = await import('../monitoring')
      captureError(new Error('Test error'), { message: 'Custom message' })

      // Wait for async Slack call
      await new Promise((r) => setTimeout(r, 10))

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })

    it('does not send to Slack when webhook is not configured', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      // Don't set SLACK_ERROR_WEBHOOK_URL

      const { captureError } = await import('../monitoring')
      captureError(new Error('Test error'))

      await new Promise((r) => setTimeout(r, 10))

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('withErrorReporting', () => {
    it('returns result from successful handler', async () => {
      const { withErrorReporting } = await import('../monitoring')
      const handler = vi.fn().mockResolvedValue('success')
      const wrapped = withErrorReporting(handler, { operation: 'test' })

      const result = await wrapped('arg1', 'arg2')

      expect(result).toBe('success')
      expect(handler).toHaveBeenCalledWith('arg1', 'arg2')
    })

    it('captures and rethrows errors', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('SENTRY_DSN', 'https://example@sentry.io/123')

      const { withErrorReporting } = await import('../monitoring')
      const error = new Error('Handler failed')
      const handler = vi.fn().mockRejectedValue(error)
      const wrapped = withErrorReporting(handler, { operation: 'test' })

      await expect(wrapped()).rejects.toThrow('Handler failed')
      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        extra: { operation: 'test' },
      })
    })

    it('works with synchronous handlers', async () => {
      const { withErrorReporting } = await import('../monitoring')
      const handler = vi.fn().mockReturnValue('sync result')
      const wrapped = withErrorReporting(handler, { operation: 'sync' })

      const result = await wrapped()

      expect(result).toBe('sync result')
    })
  })
})
