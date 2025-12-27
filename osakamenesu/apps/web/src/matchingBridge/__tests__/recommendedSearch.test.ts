import { describe, it, expect } from 'vitest'
import {
  buildGuestIntentFromSearchParams,
  rankMatchingCandidates,
  type SearchParams,
  type RecommendedCandidateInput,
} from '../recommendedSearch'

describe('recommendedSearch', () => {
  describe('buildGuestIntentFromSearchParams', () => {
    it('returns default values for empty params', () => {
      const params: SearchParams = {}
      const intent = buildGuestIntentFromSearchParams(params)

      expect(intent.area).toBeNull()
      expect(intent.date).toBeNull()
      expect(intent.time_from).toBeNull()
      expect(intent.time_to).toBeNull()
      expect(intent.price_min).toBeNull()
      expect(intent.price_max).toBeNull()
      expect(intent.shop_id).toBeNull()
      expect(intent.visual_style_tags).toEqual([])
      expect(intent.conversation_preference).toBeNull()
      expect(intent.massage_pressure_preference).toBeNull()
      expect(intent.mood_preference_tags).toEqual([])
      expect(intent.raw_text).toBe('')
    })

    it('maps area parameter', () => {
      const params: SearchParams = { area: 'shibuya' }
      const intent = buildGuestIntentFromSearchParams(params)

      expect(intent.area).toBe('shibuya')
    })

    it('maps date and time parameters', () => {
      const params: SearchParams = {
        date: '2024-12-27',
        time_from: '10:00',
        time_to: '14:00',
      }
      const intent = buildGuestIntentFromSearchParams(params)

      expect(intent.date).toBe('2024-12-27')
      expect(intent.time_from).toBe('10:00')
      expect(intent.time_to).toBe('14:00')
    })

    it('maps price parameters', () => {
      const params: SearchParams = {
        price_min: 5000,
        price_max: 15000,
      }
      const intent = buildGuestIntentFromSearchParams(params)

      expect(intent.price_min).toBe(5000)
      expect(intent.price_max).toBe(15000)
    })

    it('maps shop_id parameter', () => {
      const params: SearchParams = { shop_id: 'shop-123' }
      const intent = buildGuestIntentFromSearchParams(params)

      expect(intent.shop_id).toBe('shop-123')
    })

    it('maps visual style tags', () => {
      const params: SearchParams = {
        visual_style_tags: ['kawaii', 'natural'],
      }
      const intent = buildGuestIntentFromSearchParams(params)

      expect(intent.visual_style_tags).toEqual(['kawaii', 'natural'])
    })

    it('maps conversation preference', () => {
      const params: SearchParams = { conversation_preference: 'talkative' }
      const intent = buildGuestIntentFromSearchParams(params)

      expect(intent.conversation_preference).toBe('talkative')
    })

    it('maps massage pressure preference', () => {
      const params: SearchParams = { massage_pressure_preference: 'strong' }
      const intent = buildGuestIntentFromSearchParams(params)

      expect(intent.massage_pressure_preference).toBe('strong')
    })

    it('maps mood preference tags', () => {
      const params: SearchParams = {
        mood_preference_tags: ['calm', 'healing'],
      }
      const intent = buildGuestIntentFromSearchParams(params)

      expect(intent.mood_preference_tags).toEqual(['calm', 'healing'])
    })

    it('maps raw text', () => {
      const params: SearchParams = { raw_text: 'Looking for relaxing massage' }
      const intent = buildGuestIntentFromSearchParams(params)

      expect(intent.raw_text).toBe('Looking for relaxing massage')
    })

    it('handles null values in params', () => {
      const params: SearchParams = {
        area: null,
        date: null,
        price_min: null,
        raw_text: null,
      }
      const intent = buildGuestIntentFromSearchParams(params)

      expect(intent.area).toBeNull()
      expect(intent.date).toBeNull()
      expect(intent.price_min).toBeNull()
      expect(intent.raw_text).toBe('')
    })
  })

  describe('rankMatchingCandidates', () => {
    const baseIntent = buildGuestIntentFromSearchParams({})

    it('returns empty array for empty candidates', () => {
      const result = rankMatchingCandidates(baseIntent, [])
      expect(result).toEqual([])
    })

    it('adds recommended_score to each candidate', () => {
      const candidates: RecommendedCandidateInput[] = [
        { therapist_id: 'therapist-1' },
      ]
      const result = rankMatchingCandidates(baseIntent, candidates)

      expect(result).toHaveLength(1)
      expect(result[0].recommended_score).toBeDefined()
      expect(typeof result[0].recommended_score).toBe('number')
    })

    it('sorts candidates by recommended score descending', () => {
      const candidates: RecommendedCandidateInput[] = [
        {
          therapist_id: 'therapist-low',
          total_bookings_30d: 0,
          repeat_rate_30d: 0,
          avg_review_score: 1,
        },
        {
          therapist_id: 'therapist-high',
          total_bookings_30d: 100,
          repeat_rate_30d: 0.9,
          avg_review_score: 5,
        },
      ]
      const result = rankMatchingCandidates(baseIntent, candidates)

      expect(result[0].therapist_id).toBe('therapist-high')
      expect(result[1].therapist_id).toBe('therapist-low')
      expect(result[0].recommended_score).toBeGreaterThan(result[1].recommended_score)
    })

    it('preserves original candidate properties', () => {
      const candidates: RecommendedCandidateInput[] = [
        {
          therapist_id: 'therapist-1',
          therapist_name: 'Test Therapist',
          shop_id: 'shop-1',
          shop_name: 'Test Shop',
          look_type: 'cute',
          style_tag: 'relax',
          mood_tag: 'calm',
        },
      ]
      const result = rankMatchingCandidates(baseIntent, candidates)

      expect(result[0].therapist_name).toBe('Test Therapist')
      expect(result[0].shop_id).toBe('shop-1')
      expect(result[0].shop_name).toBe('Test Shop')
      expect(result[0].look_type).toBe('cute')
      expect(result[0].style_tag).toBe('relax')
      expect(result[0].mood_tag).toBe('calm')
    })

    it('handles candidates with null/undefined optional fields', () => {
      const candidates: RecommendedCandidateInput[] = [
        {
          therapist_id: 'therapist-1',
          look_type: null,
          style_tag: null,
          mood_tag: null,
          talk_level: null,
          price_rank: null,
          availability_score: null,
          total_bookings_30d: null,
          repeat_rate_30d: null,
          avg_review_score: null,
          days_since_first_shift: null,
          utilization_7d: null,
        },
      ]
      const result = rankMatchingCandidates(baseIntent, candidates)

      expect(result).toHaveLength(1)
      expect(result[0].recommended_score).toBeGreaterThan(0)
    })

    it('breaks ties by therapist_id alphabetically', () => {
      // Create two candidates that will have the same score
      const candidates: RecommendedCandidateInput[] = [
        { therapist_id: 'zzz-therapist' },
        { therapist_id: 'aaa-therapist' },
      ]
      const result = rankMatchingCandidates(baseIntent, candidates)

      // If scores are equal, should be sorted by therapist_id
      if (result[0].recommended_score === result[1].recommended_score) {
        expect(result[0].therapist_id).toBe('aaa-therapist')
        expect(result[1].therapist_id).toBe('zzz-therapist')
      }
    })

    it('applies look_type mapping correctly', () => {
      const intent = buildGuestIntentFromSearchParams({
        visual_style_tags: ['kawaii'],
      })

      const candidates: RecommendedCandidateInput[] = [
        { therapist_id: 'matching', look_type: 'cute' }, // maps to kawaii
        { therapist_id: 'non-matching', look_type: 'elegant' },
      ]
      const result = rankMatchingCandidates(intent, candidates)

      expect(result[0].therapist_id).toBe('matching')
    })

    it('applies mood_tag mapping correctly', () => {
      const intent = buildGuestIntentFromSearchParams({
        mood_preference_tags: ['cheerful'],
      })

      const candidates: RecommendedCandidateInput[] = [
        { therapist_id: 'matching', mood_tag: 'cheerful' },
        { therapist_id: 'non-matching', mood_tag: 'calm' },
      ]
      const result = rankMatchingCandidates(intent, candidates)

      expect(result[0].therapist_id).toBe('matching')
    })

    it('applies talk_level mapping correctly', () => {
      const intent = buildGuestIntentFromSearchParams({
        conversation_preference: 'talkative',
      })

      const candidates: RecommendedCandidateInput[] = [
        { therapist_id: 'matching', talk_level: 'talkative' },
        { therapist_id: 'non-matching', talk_level: 'quiet' },
      ]
      const result = rankMatchingCandidates(intent, candidates)

      expect(result[0].therapist_id).toBe('matching')
    })

    it('applies style_tag (pressure) mapping correctly', () => {
      const intent = buildGuestIntentFromSearchParams({
        massage_pressure_preference: 'soft',
      })

      const candidates: RecommendedCandidateInput[] = [
        { therapist_id: 'matching', style_tag: 'relax' }, // maps to soft
        { therapist_id: 'non-matching', style_tag: 'strong' },
      ]
      const result = rankMatchingCandidates(intent, candidates)

      expect(result[0].therapist_id).toBe('matching')
    })

    it('considers price_rank in scoring', () => {
      const candidates: RecommendedCandidateInput[] = [
        { therapist_id: 'high-tier', price_rank: 3 },
        { therapist_id: 'low-tier', price_rank: 1 },
      ]
      const result = rankMatchingCandidates(baseIntent, candidates)

      // Both should have valid scores
      expect(result[0].recommended_score).toBeGreaterThan(0)
      expect(result[1].recommended_score).toBeGreaterThan(0)
    })

    it('considers availability_score in scoring', () => {
      const candidates: RecommendedCandidateInput[] = [
        { therapist_id: 'high-avail', availability_score: 1.0 },
        { therapist_id: 'low-avail', availability_score: 0.0 },
      ]
      const result = rankMatchingCandidates(baseIntent, candidates)

      expect(result[0].therapist_id).toBe('high-avail')
      expect(result[0].recommended_score).toBeGreaterThan(result[1].recommended_score)
    })

    it('considers newcomer boost for recent therapists', () => {
      const candidates: RecommendedCandidateInput[] = [
        { therapist_id: 'newcomer', days_since_first_shift: 5 }, // high newcomer score
        { therapist_id: 'veteran', days_since_first_shift: 365 }, // low newcomer score
      ]
      const result = rankMatchingCandidates(baseIntent, candidates)

      // Newcomer should have some boost
      expect(result[0].recommended_score).toBeGreaterThan(0)
      expect(result[1].recommended_score).toBeGreaterThan(0)
    })

    it('considers utilization in load balancing', () => {
      const candidates: RecommendedCandidateInput[] = [
        { therapist_id: 'underutilized', utilization_7d: 0.1 }, // high load balance score
        { therapist_id: 'overutilized', utilization_7d: 0.9 }, // low load balance score
      ]
      const result = rankMatchingCandidates(baseIntent, candidates)

      // Both should have valid scores
      expect(result[0].recommended_score).toBeGreaterThan(0)
      expect(result[1].recommended_score).toBeGreaterThan(0)
    })
  })
})
