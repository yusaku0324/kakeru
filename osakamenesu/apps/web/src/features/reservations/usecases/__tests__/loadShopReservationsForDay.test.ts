import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  loadShopReservationsForDay,
  loadShopReservationsForToday,
  loadShopReservationsForTomorrow,
  RESERVATION_DAY_MODES,
} from '../loadShopReservationsForDay'

// Mock the dashboard-reservations module
vi.mock('@/lib/dashboard-reservations', () => ({
  fetchDashboardReservations: vi.fn(),
}))

import { fetchDashboardReservations } from '@/lib/dashboard-reservations'

const mockFetchDashboardReservations = fetchDashboardReservations as ReturnType<typeof vi.fn>

describe('loadShopReservationsForDay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('RESERVATION_DAY_MODES', () => {
    it('contains today and tomorrow', () => {
      expect(RESERVATION_DAY_MODES).toContain('today')
      expect(RESERVATION_DAY_MODES).toContain('tomorrow')
      expect(RESERVATION_DAY_MODES).toHaveLength(2)
    })
  })

  describe('loadShopReservationsForDay', () => {
    it('fetches reservations for today', async () => {
      const mockReservations = [
        { id: 'res-1', customer_name: 'Customer 1' },
        { id: 'res-2', customer_name: 'Customer 2' },
      ]
      mockFetchDashboardReservations.mockResolvedValueOnce({
        reservations: mockReservations,
      })

      const result = await loadShopReservationsForDay('profile-123', 'today')

      expect(result).toEqual(mockReservations)
      expect(mockFetchDashboardReservations).toHaveBeenCalledWith('profile-123', {
        limit: 100,
        sort: 'date',
        direction: 'asc',
        mode: 'today',
        signal: undefined,
      })
    })

    it('fetches reservations for tomorrow', async () => {
      const mockReservations = [{ id: 'res-3', customer_name: 'Customer 3' }]
      mockFetchDashboardReservations.mockResolvedValueOnce({
        reservations: mockReservations,
      })

      const result = await loadShopReservationsForDay('profile-456', 'tomorrow')

      expect(result).toEqual(mockReservations)
      expect(mockFetchDashboardReservations).toHaveBeenCalledWith('profile-456', {
        limit: 100,
        sort: 'date',
        direction: 'asc',
        mode: 'tomorrow',
        signal: undefined,
      })
    })

    it('passes abort signal when provided', async () => {
      mockFetchDashboardReservations.mockResolvedValueOnce({
        reservations: [],
      })
      const abortController = new AbortController()

      await loadShopReservationsForDay('profile-123', 'today', {
        signal: abortController.signal,
      })

      expect(mockFetchDashboardReservations).toHaveBeenCalledWith('profile-123', {
        limit: 100,
        sort: 'date',
        direction: 'asc',
        mode: 'today',
        signal: abortController.signal,
      })
    })

    it('returns empty array when no reservations', async () => {
      mockFetchDashboardReservations.mockResolvedValueOnce({
        reservations: [],
      })

      const result = await loadShopReservationsForDay('profile-123', 'today')

      expect(result).toEqual([])
    })
  })

  describe('loadShopReservationsForToday', () => {
    it('calls loadShopReservationsForDay with today mode', async () => {
      mockFetchDashboardReservations.mockResolvedValueOnce({
        reservations: [{ id: 'today-res' }],
      })

      const result = await loadShopReservationsForToday('profile-789')

      expect(result).toEqual([{ id: 'today-res' }])
      expect(mockFetchDashboardReservations).toHaveBeenCalledWith(
        'profile-789',
        expect.objectContaining({ mode: 'today' }),
      )
    })

    it('passes options to underlying function', async () => {
      mockFetchDashboardReservations.mockResolvedValueOnce({
        reservations: [],
      })
      const abortController = new AbortController()

      await loadShopReservationsForToday('profile-789', { signal: abortController.signal })

      expect(mockFetchDashboardReservations).toHaveBeenCalledWith(
        'profile-789',
        expect.objectContaining({ signal: abortController.signal }),
      )
    })
  })

  describe('loadShopReservationsForTomorrow', () => {
    it('calls loadShopReservationsForDay with tomorrow mode', async () => {
      mockFetchDashboardReservations.mockResolvedValueOnce({
        reservations: [{ id: 'tomorrow-res' }],
      })

      const result = await loadShopReservationsForTomorrow('profile-abc')

      expect(result).toEqual([{ id: 'tomorrow-res' }])
      expect(mockFetchDashboardReservations).toHaveBeenCalledWith(
        'profile-abc',
        expect.objectContaining({ mode: 'tomorrow' }),
      )
    })

    it('passes options to underlying function', async () => {
      mockFetchDashboardReservations.mockResolvedValueOnce({
        reservations: [],
      })
      const abortController = new AbortController()

      await loadShopReservationsForTomorrow('profile-abc', { signal: abortController.signal })

      expect(mockFetchDashboardReservations).toHaveBeenCalledWith(
        'profile-abc',
        expect.objectContaining({ signal: abortController.signal }),
      )
    })
  })
})
