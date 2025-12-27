import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock apiFetch
const mockApiFetch = vi.fn()
vi.mock('@/lib/http', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}))

import {
  fetchDashboardReservations,
  updateDashboardReservation,
  type DashboardReservationListResponse,
  type DashboardReservationItem,
} from '../dashboard-reservations'

describe('dashboard-reservations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchDashboardReservations', () => {
    const mockResponse: DashboardReservationListResponse = {
      profile_id: 'profile-1',
      total: 2,
      reservations: [
        {
          id: 'res-1',
          status: 'confirmed',
          desired_start: '2024-12-27T10:00:00',
          desired_end: '2024-12-27T11:00:00',
          customer_name: 'Test User',
          customer_phone: '090-1234-5678',
          created_at: '2024-12-26T09:00:00',
          updated_at: '2024-12-26T09:00:00',
          preferred_slots: [],
        },
      ],
    }

    it('fetches reservations with default parameters', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await fetchDashboardReservations('profile-1')

      expect(result).toEqual(mockResponse)
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/dashboard/shops/profile-1/reservations?'),
        expect.objectContaining({
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        }),
      )
    })

    it('includes status parameter when provided', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      await fetchDashboardReservations('profile-1', { status: 'pending' })

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=pending'),
        expect.any(Object),
      )
    })

    it('includes limit parameter', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      await fetchDashboardReservations('profile-1', { limit: 20 })

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=20'),
        expect.any(Object),
      )
    })

    it('includes sort and direction parameters', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      await fetchDashboardReservations('profile-1', { sort: 'date', direction: 'asc' })

      const url = mockApiFetch.mock.calls[0][0] as string
      expect(url).toContain('sort=date')
      expect(url).toContain('direction=asc')
    })

    it('includes search query parameter', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      await fetchDashboardReservations('profile-1', { q: 'test search' })

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('q=test+search'),
        expect.any(Object),
      )
    })

    it('includes date range parameters', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      await fetchDashboardReservations('profile-1', {
        start: '2024-12-01',
        end: '2024-12-31',
      })

      const url = mockApiFetch.mock.calls[0][0] as string
      expect(url).toContain('start=2024-12-01')
      expect(url).toContain('end=2024-12-31')
    })

    it('includes cursor and cursor direction parameters', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      await fetchDashboardReservations('profile-1', {
        cursor: 'abc123',
        cursorDirection: 'forward',
      })

      const url = mockApiFetch.mock.calls[0][0] as string
      expect(url).toContain('cursor=abc123')
      expect(url).toContain('cursor_direction=forward')
    })

    it('includes mode parameter', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      await fetchDashboardReservations('profile-1', { mode: 'today' })

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('mode=today'),
        expect.any(Object),
      )
    })

    it('passes abort signal', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const controller = new AbortController()
      await fetchDashboardReservations('profile-1', { signal: controller.signal })

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: controller.signal,
        }),
      )
    })

    it('throws error on non-ok response', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      await expect(fetchDashboardReservations('profile-1')).rejects.toThrow(
        '予約リストの取得に失敗しました (status=404)',
      )
    })

    it('throws error on 500 response', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      await expect(fetchDashboardReservations('profile-1')).rejects.toThrow(
        '予約リストの取得に失敗しました (status=500)',
      )
    })

    it('includes all parameters in combined request', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      await fetchDashboardReservations('profile-1', {
        status: 'confirmed',
        limit: 25,
        sort: 'date',
        direction: 'asc',
        q: 'customer',
        start: '2024-12-01',
        end: '2024-12-31',
        cursor: 'cursor123',
        cursorDirection: 'backward',
        mode: 'tomorrow',
      })

      const url = mockApiFetch.mock.calls[0][0] as string
      expect(url).toContain('status=confirmed')
      expect(url).toContain('limit=25')
      expect(url).toContain('sort=date')
      expect(url).toContain('direction=asc')
      expect(url).toContain('q=customer')
      expect(url).toContain('start=2024-12-01')
      expect(url).toContain('end=2024-12-31')
      expect(url).toContain('cursor=cursor123')
      expect(url).toContain('cursor_direction=backward')
      expect(url).toContain('mode=tomorrow')
    })
  })

  describe('updateDashboardReservation', () => {
    const mockReservation: DashboardReservationItem = {
      id: 'res-1',
      status: 'confirmed',
      desired_start: '2024-12-27T10:00:00',
      desired_end: '2024-12-27T11:00:00',
      customer_name: 'Test User',
      customer_phone: '090-1234-5678',
      created_at: '2024-12-26T09:00:00',
      updated_at: '2024-12-27T10:00:00',
      preferred_slots: [],
    }

    it('updates reservation successfully', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['x-reservation-conflict', '0']]),
        json: () => Promise.resolve(mockReservation),
      })

      const result = await updateDashboardReservation('profile-1', 'res-1', {
        status: 'confirmed',
      })

      expect(result.reservation).toEqual(mockReservation)
      expect(result.conflict).toBe(false)
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/dashboard/shops/profile-1/reservations/res-1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ status: 'confirmed' }),
        }),
      )
    })

    it('detects conflict from header', async () => {
      const mockHeaders = {
        get: (name: string) => (name === 'x-reservation-conflict' ? '1' : null),
      }
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        json: () => Promise.resolve(mockReservation),
      })

      const result = await updateDashboardReservation('profile-1', 'res-1', {
        status: 'confirmed',
      })

      expect(result.conflict).toBe(true)
    })

    it('includes note in request body', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
        json: () => Promise.resolve(mockReservation),
      })

      await updateDashboardReservation('profile-1', 'res-1', {
        status: 'declined',
        note: 'Customer requested cancellation',
      })

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            status: 'declined',
            note: 'Customer requested cancellation',
          }),
        }),
      )
    })

    it('throws error with message from response', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: { get: () => null },
        json: () => Promise.resolve({ message: 'Reservation already cancelled' }),
      })

      await expect(
        updateDashboardReservation('profile-1', 'res-1', { status: 'cancelled' }),
      ).rejects.toThrow('Reservation already cancelled')
    })

    it('throws error with detail from response', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: { get: () => null },
        json: () => Promise.resolve({ detail: 'Invalid status transition' }),
      })

      await expect(
        updateDashboardReservation('profile-1', 'res-1', { status: 'confirmed' }),
      ).rejects.toThrow('Invalid status transition')
    })

    it('throws default error when JSON parsing fails', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: { get: () => null },
        json: () => Promise.reject(new Error('Invalid JSON')),
      })

      await expect(
        updateDashboardReservation('profile-1', 'res-1', { status: 'confirmed' }),
      ).rejects.toThrow('予約の更新に失敗しました。時間をおいて再度お試しください。')
    })

    it('throws default error when detail is not a string', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: { get: () => null },
        json: () => Promise.resolve({ message: { nested: 'error' } }),
      })

      await expect(
        updateDashboardReservation('profile-1', 'res-1', { status: 'confirmed' }),
      ).rejects.toThrow('予約の更新に失敗しました。')
    })

    it('supports all status types', async () => {
      const statuses = ['pending', 'confirmed', 'declined', 'cancelled', 'expired'] as const

      for (const status of statuses) {
        mockApiFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => null },
          json: () => Promise.resolve({ ...mockReservation, status }),
        })

        const result = await updateDashboardReservation('profile-1', 'res-1', { status })
        expect(result.reservation.status).toBe(status)
      }
    })
  })
})
