import { describe, it, expect } from 'vitest'
import {
  mapCandidateToRecommendedInput,
  type MatchingCandidateLike,
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
})
