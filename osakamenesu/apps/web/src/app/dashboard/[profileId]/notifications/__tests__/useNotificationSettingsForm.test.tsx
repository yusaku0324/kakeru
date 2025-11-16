import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DashboardNotificationSettingsResponse } from '@/lib/dashboard-notifications'
import { useNotificationSettingsForm } from '../useNotificationSettingsForm'

const { updateMock, testMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  testMock: vi.fn(),
}))

vi.mock('@/lib/dashboard-notifications', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dashboard-notifications')>('@/lib/dashboard-notifications')
  return {
    ...actual,
    updateDashboardNotificationSettings: updateMock,
    testDashboardNotificationSettings: testMock,
  }
})

const INITIAL_DATA: DashboardNotificationSettingsResponse = {
  profile_id: 'profile-1',
  updated_at: '2025-01-01T00:00:00Z',
  trigger_status: ['pending', 'confirmed'],
  channels: {
    email: { enabled: false, recipients: [] },
    line: { enabled: false, token: null, webhook_url: null },
    slack: { enabled: false, webhook_url: null },
  },
}

describe('useNotificationSettingsForm', () => {
  beforeEach(() => {
    updateMock.mockReset()
    testMock.mockReset()
  })

  it('maps server side validation errors to field state and message', async () => {
    updateMock.mockResolvedValue({
      status: 'validation_error',
      detail: {
        detail: [
          { field: 'line', message: 'トークンを入力してください。' },
          { field: 'line_webhook', message: 'Webhook URL を確認してください。' },
        ],
      },
    })

    const { result } = renderHook(() => useNotificationSettingsForm('profile-1', INITIAL_DATA))

    act(() => {
      result.current.toggleChannel('line')
      result.current.setLineTokenInput('x'.repeat(48))
      result.current.setLineWebhookInput('https://example.com/line/hook')
    })

    await act(async () => {
      await result.current.handleSubmit()
    })

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(result.current.fieldErrors.line).toBe('トークンを入力してください。')
      expect(result.current.fieldErrors.lineWebhook).toBe('Webhook URL を確認してください。')
      expect(result.current.message.type).toBe('error')
    })

    act(() => {
      result.current.setLineWebhookInput('https://example.com/line/new-hook')
    })

    expect(result.current.fieldErrors.lineWebhook).toBeUndefined()
  })
})
