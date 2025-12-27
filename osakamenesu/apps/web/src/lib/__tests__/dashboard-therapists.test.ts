import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dashboardClient - must use inline factory to avoid hoisting issues
vi.mock('@/lib/http-clients', () => ({
  dashboardClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    uploadFormData: vi.fn(),
  },
}))

import { dashboardClient } from '@/lib/http-clients'
import {
  fetchDashboardTherapists,
  fetchDashboardTherapist,
  createDashboardTherapist,
  updateDashboardTherapist,
  deleteDashboardTherapist,
  reorderDashboardTherapists,
  uploadDashboardTherapistPhoto,
  summarizeTherapist,
  type DashboardTherapistDetail,
} from '../dashboard-therapists'

// Cast to mock type
const mockDashboardClient = dashboardClient as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  uploadFormData: ReturnType<typeof vi.fn>
}

describe('dashboard-therapists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockTherapist: DashboardTherapistDetail = {
    id: 'therapist-1',
    name: 'Test Therapist',
    alias: 'Alias',
    headline: 'Expert therapist',
    status: 'published',
    display_order: 1,
    is_booking_enabled: true,
    updated_at: '2024-12-26T00:00:00Z',
    photo_urls: ['https://example.com/photo.jpg'],
    specialties: ['massage', 'relaxation'],
    biography: 'Experienced therapist',
    qualifications: ['Licensed'],
    experience_years: 5,
    created_at: '2024-01-01T00:00:00Z',
  }

  describe('summarizeTherapist', () => {
    it('converts detail to summary', () => {
      const summary = summarizeTherapist(mockTherapist)

      expect(summary.id).toBe('therapist-1')
      expect(summary.name).toBe('Test Therapist')
      expect(summary.photo_urls).toEqual(['https://example.com/photo.jpg'])
      expect(summary.specialties).toEqual(['massage', 'relaxation'])
      // Should not include detail fields
      expect((summary as unknown as Record<string, unknown>).biography).toBeUndefined()
    })
  })

  describe('fetchDashboardTherapists', () => {
    it('fetches therapists successfully', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: true,
        data: [mockTherapist],
      })

      const result = await fetchDashboardTherapists('profile-1')

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data).toHaveLength(1)
      }
      expect(mockDashboardClient.get).toHaveBeenCalledWith('shops/profile-1/therapists', {
        cookieHeader: undefined,
        signal: undefined,
        cache: undefined,
      })
    })

    it('passes options correctly', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: true,
        data: [],
      })

      const controller = new AbortController()
      await fetchDashboardTherapists('profile-1', {
        cookieHeader: 'session=test123',
        signal: controller.signal,
        cache: 'no-store',
      })

      expect(mockDashboardClient.get).toHaveBeenCalledWith('shops/profile-1/therapists', {
        cookieHeader: 'session=test123',
        signal: controller.signal,
        cache: 'no-store',
      })
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await fetchDashboardTherapists('profile-1')

      expect(result.status).toBe('unauthorized')
    })

    it('returns forbidden on 403', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: { detail: 'Access denied' },
      })

      const result = await fetchDashboardTherapists('profile-1')

      expect(result.status).toBe('forbidden')
      if (result.status === 'forbidden') {
        expect(result.detail).toBe('Access denied')
      }
    })

    it('returns not_found on 404', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await fetchDashboardTherapists('profile-1')

      expect(result.status).toBe('not_found')
    })

    it('returns error on other status codes', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 500,
        error: 'Server error',
      })

      const result = await fetchDashboardTherapists('profile-1')

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toBe('Server error')
      }
    })
  })

  describe('fetchDashboardTherapist', () => {
    it('fetches single therapist successfully', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: true,
        data: mockTherapist,
      })

      const result = await fetchDashboardTherapist('profile-1', 'therapist-1')

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data.id).toBe('therapist-1')
      }
    })

    it('returns not_found on 404', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await fetchDashboardTherapist('profile-1', 'invalid-id')

      expect(result.status).toBe('not_found')
    })
  })

  describe('createDashboardTherapist', () => {
    const createPayload = { name: 'New Therapist' }

    it('creates therapist successfully', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: true,
        data: { ...mockTherapist, name: 'New Therapist' },
      })

      const result = await createDashboardTherapist('profile-1', createPayload)

      expect(result.status).toBe('success')
      expect(mockDashboardClient.post).toHaveBeenCalledWith(
        'shops/profile-1/therapists',
        createPayload,
        {
          cookieHeader: undefined,
          signal: undefined,
          cache: undefined,
        },
      )
    })

    it('returns validation_error on 422', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 422,
        detail: { name: ['Required'] },
      })

      const result = await createDashboardTherapist('profile-1', { name: '' })

      expect(result.status).toBe('validation_error')
      if (result.status === 'validation_error') {
        expect(result.detail).toEqual({ name: ['Required'] })
      }
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await createDashboardTherapist('profile-1', createPayload)

      expect(result.status).toBe('unauthorized')
    })

    it('returns forbidden on 403', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: { detail: 'No permission' },
      })

      const result = await createDashboardTherapist('profile-1', createPayload)

      expect(result.status).toBe('forbidden')
      if (result.status === 'forbidden') {
        expect(result.detail).toBe('No permission')
      }
    })
  })

  describe('updateDashboardTherapist', () => {
    const updatePayload = {
      updated_at: '2024-12-26T00:00:00Z',
      name: 'Updated Name',
    }

    it('updates therapist successfully', async () => {
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: true,
        data: { ...mockTherapist, name: 'Updated Name' },
      })

      const result = await updateDashboardTherapist('profile-1', 'therapist-1', updatePayload)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data.name).toBe('Updated Name')
      }
    })

    it('returns conflict on 409 with direct current data', async () => {
      const currentTherapist = { ...mockTherapist, updated_at: '2024-12-27T00:00:00Z' }
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        detail: currentTherapist,
      })

      const result = await updateDashboardTherapist('profile-1', 'therapist-1', updatePayload)

      expect(result.status).toBe('conflict')
      if (result.status === 'conflict') {
        expect(result.current.updated_at).toBe('2024-12-27T00:00:00Z')
      }
    })

    it('returns conflict on 409 with nested current data', async () => {
      const currentTherapist = { ...mockTherapist, updated_at: '2024-12-27T00:00:00Z' }
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        detail: { detail: { current: currentTherapist } },
      })

      const result = await updateDashboardTherapist('profile-1', 'therapist-1', updatePayload)

      expect(result.status).toBe('conflict')
      if (result.status === 'conflict') {
        expect(result.current.updated_at).toBe('2024-12-27T00:00:00Z')
      }
    })

    it('returns conflict by fetching fresh data on 409 without current', async () => {
      const freshTherapist = { ...mockTherapist, updated_at: '2024-12-27T14:00:00Z' }
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        detail: {},
      })
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: true,
        data: freshTherapist,
      })

      const result = await updateDashboardTherapist('profile-1', 'therapist-1', updatePayload)

      expect(result.status).toBe('conflict')
      if (result.status === 'conflict') {
        expect(result.current.updated_at).toBe('2024-12-27T14:00:00Z')
      }
    })

    it('returns validation_error on 422', async () => {
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        detail: { name: ['Too long'] },
      })

      const result = await updateDashboardTherapist('profile-1', 'therapist-1', updatePayload)

      expect(result.status).toBe('validation_error')
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await updateDashboardTherapist('profile-1', 'therapist-1', updatePayload)

      expect(result.status).toBe('unauthorized')
    })

    it('returns not_found on 404', async () => {
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await updateDashboardTherapist('profile-1', 'therapist-1', updatePayload)

      expect(result.status).toBe('not_found')
    })
  })

  describe('deleteDashboardTherapist', () => {
    it('deletes therapist successfully', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: true,
        data: undefined,
      })

      const result = await deleteDashboardTherapist('profile-1', 'therapist-1')

      expect(result.status).toBe('success')
    })

    it('returns not_found on 404', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await deleteDashboardTherapist('profile-1', 'invalid-id')

      expect(result.status).toBe('not_found')
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await deleteDashboardTherapist('profile-1', 'therapist-1')

      expect(result.status).toBe('unauthorized')
    })

    it('returns forbidden on 403', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: { detail: 'Cannot delete' },
      })

      const result = await deleteDashboardTherapist('profile-1', 'therapist-1')

      expect(result.status).toBe('forbidden')
      if (result.status === 'forbidden') {
        expect(result.detail).toBe('Cannot delete')
      }
    })
  })

  describe('reorderDashboardTherapists', () => {
    const reorderPayload = {
      items: [
        { therapist_id: 'therapist-1', display_order: 1 },
        { therapist_id: 'therapist-2', display_order: 2 },
      ],
    }

    it('reorders therapists successfully', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: true,
        data: [mockTherapist],
      })

      const result = await reorderDashboardTherapists('profile-1', reorderPayload)

      expect(result.status).toBe('success')
      expect(mockDashboardClient.post).toHaveBeenCalledWith(
        'shops/profile-1/therapists:reorder',
        reorderPayload,
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

      const result = await reorderDashboardTherapists('profile-1', reorderPayload)

      expect(result.status).toBe('unauthorized')
    })

    it('returns error on other status codes', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await reorderDashboardTherapists('profile-1', reorderPayload)

      expect(result.status).toBe('error')
    })
  })

  describe('uploadDashboardTherapistPhoto', () => {
    const createTestFile = () => new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    const mockUploadResponse = {
      url: 'https://cdn.example.com/photo.jpg',
      filename: 'photo.jpg',
      content_type: 'image/jpeg',
      size: 1024,
    }

    it('uploads photo successfully', async () => {
      mockDashboardClient.uploadFormData.mockResolvedValueOnce({
        ok: true,
        data: mockUploadResponse,
      })

      const result = await uploadDashboardTherapistPhoto('profile-1', createTestFile())

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data.url).toBe('https://cdn.example.com/photo.jpg')
      }
    })

    it('returns too_large on 413', async () => {
      mockDashboardClient.uploadFormData.mockResolvedValueOnce({
        ok: false,
        status: 413,
        detail: { limit_bytes: 5242880 },
      })

      const result = await uploadDashboardTherapistPhoto('profile-1', createTestFile())

      expect(result.status).toBe('too_large')
      if (result.status === 'too_large') {
        expect(result.limitBytes).toBe(5242880)
      }
    })

    it('returns unsupported_media_type on 415', async () => {
      mockDashboardClient.uploadFormData.mockResolvedValueOnce({
        ok: false,
        status: 415,
        detail: { detail: 'Only JPEG and PNG allowed' },
      })

      const result = await uploadDashboardTherapistPhoto('profile-1', createTestFile())

      expect(result.status).toBe('unsupported_media_type')
      if (result.status === 'unsupported_media_type') {
        expect(result.message).toBe('Only JPEG and PNG allowed')
      }
    })

    it('returns validation_error on 422', async () => {
      mockDashboardClient.uploadFormData.mockResolvedValueOnce({
        ok: false,
        status: 422,
        detail: { message: 'File required' },
      })

      const result = await uploadDashboardTherapistPhoto('profile-1', createTestFile())

      expect(result.status).toBe('validation_error')
      if (result.status === 'validation_error') {
        expect(result.message).toBe('File required')
      }
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.uploadFormData.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await uploadDashboardTherapistPhoto('profile-1', createTestFile())

      expect(result.status).toBe('unauthorized')
    })

    it('returns forbidden on 403', async () => {
      mockDashboardClient.uploadFormData.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: { detail: 'No upload permission' },
      })

      const result = await uploadDashboardTherapistPhoto('profile-1', createTestFile())

      expect(result.status).toBe('forbidden')
      if (result.status === 'forbidden') {
        expect(result.detail).toBe('No upload permission')
      }
    })

    it('returns not_found on 404', async () => {
      mockDashboardClient.uploadFormData.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await uploadDashboardTherapistPhoto('profile-1', createTestFile())

      expect(result.status).toBe('not_found')
    })

    it('returns error on other status codes', async () => {
      mockDashboardClient.uploadFormData.mockResolvedValueOnce({
        ok: false,
        status: 500,
        error: 'Server error',
      })

      const result = await uploadDashboardTherapistPhoto('profile-1', createTestFile())

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toBe('Server error')
      }
    })
  })
})
