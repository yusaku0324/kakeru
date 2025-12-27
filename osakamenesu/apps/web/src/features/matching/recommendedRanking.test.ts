import { describe, it, expect } from 'vitest'
import {
  mapCandidateToRecommendedInput,
  rerankMatchingCandidates,
  type MatchingCandidateLike,
  type MatchingSearchParams,
} from './recommendedRanking'

describe('recommendedRanking', () => {
  describe('mapCandidateToRecommendedInput', () => {
    it('maps therapist_id correctly', () => {
      const candidate: MatchingCandidateLike = {
        therapist_id: 'therapist-123',
        therapist_name: 'Test Therapist',
      }
      const result = mapCandidateToRecommendedInput(candidate)
      expect(result.therapist_id).toBe('therapist-123')
    })

    it('falls back to id when therapist_id is not provided', () => {
      const candidate: MatchingCandidateLike = {
        id: 'id-456',
        name: 'Test Name',
      }
      const result = mapCandidateToRecommendedInput(candidate)
      expect(result.therapist_id).toBe('id-456')
    })

    it('uses empty string when no id provided', () => {
      const candidate: MatchingCandidateLike = {
        therapist_name: 'Test',
      }
      const result = mapCandidateToRecommendedInput(candidate)
      expect(result.therapist_id).toBe('')
    })

    it('maps therapist_name correctly', () => {
      const candidate: MatchingCandidateLike = {
        therapist_id: 'id',
        therapist_name: 'Therapist Name',
      }
      const result = mapCandidateToRecommendedInput(candidate)
      expect(result.therapist_name).toBe('Therapist Name')
    })

    it('falls back to name when therapist_name is not provided', () => {
      const candidate: MatchingCandidateLike = {
        id: 'id',
        name: 'Name Only',
      }
      const result = mapCandidateToRecommendedInput(candidate)
      expect(result.therapist_name).toBe('Name Only')
    })

    it('maps shop info correctly', () => {
      const candidate: MatchingCandidateLike = {
        therapist_id: 'id',
        shop_id: 'shop-123',
        shop_name: 'Test Shop',
      }
      const result = mapCandidateToRecommendedInput(candidate)
      expect(result.shop_id).toBe('shop-123')
      expect(result.shop_name).toBe('Test Shop')
    })

    it('maps style tags correctly', () => {
      const candidate: MatchingCandidateLike = {
        therapist_id: 'id',
        look_type: 'cute',
        style_tag: 'elegant',
        mood_tag: 'relaxed',
        talk_level: 'medium',
      }
      const result = mapCandidateToRecommendedInput(candidate)
      expect(result.look_type).toBe('cute')
      expect(result.style_tag).toBe('elegant')
      expect(result.mood_tag).toBe('relaxed')
      expect(result.talk_level).toBe('medium')
    })

    it('returns null for missing style tags', () => {
      const candidate: MatchingCandidateLike = {
        therapist_id: 'id',
      }
      const result = mapCandidateToRecommendedInput(candidate)
      expect(result.look_type).toBeNull()
      expect(result.style_tag).toBeNull()
      expect(result.mood_tag).toBeNull()
      expect(result.talk_level).toBeNull()
    })

    it('maps price_rank correctly', () => {
      const candidate: MatchingCandidateLike = {
        therapist_id: 'id',
        price_rank: 3,
      }
      const result = mapCandidateToRecommendedInput(candidate)
      expect(result.price_rank).toBe(3)
    })

    it('calculates availability_score from availability.is_available = true', () => {
      const candidate: MatchingCandidateLike = {
        therapist_id: 'id',
        availability: { is_available: true },
      }
      const result = mapCandidateToRecommendedInput(candidate)
      expect(result.availability_score).toBe(1)
    })

    it('calculates availability_score from availability.is_available = false', () => {
      const candidate: MatchingCandidateLike = {
        therapist_id: 'id',
        availability: { is_available: false, rejected_reasons: ['no_slots'] },
      }
      const result = mapCandidateToRecommendedInput(candidate)
      expect(result.availability_score).toBe(0)
    })

    it('uses availability_score when availability.is_available is null', () => {
      const candidate: MatchingCandidateLike = {
        therapist_id: 'id',
        availability: { is_available: null },
        availability_score: 0.75,
      }
      const result = mapCandidateToRecommendedInput(candidate)
      expect(result.availability_score).toBe(0.75)
    })

    it('uses availability_score when availability is not provided', () => {
      const candidate: MatchingCandidateLike = {
        therapist_id: 'id',
        availability_score: 0.5,
      }
      const result = mapCandidateToRecommendedInput(candidate)
      expect(result.availability_score).toBe(0.5)
    })

    it('maps performance metrics correctly', () => {
      const candidate: MatchingCandidateLike = {
        therapist_id: 'id',
        total_bookings_30d: 50,
        repeat_rate_30d: 0.8,
        avg_review_score: 4.5,
        days_since_first_shift: 180,
        utilization_7d: 0.7,
      }
      const result = mapCandidateToRecommendedInput(candidate)
      expect(result.total_bookings_30d).toBe(50)
      expect(result.repeat_rate_30d).toBe(0.8)
      expect(result.avg_review_score).toBe(4.5)
      expect(result.days_since_first_shift).toBe(180)
      expect(result.utilization_7d).toBe(0.7)
    })

    it('returns null for missing performance metrics', () => {
      const candidate: MatchingCandidateLike = {
        therapist_id: 'id',
      }
      const result = mapCandidateToRecommendedInput(candidate)
      expect(result.total_bookings_30d).toBeNull()
      expect(result.repeat_rate_30d).toBeNull()
      expect(result.avg_review_score).toBeNull()
      expect(result.days_since_first_shift).toBeNull()
      expect(result.utilization_7d).toBeNull()
    })
  })

  describe('rerankMatchingCandidates', () => {
    const createCandidate = (overrides: Partial<MatchingCandidateLike>): MatchingCandidateLike => ({
      therapist_id: 'default-id',
      therapist_name: 'Default Name',
      shop_id: 'shop-1',
      shop_name: 'Test Shop',
      ...overrides,
    })

    it('returns empty array for empty input', () => {
      const params: MatchingSearchParams = {}
      const result = rerankMatchingCandidates(params, [])
      expect(result).toEqual([])
    })

    it('ranks candidates and returns them with original properties', () => {
      const params: MatchingSearchParams = { area: '新宿' }
      const candidates: MatchingCandidateLike[] = [
        createCandidate({
          therapist_id: 't1',
          therapist_name: 'Therapist 1',
          summary: 'Summary 1',
          slots: [{ start_at: '2024-12-27T10:00:00', end_at: '2024-12-27T11:00:00' }],
        }),
        createCandidate({
          therapist_id: 't2',
          therapist_name: 'Therapist 2',
          summary: 'Summary 2',
        }),
      ]

      const result = rerankMatchingCandidates(params, candidates)

      expect(result.length).toBe(2)
      expect(result.every(r => 'therapist_id' in r)).toBe(true)
      expect(result.every(r => 'recommended_score' in r)).toBe(true)
    })

    it('preserves original summary in ranked results', () => {
      const params: MatchingSearchParams = {}
      const candidates: MatchingCandidateLike[] = [
        createCandidate({
          therapist_id: 't1',
          summary: 'Original summary text',
        }),
      ]

      const result = rerankMatchingCandidates(params, candidates)

      expect(result[0].summary).toBe('Original summary text')
    })

    it('preserves original slots in ranked results', () => {
      const params: MatchingSearchParams = {}
      const slots = [
        { start_at: '2024-12-27T10:00:00', end_at: '2024-12-27T11:00:00' },
        { start_at: '2024-12-27T14:00:00', end_at: '2024-12-27T15:00:00' },
      ]
      const candidates: MatchingCandidateLike[] = [
        createCandidate({ therapist_id: 't1', slots }),
      ]

      const result = rerankMatchingCandidates(params, candidates)

      expect(result[0].slots).toEqual(slots)
    })

    it('preserves original availability in ranked results', () => {
      const params: MatchingSearchParams = {}
      const availability = { is_available: true }
      const candidates: MatchingCandidateLike[] = [
        createCandidate({ therapist_id: 't1', availability }),
      ]

      const result = rerankMatchingCandidates(params, candidates)

      expect(result[0].availability).toEqual(availability)
    })

    it('handles candidates with id instead of therapist_id', () => {
      const params: MatchingSearchParams = {}
      const candidates: MatchingCandidateLike[] = [
        {
          id: 'using-id-field',
          name: 'Name via name field',
          shop_id: 'shop-1',
        },
      ]

      const result = rerankMatchingCandidates(params, candidates)

      expect(result.length).toBe(1)
      expect(result[0].therapist_id).toBe('using-id-field')
    })

    it('handles search params with date and time', () => {
      const params: MatchingSearchParams = {
        area: '渋谷',
        date: '2024-12-27',
        time_from: '10:00',
        time_to: '18:00',
      }
      const candidates: MatchingCandidateLike[] = [
        createCandidate({ therapist_id: 't1' }),
      ]

      const result = rerankMatchingCandidates(params, candidates)

      expect(result.length).toBe(1)
    })

    it('uses fallback name when therapist_name is missing', () => {
      const params: MatchingSearchParams = {}
      const candidates: MatchingCandidateLike[] = [
        {
          therapist_id: 't1',
          name: 'Fallback Name',
        },
      ]

      const result = rerankMatchingCandidates(params, candidates)

      expect(result[0].therapist_name).toBe('Fallback Name')
    })

    it('falls back to empty string when no name available', () => {
      const params: MatchingSearchParams = {}
      const candidates: MatchingCandidateLike[] = [
        { therapist_id: 't1' },
      ]

      const result = rerankMatchingCandidates(params, candidates)

      expect(result[0].therapist_name).toBe('')
    })

    it('preserves shop_id and shop_name from original candidate', () => {
      const params: MatchingSearchParams = {}
      const candidates: MatchingCandidateLike[] = [
        createCandidate({
          therapist_id: 't1',
          shop_id: 'original-shop-id',
          shop_name: 'Original Shop Name',
        }),
      ]

      const result = rerankMatchingCandidates(params, candidates)

      expect(result[0].shop_id).toBe('original-shop-id')
      expect(result[0].shop_name).toBe('Original Shop Name')
    })

    it('handles candidates with high performance metrics', () => {
      const params: MatchingSearchParams = {}
      const candidates: MatchingCandidateLike[] = [
        createCandidate({
          therapist_id: 't1',
          total_bookings_30d: 100,
          repeat_rate_30d: 0.9,
          avg_review_score: 4.8,
        }),
        createCandidate({
          therapist_id: 't2',
          total_bookings_30d: 10,
          repeat_rate_30d: 0.3,
          avg_review_score: 3.5,
        }),
      ]

      const result = rerankMatchingCandidates(params, candidates)

      // Higher performing candidate should have higher score
      const t1Result = result.find(r => r.therapist_id === 't1')
      const t2Result = result.find(r => r.therapist_id === 't2')
      expect(t1Result?.recommended_score).toBeGreaterThan(t2Result?.recommended_score ?? 0)
    })

    it('handles newcomer candidates', () => {
      const params: MatchingSearchParams = {}
      const candidates: MatchingCandidateLike[] = [
        createCandidate({
          therapist_id: 'newcomer',
          days_since_first_shift: 7,
          utilization_7d: 0.2,
        }),
      ]

      const result = rerankMatchingCandidates(params, candidates)

      expect(result.length).toBe(1)
      expect(result[0].therapist_id).toBe('newcomer')
    })

    it('handles candidates with availability false', () => {
      const params: MatchingSearchParams = {}
      const candidates: MatchingCandidateLike[] = [
        createCandidate({
          therapist_id: 't1',
          availability: { is_available: false, rejected_reasons: ['no_slots'] },
        }),
        createCandidate({
          therapist_id: 't2',
          availability: { is_available: true },
        }),
      ]

      const result = rerankMatchingCandidates(params, candidates)

      // Available candidate should rank higher
      const t1Idx = result.findIndex(r => r.therapist_id === 't1')
      const t2Idx = result.findIndex(r => r.therapist_id === 't2')
      expect(t2Idx).toBeLessThan(t1Idx)
    })
  })
})
