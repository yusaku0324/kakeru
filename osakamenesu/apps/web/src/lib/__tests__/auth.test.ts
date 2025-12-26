import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock http-clients module
vi.mock('@/lib/http-clients', () => ({
  authClient: {
    post: vi.fn(),
  },
}))

import { authClient } from '@/lib/http-clients'
import { requestDashboardMagicLink, requestSiteMagicLink } from '../auth'

const mockPost = authClient.post as ReturnType<typeof vi.fn>

describe('auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('requestDashboardMagicLink', () => {
    it('returns success when mail is sent', async () => {
      mockPost.mockResolvedValue({
        ok: true,
        data: { mail_sent: true },
      })

      const result = await requestDashboardMagicLink('test@example.com')

      expect(result).toEqual({ status: 'success', mailSent: true })
      expect(mockPost).toHaveBeenCalledWith('request-link', {
        email: 'test@example.com',
        scope: 'dashboard',
      })
    })

    it('trims email before sending', async () => {
      mockPost.mockResolvedValue({
        ok: true,
        data: { mail_sent: true },
      })

      await requestDashboardMagicLink('  test@example.com  ')

      expect(mockPost).toHaveBeenCalledWith('request-link', {
        email: 'test@example.com',
        scope: 'dashboard',
      })
    })

    it('returns success with mailSent false when mail_sent is not true', async () => {
      mockPost.mockResolvedValue({
        ok: true,
        data: {},
      })

      const result = await requestDashboardMagicLink('test@example.com')

      expect(result).toEqual({ status: 'success', mailSent: false })
    })

    it('returns rate_limited on 429 status', async () => {
      mockPost.mockResolvedValue({
        ok: false,
        status: 429,
      })

      const result = await requestDashboardMagicLink('test@example.com')

      expect(result).toEqual({ status: 'rate_limited' })
    })

    it('returns error with API error message', async () => {
      mockPost.mockResolvedValue({
        ok: false,
        status: 400,
        error: 'Invalid email format',
      })

      const result = await requestDashboardMagicLink('invalid-email')

      expect(result).toEqual({
        status: 'error',
        message: 'Invalid email format',
      })
    })

    it('returns default error message when no error provided', async () => {
      mockPost.mockResolvedValue({
        ok: false,
        status: 500,
      })

      const result = await requestDashboardMagicLink('test@example.com')

      expect(result).toEqual({
        status: 'error',
        message: 'ログインリンクの送信に失敗しました。時間をおいて再度お試しください。',
      })
    })
  })

  describe('requestSiteMagicLink', () => {
    it('sends request with site scope', async () => {
      mockPost.mockResolvedValue({
        ok: true,
        data: { mail_sent: true },
      })

      const result = await requestSiteMagicLink('test@example.com')

      expect(result).toEqual({ status: 'success', mailSent: true })
      expect(mockPost).toHaveBeenCalledWith('request-link', {
        email: 'test@example.com',
        scope: 'site',
      })
    })

    it('handles rate limiting the same as dashboard', async () => {
      mockPost.mockResolvedValue({
        ok: false,
        status: 429,
      })

      const result = await requestSiteMagicLink('test@example.com')

      expect(result).toEqual({ status: 'rate_limited' })
    })
  })
})
