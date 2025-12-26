import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ASPECT_LABELS,
  STAR_SYMBOL_FULL,
  STAR_SYMBOL_EMPTY,
  UUID_PATTERN,
  toDisplayKey,
  formatVisitedLabel,
  starLabel,
  normaliseAspectEntries,
  transformReviewItem,
  transformHighlight,
  buildInitialForm,
} from '../lib/utils'

describe('reviews utils', () => {
  describe('constants', () => {
    it('has correct ASPECT_LABELS', () => {
      expect(ASPECT_LABELS.therapist_service.label).toBe('セラピストの接客')
      expect(ASPECT_LABELS.staff_response.label).toBe('スタッフ・受付の対応')
      expect(ASPECT_LABELS.room_cleanliness.label).toBe('ルームの清潔さ')
    })

    it('has correct star symbols', () => {
      expect(STAR_SYMBOL_FULL).toBe('★')
      expect(STAR_SYMBOL_EMPTY).toBe('☆')
    })

    it('has valid UUID pattern', () => {
      expect(UUID_PATTERN.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
      expect(UUID_PATTERN.test('not-a-uuid')).toBe(false)
    })
  })

  describe('toDisplayKey', () => {
    it('creates key with unique suffix', () => {
      expect(toDisplayKey('item', 'abc123')).toBe('item-abc123')
    })

    it('creates fallback key with provided fallback', () => {
      expect(toDisplayKey('item', null, 42)).toBe('item-fallback-42')
    })

    it('creates fallback key with Date.now when no fallback provided', () => {
      const now = Date.now()
      vi.setSystemTime(new Date(now))
      expect(toDisplayKey('item', '')).toBe(`item-fallback-${now}`)
      vi.useRealTimers()
    })

    it('handles undefined unique', () => {
      const result = toDisplayKey('prefix', undefined, 1)
      expect(result).toBe('prefix-fallback-1')
    })
  })

  describe('formatVisitedLabel', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-12-17T12:00:00+09:00'))
    })

    it('returns null for null input', () => {
      expect(formatVisitedLabel(null)).toBe(null)
    })

    it('returns null for empty string', () => {
      expect(formatVisitedLabel('')).toBe(null)
    })

    it('formats valid date string', () => {
      const result = formatVisitedLabel('2024-12-15T14:00:00+09:00')
      expect(result).toMatch(/2024/)
      expect(result).toMatch(/12/)
      expect(result).toMatch(/15/)
    })

    it('returns original input for invalid date', () => {
      expect(formatVisitedLabel('not-a-date')).toBe('not-a-date')
    })

    afterEach(() => {
      vi.useRealTimers()
    })
  })

  describe('starLabel', () => {
    it('returns 5 full stars for score 5', () => {
      expect(starLabel(5)).toBe('★★★★★')
    })

    it('returns 3 full stars and 2 empty for score 3', () => {
      expect(starLabel(3)).toBe('★★★☆☆')
    })

    it('returns all empty stars for score 0', () => {
      expect(starLabel(0)).toBe('☆☆☆☆☆')
    })

    it('clamps score to max 5', () => {
      expect(starLabel(10)).toBe('★★★★★')
    })

    it('clamps score to min 0', () => {
      expect(starLabel(-3)).toBe('☆☆☆☆☆')
    })

    it('rounds score to nearest integer', () => {
      expect(starLabel(3.7)).toBe('★★★★☆')
      expect(starLabel(3.2)).toBe('★★★☆☆')
    })
  })

  describe('normaliseAspectEntries', () => {
    it('returns empty array for null aspects', () => {
      expect(normaliseAspectEntries(null)).toEqual([])
    })

    it('returns empty array for undefined aspects', () => {
      expect(normaliseAspectEntries(undefined)).toEqual([])
    })

    it('extracts aspects with scores', () => {
      const aspects = {
        therapist_service: { score: 5, note: 'Great' },
        staff_response: { score: 4, note: null },
        room_cleanliness: { score: null, note: '' },
      }
      const result = normaliseAspectEntries(aspects)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ key: 'therapist_service', score: 5, note: 'Great' })
      expect(result[1]).toEqual({ key: 'staff_response', score: 4, note: null })
    })
  })

  describe('transformReviewItem', () => {
    it('transforms review item to display format', () => {
      const item = {
        id: 'review-123',
        profile_id: 'profile-123',
        title: 'Great experience',
        body: 'Loved the service',
        score: 5,
        author_alias: 'Anonymous',
        visited_at: '2024-12-15',
        status: 'published' as const,
        created_at: '2024-12-16T10:00:00Z',
        updated_at: '2024-12-16T10:00:00Z',
        aspects: null,
      }

      const result = transformReviewItem(item)

      expect(result.key).toBe('item-review-123')
      expect(result.title).toBe('Great experience')
      expect(result.body).toBe('Loved the service')
      expect(result.score).toBe(5)
      expect(result.author).toBe('Anonymous')
      expect(result.visitedAt).toBe('2024-12-15')
      expect(result.status).toBe('published')
    })

    it('handles null author_alias', () => {
      const item = {
        id: 'review-456',
        profile_id: 'profile-456',
        title: 'Title',
        body: 'Body',
        score: 4,
        author_alias: null,
        visited_at: null,
        status: 'pending' as const,
        created_at: '2024-12-16T10:00:00Z',
        updated_at: '2024-12-16T10:00:00Z',
        aspects: null,
      }

      const result = transformReviewItem(item)
      expect(result.author).toBe(null)
      expect(result.visitedAt).toBe(null)
    })
  })

  describe('transformHighlight', () => {
    it('transforms highlighted review to display format', () => {
      const item = {
        review_id: 'highlight-123',
        title: 'Featured review',
        body: 'This is a highlighted review',
        score: 5,
        author_alias: 'VIP Customer',
        visited_at: '2024-12-10',
        aspects: null,
      }

      const result = transformHighlight(item, 0)

      expect(result.key).toBe('highlight-highlight-123')
      expect(result.title).toBe('Featured review')
      expect(result.status).toBe('highlight')
    })

    it('uses index for fallback key', () => {
      const item = {
        review_id: null,
        title: 'No ID review',
        body: 'Body',
        score: 4,
        author_alias: null,
        visited_at: null,
        aspects: null,
      }

      const result = transformHighlight(item, 5)
      expect(result.key).toBe('highlight-fallback-5')
    })
  })

  describe('buildInitialForm', () => {
    it('returns correct initial form state', () => {
      const form = buildInitialForm()

      expect(form.score).toBe(5)
      expect(form.title).toBe('')
      expect(form.body).toBe('')
      expect(form.authorAlias).toBe('')
      expect(form.visitedAt).toBe('')
    })

    it('returns initial aspects with null scores', () => {
      const form = buildInitialForm()

      expect(form.aspects.therapist_service.score).toBe(null)
      expect(form.aspects.staff_response.score).toBe(null)
      expect(form.aspects.room_cleanliness.score).toBe(null)
    })
  })
})
