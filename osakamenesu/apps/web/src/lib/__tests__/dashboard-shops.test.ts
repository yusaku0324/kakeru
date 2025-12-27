import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dashboardClient
vi.mock('@/lib/http-clients', () => ({
  dashboardClient: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('@/lib/api', () => ({
  buildApiUrl: (base: string, path: string) => `${base}/${path}`,
  resolveApiBases: () => ['http://internal-api:8000'],
}))

import { dashboardClient } from '@/lib/http-clients'
import {
  fetchDashboardShopProfile,
  updateDashboardShopProfile,
  createDashboardShopProfile,
  uploadDashboardShopPhoto,
  type DashboardShopProfile,
} from '../dashboard-shops'

const mockDashboardClient = dashboardClient as unknown as {
  get: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

describe('dashboard-shops', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockProfile: DashboardShopProfile = {
    id: 'shop-1',
    name: 'Test Shop',
    area: 'Tokyo',
    price_min: 5000,
    price_max: 10000,
    service_type: 'store',
    service_tags: ['massage'],
    photos: [],
    contact: null,
    menus: [],
    staff: [],
  }

  describe('fetchDashboardShopProfile', () => {
    it('fetches shop profile successfully', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: true,
        data: mockProfile,
      })

      const result = await fetchDashboardShopProfile('shop-1')

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data.name).toBe('Test Shop')
      }
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await fetchDashboardShopProfile('shop-1')

      expect(result.status).toBe('unauthorized')
    })

    it('returns forbidden on 403', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: 'dashboard_access_denied',
      })

      const result = await fetchDashboardShopProfile('shop-1')

      expect(result.status).toBe('forbidden')
    })

    it('returns not_found on 404', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await fetchDashboardShopProfile('shop-1')

      expect(result.status).toBe('not_found')
    })

    it('returns error on other status', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 500,
        error: 'Server error',
      })

      const result = await fetchDashboardShopProfile('shop-1')

      expect(result.status).toBe('error')
    })

    it('passes options to client', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: true,
        data: mockProfile,
      })

      const controller = new AbortController()
      await fetchDashboardShopProfile('shop-1', {
        cookieHeader: 'session=abc',
        signal: controller.signal,
        cache: 'no-store',
      })

      expect(mockDashboardClient.get).toHaveBeenCalledWith('shops/shop-1/profile', {
        cookieHeader: 'session=abc',
        signal: controller.signal,
        cache: 'no-store',
      })
    })
  })

  describe('updateDashboardShopProfile', () => {
    const updatePayload = {
      name: 'Updated Shop',
      updated_at: '2024-12-26T00:00:00Z',
    }

    it('updates shop profile successfully', async () => {
      const updatedProfile = { ...mockProfile, name: 'Updated Shop' }
      mockDashboardClient.put.mockResolvedValueOnce({
        ok: true,
        data: updatedProfile,
      })

      const result = await updateDashboardShopProfile('shop-1', updatePayload)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data.name).toBe('Updated Shop')
      }
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.put.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await updateDashboardShopProfile('shop-1', updatePayload)

      expect(result.status).toBe('unauthorized')
    })

    it('returns forbidden on 403', async () => {
      mockDashboardClient.put.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: 'No permission',
      })

      const result = await updateDashboardShopProfile('shop-1', updatePayload)

      expect(result.status).toBe('forbidden')
    })

    it('returns not_found on 404', async () => {
      mockDashboardClient.put.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await updateDashboardShopProfile('shop-1', updatePayload)

      expect(result.status).toBe('not_found')
    })

    it('returns conflict on 409', async () => {
      mockDashboardClient.put.mockResolvedValueOnce({
        ok: false,
        status: 409,
        detail: { detail: { current: mockProfile } },
      })

      const result = await updateDashboardShopProfile('shop-1', updatePayload)

      expect(result.status).toBe('conflict')
      if (result.status === 'conflict') {
        expect(result.current.id).toBe('shop-1')
      }
    })

    it('returns validation_error on 422', async () => {
      mockDashboardClient.put.mockResolvedValueOnce({
        ok: false,
        status: 422,
        detail: { name: ['Too long'] },
      })

      const result = await updateDashboardShopProfile('shop-1', updatePayload)

      expect(result.status).toBe('validation_error')
    })

    it('returns error on other status', async () => {
      mockDashboardClient.put.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await updateDashboardShopProfile('shop-1', updatePayload)

      expect(result.status).toBe('error')
    })

    it('returns conflict with fallback when detail.current is missing and fetch fails', async () => {
      mockDashboardClient.put.mockResolvedValueOnce({
        ok: false,
        status: 409,
        detail: {},
      })
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await updateDashboardShopProfile('shop-1', updatePayload)

      expect(result.status).toBe('conflict')
      if (result.status === 'conflict') {
        expect(result.current.id).toBe('shop-1')
        expect(result.current.name).toBe('Updated Shop')
      }
    })
  })

  describe('createDashboardShopProfile', () => {
    const createPayload = {
      name: 'New Shop',
      area: 'Osaka',
      price_min: 3000,
      price_max: 8000,
    }

    it('creates shop profile successfully', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: true,
        status: 201,
        data: { ...mockProfile, name: 'New Shop' },
      })

      const result = await createDashboardShopProfile(createPayload)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data.name).toBe('New Shop')
      }
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await createDashboardShopProfile(createPayload)

      expect(result.status).toBe('unauthorized')
    })

    it('returns forbidden on 403', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: { detail: 'No permission' },
      })

      const result = await createDashboardShopProfile(createPayload)

      expect(result.status).toBe('forbidden')
    })

    it('returns validation_error on 422', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 422,
        detail: { detail: { name: ['Too long'] } },
      })

      const result = await createDashboardShopProfile(createPayload)

      expect(result.status).toBe('validation_error')
    })

    it('returns error on unexpected success status', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: mockProfile,
      })

      const result = await createDashboardShopProfile(createPayload)

      expect(result.status).toBe('error')
    })

    it('returns error on other status', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await createDashboardShopProfile(createPayload)

      expect(result.status).toBe('error')
    })
  })

  describe('uploadDashboardShopPhoto', () => {
    const originalFetch = global.fetch

    beforeEach(() => {
      vi.clearAllMocks()
    })

    afterEach(() => {
      global.fetch = originalFetch
    })

    const createTestFile = () => new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    it('uploads photo successfully', async () => {
      const mockUploadResponse = {
        url: 'https://cdn.example.com/photo.jpg',
        filename: 'photo.jpg',
        content_type: 'image/jpeg',
        size: 1024,
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 201,
        json: () => Promise.resolve(mockUploadResponse),
      })

      const result = await uploadDashboardShopPhoto('shop-1', createTestFile())

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data.url).toBe('https://cdn.example.com/photo.jpg')
      }
    })

    it('returns unauthorized on 401', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 401,
      })

      const result = await uploadDashboardShopPhoto('shop-1', createTestFile())

      expect(result.status).toBe('unauthorized')
    })

    it('returns forbidden on 403', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 403,
        json: () => Promise.resolve({ detail: 'No permission' }),
      })

      const result = await uploadDashboardShopPhoto('shop-1', createTestFile())

      expect(result.status).toBe('forbidden')
    })

    it('returns not_found on 404', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 404,
      })

      const result = await uploadDashboardShopPhoto('shop-1', createTestFile())

      expect(result.status).toBe('not_found')
    })

    it('returns too_large on 413', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 413,
        json: () => Promise.resolve({ limit_bytes: 5242880 }),
      })

      const result = await uploadDashboardShopPhoto('shop-1', createTestFile())

      expect(result.status).toBe('too_large')
      if (result.status === 'too_large') {
        expect(result.limitBytes).toBe(5242880)
      }
    })

    it('returns unsupported_media_type on 415', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 415,
        json: () => Promise.resolve({ message: 'Only JPEG and PNG allowed' }),
      })

      const result = await uploadDashboardShopPhoto('shop-1', createTestFile())

      expect(result.status).toBe('unsupported_media_type')
    })

    it('returns validation_error on 422', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 422,
        json: () => Promise.resolve({ message: 'File required' }),
      })

      const result = await uploadDashboardShopPhoto('shop-1', createTestFile())

      expect(result.status).toBe('validation_error')
    })

    it('returns error on network failure', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

      const result = await uploadDashboardShopPhoto('shop-1', createTestFile())

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toContain('写真のアップロードに失敗しました')
      }
    })

    it('returns error when all bases fail', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 500,
      })

      const result = await uploadDashboardShopPhoto('shop-1', createTestFile())

      expect(result.status).toBe('error')
    })
  })
})
