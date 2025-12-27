import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchDashboardReviews,
  fetchDashboardReviewStats,
  updateDashboardReviewStatus,
} from '../dashboard'

// Mock dependencies
vi.mock('@/lib/api', () => ({
  buildApiUrl: (base: string, path: string) => `${base}/${path}`,
  resolveApiBases: () => ['http://internal-api:8000'],
}))

// Store original fetch
const originalFetch = global.fetch

describe('reviews/api/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('fetchDashboardReviews', () => {
    it('fetches reviews successfully', async () => {
      const mockResponse = {
        total: 2,
        items: [
          { id: 'review-1', profile_id: 'profile-1', status: 'published', score: 5, body: 'Great!' },
          { id: 'review-2', profile_id: 'profile-1', status: 'pending', score: 4, body: 'Good' },
        ],
      }
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      })

      const result = await fetchDashboardReviews('profile-123')

      expect(result).toEqual({ status: 'success', data: mockResponse })
      expect(global.fetch).toHaveBeenCalledWith(
        'http://internal-api:8000/api/dashboard/shops/profile-123/reviews',
        expect.objectContaining({
          method: 'GET',
          cache: 'no-store',
        }),
      )
    })

    it('includes status filter in query params', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ total: 0, items: [] }),
      })

      await fetchDashboardReviews('profile-123', { status_filter: 'pending' })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('status_filter=pending'),
        expect.any(Object),
      )
    })

    it('includes pagination params in query', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ total: 0, items: [] }),
      })

      await fetchDashboardReviews('profile-123', { page: 2, page_size: 10 })

      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(url).toContain('page=2')
      expect(url).toContain('page_size=10')
    })

    it('passes cookie header when provided', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ total: 0, items: [] }),
      })

      await fetchDashboardReviews('profile-123', undefined, {
        cookieHeader: 'session=abc123',
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            cookie: 'session=abc123',
          }),
        }),
      )
    })

    it('returns unauthorized for 401', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 401,
        headers: new Headers(),
      })

      const result = await fetchDashboardReviews('profile-123')

      expect(result).toEqual({ status: 'unauthorized' })
    })

    it('returns forbidden for 403', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 403,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ detail: 'no_shop_access' }),
      })

      const result = await fetchDashboardReviews('profile-123')

      expect(result).toEqual({ status: 'forbidden', detail: 'no_shop_access' })
    })

    it('returns forbidden with default detail when no detail provided', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 403,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      })

      const result = await fetchDashboardReviews('profile-123')

      expect(result).toEqual({ status: 'forbidden', detail: 'dashboard_access_denied' })
    })

    it('returns not_found for 404', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 404,
        headers: new Headers(),
      })

      const result = await fetchDashboardReviews('profile-123')

      expect(result).toEqual({ status: 'not_found' })
    })

    it('returns error for other status codes', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 500,
        headers: new Headers(),
      })

      const result = await fetchDashboardReviews('profile-123')

      expect(result).toEqual({
        status: 'error',
        message: expect.stringContaining('500'),
      })
    })

    it('handles network errors', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

      const result = await fetchDashboardReviews('profile-123')

      expect(result).toEqual({
        status: 'error',
        message: 'Network error',
      })
    })

    it('uses custom cache option', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ total: 0, items: [] }),
      })

      await fetchDashboardReviews('profile-123', undefined, { cache: 'force-cache' })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          cache: 'force-cache',
        }),
      )
    })
  })

  describe('fetchDashboardReviewStats', () => {
    it('fetches stats successfully', async () => {
      const mockStats = {
        total: 100,
        pending: 10,
        published: 85,
        rejected: 5,
        average_score: 4.5,
      }
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockStats),
      })

      const result = await fetchDashboardReviewStats('profile-123')

      expect(result).toEqual({ status: 'success', data: mockStats })
      expect(global.fetch).toHaveBeenCalledWith(
        'http://internal-api:8000/api/dashboard/shops/profile-123/reviews/stats',
        expect.any(Object),
      )
    })

    it('returns unauthorized for 401', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 401,
        headers: new Headers(),
      })

      const result = await fetchDashboardReviewStats('profile-123')

      expect(result).toEqual({ status: 'unauthorized' })
    })

    it('returns forbidden for 403', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 403,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ detail: 'access_denied' }),
      })

      const result = await fetchDashboardReviewStats('profile-123')

      expect(result).toEqual({ status: 'forbidden', detail: 'access_denied' })
    })

    it('returns not_found for 404', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 404,
        headers: new Headers(),
      })

      const result = await fetchDashboardReviewStats('profile-123')

      expect(result).toEqual({ status: 'not_found' })
    })

    it('handles network errors', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Connection refused'))

      const result = await fetchDashboardReviewStats('profile-123')

      expect(result).toEqual({
        status: 'error',
        message: 'Connection refused',
      })
    })
  })

  describe('updateDashboardReviewStatus', () => {
    it('updates status successfully', async () => {
      const mockReview = {
        id: 'review-1',
        profile_id: 'profile-1',
        status: 'published',
        score: 5,
        body: 'Great!',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      }
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockReview),
      })

      const result = await updateDashboardReviewStatus('profile-123', 'review-1', 'published')

      expect(result).toEqual({ status: 'success', data: mockReview })
      expect(global.fetch).toHaveBeenCalledWith(
        'http://internal-api:8000/api/dashboard/shops/profile-123/reviews/review-1/status',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ status: 'published' }),
        }),
      )
    })

    it('returns unauthorized for 401', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 401,
        headers: new Headers(),
      })

      const result = await updateDashboardReviewStatus('profile-123', 'review-1', 'published')

      expect(result).toEqual({ status: 'unauthorized' })
    })

    it('returns forbidden for 403', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 403,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ detail: 'not_authorized' }),
      })

      const result = await updateDashboardReviewStatus('profile-123', 'review-1', 'published')

      expect(result).toEqual({ status: 'forbidden', detail: 'not_authorized' })
    })

    it('returns not_found for 404', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 404,
        headers: new Headers(),
      })

      const result = await updateDashboardReviewStatus('profile-123', 'review-1', 'published')

      expect(result).toEqual({ status: 'not_found' })
    })

    it('handles network errors', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Timeout'))

      const result = await updateDashboardReviewStatus('profile-123', 'review-1', 'published')

      expect(result).toEqual({
        status: 'error',
        message: 'Timeout',
      })
    })

    it('can reject a review', async () => {
      const mockReview = {
        id: 'review-1',
        profile_id: 'profile-1',
        status: 'rejected',
        score: 2,
        body: 'Bad review',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      }
      global.fetch = vi.fn().mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockReview),
      })

      const result = await updateDashboardReviewStatus('profile-123', 'review-1', 'rejected')

      expect(result).toEqual({ status: 'success', data: mockReview })
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ status: 'rejected' }),
        }),
      )
    })
  })
})
