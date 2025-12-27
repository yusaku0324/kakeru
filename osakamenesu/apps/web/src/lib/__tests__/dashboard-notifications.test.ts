import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dashboardClient - must use inline factory to avoid hoisting issues
vi.mock('@/lib/http-clients', () => ({
  dashboardClient: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}))

import { dashboardClient } from '@/lib/http-clients'
import {
  fetchDashboardNotificationSettings,
  updateDashboardNotificationSettings,
  testDashboardNotificationSettings,
  type DashboardNotificationSettingsResponse,
} from '../dashboard-notifications'

// Cast to mock type
const mockDashboardClient = dashboardClient as unknown as {
  get: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

describe('dashboard-notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockSettings: DashboardNotificationSettingsResponse = {
    profile_id: 'profile-1',
    updated_at: '2024-12-26T00:00:00Z',
    trigger_status: ['pending', 'confirmed'],
    channels: {
      email: { enabled: true, recipients: ['test@example.com'] },
      line: { enabled: false, token: null },
      slack: { enabled: false, webhook_url: null },
    },
  }

  describe('fetchDashboardNotificationSettings', () => {
    it('fetches notification settings successfully', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: true,
        data: mockSettings,
      })

      const result = await fetchDashboardNotificationSettings('profile-1')

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data).toEqual(mockSettings)
      }
      expect(mockDashboardClient.get).toHaveBeenCalledWith('shops/profile-1/notifications', {
        cookieHeader: undefined,
        signal: undefined,
        cache: undefined,
      })
    })

    it('passes options correctly', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: true,
        data: mockSettings,
      })

      const controller = new AbortController()
      await fetchDashboardNotificationSettings('profile-1', {
        cookieHeader: 'session=abc123',
        signal: controller.signal,
        cache: 'no-store',
      })

      expect(mockDashboardClient.get).toHaveBeenCalledWith('shops/profile-1/notifications', {
        cookieHeader: 'session=abc123',
        signal: controller.signal,
        cache: 'no-store',
      })
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await fetchDashboardNotificationSettings('profile-1')

      expect(result.status).toBe('unauthorized')
    })

    it('returns forbidden with detail on 403', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: { detail: 'dashboard_access_not_configured' },
      })

      const result = await fetchDashboardNotificationSettings('profile-1')

      expect(result.status).toBe('forbidden')
      if (result.status === 'forbidden') {
        expect(result.detail).toBe('dashboard_access_not_configured')
      }
    })

    it('returns forbidden with default detail on 403 without detail', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: {},
      })

      const result = await fetchDashboardNotificationSettings('profile-1')

      expect(result.status).toBe('forbidden')
      if (result.status === 'forbidden') {
        expect(result.detail).toBe('dashboard_access_denied')
      }
    })

    it('returns not_found on 404', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await fetchDashboardNotificationSettings('profile-1')

      expect(result.status).toBe('not_found')
    })

    it('returns error on other status codes', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 500,
        error: 'Server error',
      })

      const result = await fetchDashboardNotificationSettings('profile-1')

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toBe('Server error')
      }
    })

    it('returns default error message when error is not provided', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await fetchDashboardNotificationSettings('profile-1')

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toContain('通知設定の取得に失敗しました')
      }
    })
  })

  describe('updateDashboardNotificationSettings', () => {
    const updatePayload = {
      updated_at: '2024-12-26T00:00:00Z',
      trigger_status: ['pending', 'confirmed'] as ('pending' | 'confirmed' | 'declined' | 'cancelled' | 'expired')[],
      channels: mockSettings.channels,
    }

    it('updates settings successfully', async () => {
      const updatedSettings = { ...mockSettings, updated_at: '2024-12-27T00:00:00Z' }
      mockDashboardClient.put.mockResolvedValueOnce({
        ok: true,
        data: updatedSettings,
      })

      const result = await updateDashboardNotificationSettings('profile-1', updatePayload)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data.updated_at).toBe('2024-12-27T00:00:00Z')
      }
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.put.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await updateDashboardNotificationSettings('profile-1', updatePayload)

      expect(result.status).toBe('unauthorized')
    })

    it('returns forbidden on 403', async () => {
      mockDashboardClient.put.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: { detail: 'dashboard_access_denied' },
      })

      const result = await updateDashboardNotificationSettings('profile-1', updatePayload)

      expect(result.status).toBe('forbidden')
    })

    it('returns not_found on 404', async () => {
      mockDashboardClient.put.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await updateDashboardNotificationSettings('profile-1', updatePayload)

      expect(result.status).toBe('not_found')
    })

    it('returns conflict with current data from detail on 409', async () => {
      const currentSettings = { ...mockSettings, updated_at: '2024-12-27T12:00:00Z' }
      mockDashboardClient.put.mockResolvedValueOnce({
        ok: false,
        status: 409,
        detail: { detail: { current: currentSettings } },
      })

      const result = await updateDashboardNotificationSettings('profile-1', updatePayload)

      expect(result.status).toBe('conflict')
      if (result.status === 'conflict') {
        expect(result.current.updated_at).toBe('2024-12-27T12:00:00Z')
      }
    })

    it('returns conflict by fetching fresh data on 409 without current', async () => {
      const freshSettings = { ...mockSettings, updated_at: '2024-12-27T14:00:00Z' }
      mockDashboardClient.put.mockResolvedValueOnce({
        ok: false,
        status: 409,
        detail: {},
      })
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: true,
        data: freshSettings,
      })

      const result = await updateDashboardNotificationSettings('profile-1', updatePayload)

      expect(result.status).toBe('conflict')
      if (result.status === 'conflict') {
        expect(result.current.updated_at).toBe('2024-12-27T14:00:00Z')
      }
    })

    it('returns conflict with fallback on 409 when fetch fails', async () => {
      mockDashboardClient.put.mockResolvedValueOnce({
        ok: false,
        status: 409,
        detail: {},
      })
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await updateDashboardNotificationSettings('profile-1', updatePayload)

      expect(result.status).toBe('conflict')
      if (result.status === 'conflict') {
        // Fallback uses payload data when fetch fails and no data available
        expect(result.current.profile_id).toBe('profile-1')
        expect(result.current.trigger_status).toEqual(updatePayload.trigger_status)
      }
    })

    it('returns validation_error on 422', async () => {
      const validationErrors = { trigger_status: ['Invalid status'] }
      mockDashboardClient.put.mockResolvedValueOnce({
        ok: false,
        status: 422,
        detail: validationErrors,
      })

      const result = await updateDashboardNotificationSettings('profile-1', updatePayload)

      expect(result.status).toBe('validation_error')
      if (result.status === 'validation_error') {
        expect(result.detail).toEqual(validationErrors)
      }
    })

    it('returns error on unexpected status', async () => {
      mockDashboardClient.put.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await updateDashboardNotificationSettings('profile-1', updatePayload)

      expect(result.status).toBe('error')
    })
  })

  describe('testDashboardNotificationSettings', () => {
    const testPayload = {
      trigger_status: ['pending'] as ('pending' | 'confirmed' | 'declined' | 'cancelled' | 'expired')[],
      channels: mockSettings.channels,
    }

    it('sends test notification successfully', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: true,
        data: undefined,
      })

      const result = await testDashboardNotificationSettings('profile-1', testPayload)

      expect(result.status).toBe('success')
      expect(mockDashboardClient.post).toHaveBeenCalledWith(
        'shops/profile-1/notifications/test',
        testPayload,
        {
          cookieHeader: undefined,
          signal: undefined,
          cache: undefined,
        },
      )
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await testDashboardNotificationSettings('profile-1', testPayload)

      expect(result.status).toBe('unauthorized')
    })

    it('returns forbidden on 403', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: { detail: 'dashboard_access_denied' },
      })

      const result = await testDashboardNotificationSettings('profile-1', testPayload)

      expect(result.status).toBe('forbidden')
    })

    it('returns not_found on 404', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await testDashboardNotificationSettings('profile-1', testPayload)

      expect(result.status).toBe('not_found')
    })

    it('returns validation_error on 422', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 422,
        detail: { channels: ['At least one channel required'] },
      })

      const result = await testDashboardNotificationSettings('profile-1', testPayload)

      expect(result.status).toBe('validation_error')
    })

    it('returns error on unexpected status', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 500,
        error: 'Server error',
      })

      const result = await testDashboardNotificationSettings('profile-1', testPayload)

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toBe('Server error')
      }
    })

    it('returns default error message when error is not provided', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await testDashboardNotificationSettings('profile-1', testPayload)

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toContain('テスト通知のリクエストに失敗しました')
      }
    })
  })
})
