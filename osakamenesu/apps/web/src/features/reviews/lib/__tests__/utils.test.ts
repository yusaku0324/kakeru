import { describe, it, expect, vi } from 'vitest'
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
} from '../utils'
import type { ReviewItem, HighlightedReview } from '../../domain/types'

describe('reviews/lib/utils', () => {
  describe('constants', () => {
    describe('ASPECT_LABELS', () => {
      it('has therapist_service aspect', () => {
        expect(ASPECT_LABELS.therapist_service).toBeDefined()
        expect(ASPECT_LABELS.therapist_service.label).toBe('セラピストの接客')
        expect(ASPECT_LABELS.therapist_service.help).toBe('施術の丁寧さや気配りなど')
      })

      it('has staff_response aspect', () => {
        expect(ASPECT_LABELS.staff_response).toBeDefined()
        expect(ASPECT_LABELS.staff_response.label).toBe('スタッフ・受付の対応')
        expect(ASPECT_LABELS.staff_response.help).toBe('予約〜受付の説明や案内の印象')
      })

      it('has room_cleanliness aspect', () => {
        expect(ASPECT_LABELS.room_cleanliness).toBeDefined()
        expect(ASPECT_LABELS.room_cleanliness.label).toBe('ルームの清潔さ')
        expect(ASPECT_LABELS.room_cleanliness.help).toBe('シャワーや備品の整頓・衛生面')
      })
    })

    describe('STAR_SYMBOL_FULL', () => {
      it('is a filled star', () => {
        expect(STAR_SYMBOL_FULL).toBe('★')
      })
    })

    describe('STAR_SYMBOL_EMPTY', () => {
      it('is an empty star', () => {
        expect(STAR_SYMBOL_EMPTY).toBe('☆')
      })
    })

    describe('UUID_PATTERN', () => {
      it('matches valid UUID', () => {
        expect(UUID_PATTERN.test('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
      })

      it('does not match invalid UUID', () => {
        expect(UUID_PATTERN.test('not-a-uuid')).toBe(false)
      })

      it('is case insensitive', () => {
        expect(UUID_PATTERN.test('123E4567-E89B-12D3-A456-426614174000')).toBe(true)
      })
    })
  })

  describe('toDisplayKey', () => {
    it('creates key with prefix and unique value', () => {
      expect(toDisplayKey('item', 'abc123')).toBe('item-abc123')
    })

    it('uses fallback when unique is null', () => {
      expect(toDisplayKey('item', null, 42)).toBe('item-fallback-42')
    })

    it('uses fallback when unique is undefined', () => {
      expect(toDisplayKey('item', undefined, 42)).toBe('item-fallback-42')
    })

    it('uses fallback when unique is empty string', () => {
      expect(toDisplayKey('item', '', 42)).toBe('item-fallback-42')
    })

    it('uses Date.now as fallback when no fallback provided', () => {
      const before = Date.now()
      const result = toDisplayKey('item', null)
      const after = Date.now()
      expect(result).toMatch(/^item-fallback-\d+$/)
      const timestamp = parseInt(result.split('-fallback-')[1])
      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('formatVisitedLabel', () => {
    it('formats valid date', () => {
      const result = formatVisitedLabel('2024-12-01')
      expect(result).toBe('2024/12/1')
    })

    it('returns null for null input', () => {
      expect(formatVisitedLabel(null)).toBeNull()
    })

    it('returns null for undefined input', () => {
      expect(formatVisitedLabel(undefined)).toBeNull()
    })

    it('returns original string for invalid date', () => {
      expect(formatVisitedLabel('invalid-date')).toBe('invalid-date')
    })

    it('formats ISO date string', () => {
      const result = formatVisitedLabel('2024-06-15T10:30:00Z')
      expect(result).toMatch(/2024\/6\/15/)
    })
  })

  describe('starLabel', () => {
    it('returns 5 filled stars for score 5', () => {
      expect(starLabel(5)).toBe('★★★★★')
    })

    it('returns 4 filled and 1 empty star for score 4', () => {
      expect(starLabel(4)).toBe('★★★★☆')
    })

    it('returns 3 filled and 2 empty stars for score 3', () => {
      expect(starLabel(3)).toBe('★★★☆☆')
    })

    it('returns 2 filled and 3 empty stars for score 2', () => {
      expect(starLabel(2)).toBe('★★☆☆☆')
    })

    it('returns 1 filled and 4 empty stars for score 1', () => {
      expect(starLabel(1)).toBe('★☆☆☆☆')
    })

    it('returns 5 empty stars for score 0', () => {
      expect(starLabel(0)).toBe('☆☆☆☆☆')
    })

    it('caps at 5 stars for scores over 5', () => {
      expect(starLabel(10)).toBe('★★★★★')
    })

    it('returns 5 empty stars for negative scores', () => {
      expect(starLabel(-1)).toBe('☆☆☆☆☆')
    })

    it('rounds decimal scores', () => {
      expect(starLabel(4.5)).toBe('★★★★★')
      expect(starLabel(4.4)).toBe('★★★★☆')
    })
  })

  describe('normaliseAspectEntries', () => {
    it('returns empty array for null input', () => {
      expect(normaliseAspectEntries(null)).toEqual([])
    })

    it('returns empty array for undefined input', () => {
      expect(normaliseAspectEntries(undefined)).toEqual([])
    })

    it('filters out aspects without scores', () => {
      const result = normaliseAspectEntries({
        therapist_service: { score: 4, note: 'good' },
        staff_response: { score: null, note: '' },
        room_cleanliness: { score: 5, note: 'clean' },
      })
      expect(result).toHaveLength(2)
      expect(result.map((r) => r.key)).toEqual(['therapist_service', 'room_cleanliness'])
    })

    it('maps aspects to correct structure', () => {
      const result = normaliseAspectEntries({
        therapist_service: { score: 4, note: 'good' },
      })
      expect(result[0]).toEqual({
        key: 'therapist_service',
        score: 4,
        note: 'good',
      })
    })

    it('returns null note when aspect has no note', () => {
      const result = normaliseAspectEntries({
        therapist_service: { score: 4, note: null },
      })
      expect(result[0].note).toBeNull()
    })
  })

  describe('transformReviewItem', () => {
    it('transforms review item to display format', () => {
      const item: ReviewItem = {
        id: 'review-123',
        profile_id: 'profile-1',
        title: 'Great service',
        body: 'Really enjoyed my visit',
        score: 5,
        author_alias: 'Anonymous',
        visited_at: '2024-12-01',
        status: 'published',
        created_at: '2024-12-02T10:00:00Z',
        updated_at: '2024-12-02T10:00:00Z',
        aspects: null,
      }

      const result = transformReviewItem(item)

      expect(result.key).toBe('item-review-123')
      expect(result.title).toBe('Great service')
      expect(result.body).toBe('Really enjoyed my visit')
      expect(result.score).toBe(5)
      expect(result.author).toBe('Anonymous')
      expect(result.visitedAt).toBe('2024-12-01')
      expect(result.status).toBe('published')
      expect(result.submittedAt).toBe('2024-12-02T10:00:00Z')
    })

    it('handles null author_alias', () => {
      const item: ReviewItem = {
        id: 'review-123',
        profile_id: 'profile-1',
        title: 'Test',
        body: 'Test body',
        score: 4,
        author_alias: null,
        visited_at: null,
        status: 'pending',
        created_at: '2024-12-02T10:00:00Z',
        updated_at: '2024-12-02T10:00:00Z',
        aspects: null,
      }

      const result = transformReviewItem(item)
      expect(result.author).toBeNull()
      expect(result.visitedAt).toBeNull()
    })
  })

  describe('transformHighlight', () => {
    it('transforms highlighted review to display format', () => {
      const item: HighlightedReview = {
        review_id: 'highlight-123',
        title: 'Featured Review',
        body: 'This is a highlighted review',
        score: 5,
        author_alias: 'VIP',
        visited_at: '2024-11-15',
        aspects: null,
      }

      const result = transformHighlight(item, 0)

      expect(result.key).toBe('highlight-highlight-123')
      expect(result.title).toBe('Featured Review')
      expect(result.body).toBe('This is a highlighted review')
      expect(result.score).toBe(5)
      expect(result.author).toBe('VIP')
      expect(result.visitedAt).toBe('2024-11-15')
      expect(result.status).toBe('highlight')
    })

    it('uses index as fallback for key when no review_id', () => {
      const item: HighlightedReview = {
        review_id: null,
        title: 'Test',
        body: 'Test body',
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
    it('returns form with default score of 5', () => {
      const form = buildInitialForm()
      expect(form.score).toBe(5)
    })

    it('returns form with empty strings for text fields', () => {
      const form = buildInitialForm()
      expect(form.title).toBe('')
      expect(form.body).toBe('')
      expect(form.authorAlias).toBe('')
      expect(form.visitedAt).toBe('')
    })

    it('returns form with all aspects initialized', () => {
      const form = buildInitialForm()
      expect(form.aspects.therapist_service).toEqual({ score: null, note: '' })
      expect(form.aspects.staff_response).toEqual({ score: null, note: '' })
      expect(form.aspects.room_cleanliness).toEqual({ score: null, note: '' })
    })

    it('returns a new object each time', () => {
      const form1 = buildInitialForm()
      const form2 = buildInitialForm()
      expect(form1).not.toBe(form2)
    })
  })
})
