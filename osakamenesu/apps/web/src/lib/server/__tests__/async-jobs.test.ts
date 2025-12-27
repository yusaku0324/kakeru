import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock dependencies
vi.mock('@/lib/api', () => ({
  buildApiUrl: (base: string, path: string) => `${base}${path}`,
  resolveApiBases: () => ['http://internal-api:8000', '/api'],
}))

// Store the original fetch
const originalFetch = global.fetch

const validPayload = {
  type: 'reservation_notification' as const,
  notification: {
    reservation_id: 'res-123',
    shop_id: 'shop-1',
    shop_name: 'Test Shop',
    customer_name: 'Test Customer',
    customer_phone: '090-1234-5678',
    desired_start: '2024-12-27T10:00:00',
    desired_end: '2024-12-27T11:00:00',
    status: 'confirmed',
  },
}

describe('server/async-jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('enqueueAsyncJobServer', () => {
    it('enqueues job successfully on first base', async () => {
      const mockResponse = { job_id: '123' }
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const { enqueueAsyncJobServer } = await import('../async-jobs')

      const result = await enqueueAsyncJobServer(validPayload)

      expect(result).toEqual(mockResponse)
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://internal-api:8000/api/async/jobs',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        }),
      )
    })

    it('tries next base when first fails', async () => {
      const mockResponse = { job_id: '456' }
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })

      const { enqueueAsyncJobServer } = await import('../async-jobs')

      const result = await enqueueAsyncJobServer(validPayload)

      expect(result).toEqual(mockResponse)
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('handles JSON response when request fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Bad request' }),
      })

      const { enqueueAsyncJobServer } = await import('../async-jobs')

      await expect(enqueueAsyncJobServer(validPayload)).rejects.toThrow()
    })

    it('handles text response when JSON parsing fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
        text: () => Promise.resolve('Internal Server Error'),
      })

      const { enqueueAsyncJobServer } = await import('../async-jobs')

      await expect(enqueueAsyncJobServer(validPayload)).rejects.toThrow(
        'Internal Server Error',
      )
    })

    it('handles empty response on success', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('No content')),
      })

      const { enqueueAsyncJobServer } = await import('../async-jobs')

      const result = await enqueueAsyncJobServer(validPayload)

      expect(result).toEqual({})
    })

    it('throws default message when all fails with no details', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve(null),
        text: () => Promise.resolve(''),
      })

      const { enqueueAsyncJobServer } = await import('../async-jobs')

      await expect(enqueueAsyncJobServer(validPayload)).rejects.toThrow(
        'async job enqueue failed',
      )
    })

    it('throws with stringified JSON error detail', async () => {
      const errorDetail = { code: 'ERR_001', message: 'Validation failed' }
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve(errorDetail),
      })

      const { enqueueAsyncJobServer } = await import('../async-jobs')

      await expect(enqueueAsyncJobServer(validPayload)).rejects.toThrow(
        JSON.stringify(errorDetail),
      )
    })
  })
})
