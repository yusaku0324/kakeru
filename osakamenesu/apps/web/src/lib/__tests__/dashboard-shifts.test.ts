import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dashboardClient - must use inline factory to avoid hoisting issues
vi.mock('@/lib/http-clients', () => ({
  dashboardClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import { dashboardClient } from '@/lib/http-clients'
import {
  fetchDashboardShifts,
  fetchDashboardShift,
  createDashboardShift,
  updateDashboardShift,
  deleteDashboardShift,
  type DashboardShift,
} from '../dashboard-shifts'

// Cast to mock type
const mockDashboardClient = dashboardClient as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

describe('dashboard-shifts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockShift: DashboardShift = {
    id: 'shift-1',
    therapist_id: 'therapist-1',
    shop_id: 'shop-1',
    date: '2024-12-27',
    start_at: '09:00',
    end_at: '18:00',
    break_slots: [],
    availability_status: 'available',
    notes: null,
    created_at: '2024-12-26T00:00:00Z',
    updated_at: '2024-12-26T00:00:00Z',
  }

  describe('fetchDashboardShifts', () => {
    it('fetches shifts successfully', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: true,
        data: [mockShift],
      })

      const result = await fetchDashboardShifts('profile-1')

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data).toEqual([mockShift])
      }
      expect(mockDashboardClient.get).toHaveBeenCalledWith('shops/profile-1/shifts', {
        cookieHeader: undefined,
        signal: undefined,
        cache: undefined,
      })
    })

    it('includes filter parameters in request path', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: true,
        data: [],
      })

      await fetchDashboardShifts('profile-1', {
        therapistId: 'therapist-1',
        dateFrom: '2024-12-01',
        dateTo: '2024-12-31',
      })

      expect(mockDashboardClient.get).toHaveBeenCalledWith(
        expect.stringContaining('therapist_id=therapist-1'),
        expect.any(Object),
      )
      expect(mockDashboardClient.get).toHaveBeenCalledWith(
        expect.stringContaining('date_from=2024-12-01'),
        expect.any(Object),
      )
      expect(mockDashboardClient.get).toHaveBeenCalledWith(
        expect.stringContaining('date_to=2024-12-31'),
        expect.any(Object),
      )
    })

    it('passes options correctly', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: true,
        data: [],
      })

      const controller = new AbortController()
      await fetchDashboardShifts('profile-1', undefined, {
        cookieHeader: 'session=abc123',
        signal: controller.signal,
        cache: 'no-store',
      })

      expect(mockDashboardClient.get).toHaveBeenCalledWith('shops/profile-1/shifts', {
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

      const result = await fetchDashboardShifts('profile-1')

      expect(result.status).toBe('unauthorized')
    })

    it('returns forbidden on 403', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: { detail: 'Access denied' },
      })

      const result = await fetchDashboardShifts('profile-1')

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

      const result = await fetchDashboardShifts('profile-1')

      expect(result.status).toBe('not_found')
    })

    it('returns error on other status codes', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 500,
        error: 'Server error',
      })

      const result = await fetchDashboardShifts('profile-1')

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

      const result = await fetchDashboardShifts('profile-1')

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toContain('シフト情報の取得に失敗しました')
      }
    })
  })

  describe('fetchDashboardShift', () => {
    it('fetches single shift successfully', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: true,
        data: mockShift,
      })

      const result = await fetchDashboardShift('profile-1', 'shift-1')

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data).toEqual(mockShift)
      }
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await fetchDashboardShift('profile-1', 'shift-1')

      expect(result.status).toBe('unauthorized')
    })

    it('returns not_found on 404', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await fetchDashboardShift('profile-1', 'shift-1')

      expect(result.status).toBe('not_found')
    })

    it('returns forbidden on 403', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: { detail: 'Access denied' },
      })

      const result = await fetchDashboardShift('profile-1', 'shift-1')

      expect(result.status).toBe('forbidden')
      if (result.status === 'forbidden') {
        expect(result.detail).toBe('Access denied')
      }
    })
  })

  describe('createDashboardShift', () => {
    const createPayload = {
      therapist_id: 'therapist-1',
      date: '2024-12-27',
      start_at: '09:00',
      end_at: '18:00',
    }

    const mockNewShift = {
      id: 'shift-new',
      ...createPayload,
      shop_id: 'shop-1',
      break_slots: [],
      availability_status: 'available',
      notes: null,
      created_at: '2024-12-27T00:00:00Z',
      updated_at: '2024-12-27T00:00:00Z',
    }

    it('creates shift successfully', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: true,
        data: mockNewShift,
      })

      const result = await createDashboardShift('profile-1', createPayload)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data.id).toBe('shift-new')
      }
      expect(mockDashboardClient.post).toHaveBeenCalledWith(
        'shops/profile-1/shifts',
        createPayload,
        {
          cookieHeader: undefined,
          signal: undefined,
          cache: undefined,
        },
      )
    })

    it('returns validation_error on 422', async () => {
      const validationErrors = { start_at: ['Invalid time format'] }
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 422,
        detail: validationErrors,
      })

      const result = await createDashboardShift('profile-1', createPayload)

      expect(result.status).toBe('validation_error')
      if (result.status === 'validation_error') {
        expect(result.detail).toEqual(validationErrors)
      }
    })

    it('returns conflict on 409', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 409,
        detail: { detail: 'Shift already exists' },
      })

      const result = await createDashboardShift('profile-1', createPayload)

      expect(result.status).toBe('conflict')
      if (result.status === 'conflict') {
        expect(result.detail).toBe('Shift already exists')
      }
    })

    it('returns forbidden on 403', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: { detail: 'No permission' },
      })

      const result = await createDashboardShift('profile-1', createPayload)

      expect(result.status).toBe('forbidden')
      if (result.status === 'forbidden') {
        expect(result.detail).toBe('No permission')
      }
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await createDashboardShift('profile-1', createPayload)

      expect(result.status).toBe('unauthorized')
    })

    it('returns not_found on 404', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await createDashboardShift('profile-1', createPayload)

      expect(result.status).toBe('not_found')
    })
  })

  describe('updateDashboardShift', () => {
    const updatePayload = {
      start_at: '10:00',
      end_at: '19:00',
    }

    const updatedShift = {
      ...mockShift,
      start_at: '10:00',
      end_at: '19:00',
      updated_at: '2024-12-27T01:00:00Z',
    }

    it('updates shift successfully', async () => {
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: true,
        data: updatedShift,
      })

      const result = await updateDashboardShift('profile-1', 'shift-1', updatePayload)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data.start_at).toBe('10:00')
      }
    })

    it('returns validation_error on 422', async () => {
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        detail: { end_at: ['Must be after start_at'] },
      })

      const result = await updateDashboardShift('profile-1', 'shift-1', updatePayload)

      expect(result.status).toBe('validation_error')
    })

    it('returns conflict on 409', async () => {
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        detail: { detail: 'Schedule conflict' },
      })

      const result = await updateDashboardShift('profile-1', 'shift-1', updatePayload)

      expect(result.status).toBe('conflict')
      if (result.status === 'conflict') {
        expect(result.detail).toBe('Schedule conflict')
      }
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await updateDashboardShift('profile-1', 'shift-1', updatePayload)

      expect(result.status).toBe('unauthorized')
    })

    it('returns not_found on 404', async () => {
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await updateDashboardShift('profile-1', 'shift-1', updatePayload)

      expect(result.status).toBe('not_found')
    })

    it('returns forbidden on 403', async () => {
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: { detail: 'No permission' },
      })

      const result = await updateDashboardShift('profile-1', 'shift-1', updatePayload)

      expect(result.status).toBe('forbidden')
      if (result.status === 'forbidden') {
        expect(result.detail).toBe('No permission')
      }
    })
  })

  describe('deleteDashboardShift', () => {
    it('deletes shift successfully', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: true,
        data: undefined,
      })

      const result = await deleteDashboardShift('profile-1', 'shift-1')

      expect(result.status).toBe('success')
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await deleteDashboardShift('profile-1', 'shift-1')

      expect(result.status).toBe('unauthorized')
    })

    it('returns not_found on 404', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await deleteDashboardShift('profile-1', 'shift-1')

      expect(result.status).toBe('not_found')
    })

    it('returns forbidden on 403', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: { detail: 'Cannot delete shift' },
      })

      const result = await deleteDashboardShift('profile-1', 'shift-1')

      expect(result.status).toBe('forbidden')
      if (result.status === 'forbidden') {
        expect(result.detail).toBe('Cannot delete shift')
      }
    })

    it('returns error on other status codes', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: false,
        status: 500,
        error: 'Server error',
      })

      const result = await deleteDashboardShift('profile-1', 'shift-1')

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toBe('Server error')
      }
    })

    it('returns default error message when error is not provided', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await deleteDashboardShift('profile-1', 'shift-1')

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toContain('シフトの削除に失敗しました')
      }
    })
  })
})
