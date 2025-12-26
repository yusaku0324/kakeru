import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock dependencies
vi.mock('@/lib/csrf', () => ({
  CSRF_HEADER_NAME: 'X-CSRF-Token',
  isCsrfProtectedMethod: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/http', () => ({
  getBrowserCsrfToken: vi.fn().mockReturnValue('test-csrf-token'),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('async-jobs', () => {
  const originalWindow = global.window

  beforeEach(() => {
    vi.clearAllMocks()
    global.window = {} as Window & typeof globalThis
  })

  afterEach(() => {
    global.window = originalWindow
  })

  describe('enqueueAsyncJob', () => {
    it('sends POST request with correct headers', async () => {
      mockFetch.mockResolvedValue({ ok: true })

      const { enqueueAsyncJob } = await import('../async-jobs')
      await enqueueAsyncJob({
        type: 'reservation_notification',
        notification: {
          reservation_id: 'res-1',
          shop_id: 'shop-1',
          shop_name: 'Test Shop',
          customer_name: 'Test Customer',
          customer_phone: '090-1234-5678',
          desired_start: '2024-12-17T14:00:00+09:00',
          desired_end: '2024-12-17T15:00:00+09:00',
          status: 'confirmed',
        },
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/async/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'test-csrf-token',
        },
        body: expect.any(String),
        credentials: 'include',
      })
    })

    it('includes schedule_at in payload', async () => {
      mockFetch.mockResolvedValue({ ok: true })

      const { enqueueAsyncJob } = await import('../async-jobs')
      await enqueueAsyncJob({
        type: 'reservation_reminder',
        schedule_at: '2024-12-17T13:00:00+09:00',
        notification: {
          reservation_id: 'res-1',
          shop_id: 'shop-1',
          shop_name: 'Test Shop',
          customer_name: 'Test Customer',
          customer_phone: '090-1234-5678',
          desired_start: '2024-12-17T14:00:00+09:00',
          desired_end: '2024-12-17T15:00:00+09:00',
          status: 'confirmed',
          reminder_at: '2024-12-17T13:00:00+09:00',
        },
      })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.schedule_at).toBe('2024-12-17T13:00:00+09:00')
    })

    it('throws error on failed response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: async () => 'Job queue full',
      })

      const { enqueueAsyncJob } = await import('../async-jobs')

      await expect(
        enqueueAsyncJob({
          type: 'reservation_cancellation',
          notification: {
            reservation_id: 'res-1',
            shop_id: 'shop-1',
            shop_name: 'Test Shop',
            customer_name: 'Test Customer',
            customer_phone: '090-1234-5678',
            desired_start: '2024-12-17T14:00:00+09:00',
            desired_end: '2024-12-17T15:00:00+09:00',
            status: 'cancelled',
          },
        }),
      ).rejects.toThrow('Job queue full')
    })

    it('throws default error message when no detail', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: async () => '',
      })

      const { enqueueAsyncJob } = await import('../async-jobs')

      await expect(
        enqueueAsyncJob({
          type: 'reservation_notification',
          notification: {
            reservation_id: 'res-1',
            shop_id: 'shop-1',
            shop_name: 'Test Shop',
            customer_name: 'Test Customer',
            customer_phone: '090-1234-5678',
            desired_start: '2024-12-17T14:00:00+09:00',
            desired_end: '2024-12-17T15:00:00+09:00',
            status: 'confirmed',
          },
        }),
      ).rejects.toThrow('Failed to enqueue async job')
    })

    it('returns response on success', async () => {
      const mockResponse = { ok: true, status: 201 }
      mockFetch.mockResolvedValue(mockResponse)

      const { enqueueAsyncJob } = await import('../async-jobs')
      const result = await enqueueAsyncJob({
        type: 'reservation_notification',
        notification: {
          reservation_id: 'res-1',
          shop_id: 'shop-1',
          shop_name: 'Test Shop',
          customer_name: 'Test Customer',
          customer_phone: '090-1234-5678',
          desired_start: '2024-12-17T14:00:00+09:00',
          desired_end: '2024-12-17T15:00:00+09:00',
          status: 'confirmed',
        },
      })

      expect(result).toBe(mockResponse)
    })
  })
})
