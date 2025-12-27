import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchSimilarTherapists } from './api'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('matching/api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window.location
    Object.defineProperty(global, 'window', {
      value: { location: { origin: 'https://example.com' } },
      writable: true,
    })
  })

  describe('fetchSimilarTherapists', () => {
    it('sends request with correct params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ items: [], base_staff_id: 'staff-1' }),
      })

      await fetchSimilarTherapists({ staffId: 'staff-1', limit: 10 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/guest/matching/similar?'),
        { cache: 'no-store' }
      )
      expect(mockFetch.mock.calls[0][0]).toContain('staff_id=staff-1')
      expect(mockFetch.mock.calls[0][0]).toContain('limit=10')
    })

    it('includes optional params when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] }),
      })

      await fetchSimilarTherapists({
        staffId: 'staff-1',
        minScore: 0.5,
        shopId: 'shop-1',
        excludeUnavailable: true,
      })

      const url = mockFetch.mock.calls[0][0]
      expect(url).toContain('min_score=0.5')
      expect(url).toContain('shop_id=shop-1')
      expect(url).toContain('exclude_unavailable=true')
    })

    it('returns empty items on 404', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      })

      const result = await fetchSimilarTherapists({ staffId: 'staff-1' })

      expect(result).toEqual({ baseStaffId: 'staff-1', items: [] })
    })

    it('returns empty items on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      })

      const result = await fetchSimilarTherapists({ staffId: 'staff-1' })

      expect(result).toEqual({ baseStaffId: 'staff-1', items: [] })
    })

    it('returns empty items on fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await fetchSimilarTherapists({ staffId: 'staff-1' })

      expect(result).toEqual({ baseStaffId: 'staff-1', items: [] })
    })

    it('normalizes response items', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'th-1',
              name: 'Test Therapist',
              age: 25,
              price_rank: 3,
              mood_tag: 'relaxed',
              style_tag: 'gentle',
              look_type: 'cute',
              contact_style: 'friendly',
              hobby_tags: ['yoga', 'reading'],
              photo_url: 'https://example.com/photo.jpg',
              is_available_now: true,
              score: 0.85,
              photo_similarity: 0.9,
              tag_similarity: 0.8,
            },
          ],
          base_staff_id: 'staff-1',
        }),
      })

      const result = await fetchSimilarTherapists({ staffId: 'staff-1' })

      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toEqual({
        id: 'th-1',
        name: 'Test Therapist',
        age: 25,
        priceRank: 3,
        moodTag: 'relaxed',
        styleTag: 'gentle',
        lookType: 'cute',
        contactStyle: 'friendly',
        hobbyTags: ['yoga', 'reading'],
        photoUrl: 'https://example.com/photo.jpg',
        isAvailableNow: true,
        score: 0.85,
        photoSimilarity: 0.9,
        tagSimilarity: 0.8,
      })
    })

    it('handles missing/invalid values in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'th-1',
              // Missing most fields
            },
          ],
          base_staff_id: 'staff-1',
        }),
      })

      const result = await fetchSimilarTherapists({ staffId: 'staff-1' })

      expect(result.items[0]).toEqual({
        id: 'th-1',
        name: '',
        age: null,
        priceRank: null,
        moodTag: null,
        styleTag: null,
        lookType: null,
        contactStyle: null,
        hobbyTags: [],
        photoUrl: null,
        isAvailableNow: true,
        score: 0,
        photoSimilarity: 0,
        tagSimilarity: 0,
      })
    })

    it('uses baseStaffId from response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [],
          base_staff_id: 'normalized-staff-1',
        }),
      })

      const result = await fetchSimilarTherapists({ staffId: 'staff-1' })

      expect(result.baseStaffId).toBe('normalized-staff-1')
    })

    it('falls back to request staffId when response missing baseStaffId', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] }),
      })

      const result = await fetchSimilarTherapists({ staffId: 'staff-1' })

      expect(result.baseStaffId).toBe('staff-1')
    })

    it('handles non-array items in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: 'not an array',
        }),
      })

      const result = await fetchSimilarTherapists({ staffId: 'staff-1' })

      expect(result.items).toEqual([])
    })
  })
})
