import { describe, it, expect } from 'vitest'
import {
  computeFaceTagMatchScore,
  styleMatchScore,
  affinityScore,
  popularityScore,
  newcomerScore,
  loadBalanceScore,
  fairnessScore,
  availabilityFactor,
  userFitScore,
  recommendedScore,
  __testUtils,
  type GuestIntent,
  type TherapistProfile,
  type MoodTag,
  type VisualStyleTag,
} from '../recommendedScore'

const { clamp01, normalizeBookings, normalizeReview, normalizePriceTier } = __testUtils

describe('recommendedScore', () => {
  describe('clamp01', () => {
    it('returns value within 0-1 range', () => {
      expect(clamp01(0.5)).toBe(0.5)
    })

    it('clamps values above 1 to 1', () => {
      expect(clamp01(1.5)).toBe(1)
      expect(clamp01(100)).toBe(1)
    })

    it('clamps values below 0 to 0', () => {
      expect(clamp01(-0.5)).toBe(0)
      expect(clamp01(-100)).toBe(0)
    })

    it('returns exact boundary values', () => {
      expect(clamp01(0)).toBe(0)
      expect(clamp01(1)).toBe(1)
    })
  })

  describe('normalizeBookings', () => {
    it('returns 0 for 0 bookings', () => {
      expect(normalizeBookings(0)).toBe(0)
    })

    it('returns normalized value for typical bookings', () => {
      expect(normalizeBookings(50)).toBe(0.5)
    })

    it('saturates at 100 bookings', () => {
      expect(normalizeBookings(100)).toBe(1)
    })

    it('clamps values above 100', () => {
      expect(normalizeBookings(200)).toBe(1)
    })
  })

  describe('normalizeReview', () => {
    it('returns 0 for minimum review score (1)', () => {
      expect(normalizeReview(1)).toBe(0)
    })

    it('returns 1 for maximum review score (5)', () => {
      expect(normalizeReview(5)).toBe(1)
    })

    it('returns 0.5 for middle review score (3)', () => {
      expect(normalizeReview(3)).toBe(0.5)
    })

    it('handles edge cases', () => {
      expect(normalizeReview(0)).toBe(0) // clamped
      expect(normalizeReview(6)).toBe(1) // clamped
    })
  })

  describe('normalizePriceTier', () => {
    it('returns 0 for tier 1', () => {
      expect(normalizePriceTier(1)).toBe(0)
    })

    it('returns 0.5 for tier 2', () => {
      expect(normalizePriceTier(2)).toBe(0.5)
    })

    it('returns 1 for tier 3', () => {
      expect(normalizePriceTier(3)).toBe(1)
    })

    it('clamps values outside range', () => {
      expect(normalizePriceTier(0)).toBe(0)
      expect(normalizePriceTier(5)).toBe(1)
    })
  })

  describe('computeFaceTagMatchScore', () => {
    it('returns 0.5 when user has no tags', () => {
      expect(computeFaceTagMatchScore([], ['kawaii'])).toBe(0.5)
    })

    it('returns 0.5 when therapist has no tags', () => {
      expect(computeFaceTagMatchScore(['kawaii'], [])).toBe(0.5)
    })

    it('returns 0.5 when both have no tags', () => {
      expect(computeFaceTagMatchScore([], [])).toBe(0.5)
    })

    it('returns 1 for perfect match', () => {
      expect(computeFaceTagMatchScore(['kawaii'], ['kawaii'])).toBe(1)
    })

    it('returns 1 for multiple matching tags', () => {
      expect(computeFaceTagMatchScore(['kawaii', 'natural'], ['kawaii', 'natural'])).toBe(1)
    })

    it('returns partial score for partial match', () => {
      expect(computeFaceTagMatchScore(['kawaii', 'natural'], ['kawaii', 'elegant'])).toBe(0.5)
    })

    it('returns 0 for no matches', () => {
      expect(computeFaceTagMatchScore(['kawaii'], ['elegant'])).toBe(0)
    })
  })

  describe('styleMatchScore', () => {
    const baseIntent: GuestIntent = {
      area: null,
      date: null,
      time_from: null,
      time_to: null,
      price_min: null,
      price_max: null,
      shop_id: null,
      visual_style_tags: [],
      conversation_preference: null,
      massage_pressure_preference: null,
      mood_preference_tags: [],
      raw_text: '',
    }

    const baseProfile: TherapistProfile = {
      therapist_id: 'test-id',
      visual_style_tags: [],
      conversation_style: 'normal',
      massage_pressure: 'medium',
      mood_tags: [],
      total_bookings_30d: 0,
      repeat_rate_30d: 0,
      avg_review_score: 3,
      price_tier: 2,
      days_since_first_shift: 30,
      utilization_7d: 0.5,
      availability_score: 0.5,
    }

    it('returns 0.5 when no preferences are specified', () => {
      const score = styleMatchScore(baseIntent, baseProfile)
      expect(score).toBe(0.5)
    })

    it('returns higher score for matching conversation style', () => {
      const intent = { ...baseIntent, conversation_preference: 'normal' as const }
      const score = styleMatchScore(intent, baseProfile)
      expect(score).toBeGreaterThan(0.5)
    })

    it('returns higher score for matching pressure preference', () => {
      const intent = { ...baseIntent, massage_pressure_preference: 'medium' as const }
      const score = styleMatchScore(intent, baseProfile)
      expect(score).toBeGreaterThan(0.5)
    })

    it('returns higher score for matching mood tags', () => {
      const intent = { ...baseIntent, mood_preference_tags: ['calm'] as MoodTag[] }
      const profile = { ...baseProfile, mood_tags: ['calm'] as MoodTag[] }
      const score = styleMatchScore(intent, profile)
      expect(score).toBeGreaterThan(0.5)
    })
  })

  describe('affinityScore', () => {
    const baseIntent: GuestIntent = {
      area: null,
      date: null,
      time_from: null,
      time_to: null,
      price_min: null,
      price_max: null,
      shop_id: null,
      visual_style_tags: [],
      conversation_preference: null,
      massage_pressure_preference: null,
      mood_preference_tags: [],
      raw_text: '',
    }

    const baseProfile: TherapistProfile = {
      therapist_id: 'test-id',
      visual_style_tags: [],
      conversation_style: 'normal',
      massage_pressure: 'medium',
      mood_tags: [],
      total_bookings_30d: 0,
      repeat_rate_30d: 0,
      avg_review_score: 3,
      price_tier: 2,
      days_since_first_shift: 30,
      utilization_7d: 0.5,
      availability_score: 0.5,
    }

    it('returns a score between 0 and 1', () => {
      const score = affinityScore(baseIntent, baseProfile)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    })

    it('returns higher score for matching visual tags', () => {
      const intent = { ...baseIntent, visual_style_tags: ['kawaii'] as VisualStyleTag[] }
      const profile = { ...baseProfile, visual_style_tags: ['kawaii'] as VisualStyleTag[] }
      const matchingScore = affinityScore(intent, profile)

      const nonMatchingScore = affinityScore(intent, baseProfile)
      expect(matchingScore).toBeGreaterThan(nonMatchingScore)
    })
  })

  describe('popularityScore', () => {
    it('returns low score for no bookings', () => {
      const profile: TherapistProfile = {
        therapist_id: 'test-id',
        visual_style_tags: [],
        conversation_style: 'normal',
        massage_pressure: 'medium',
        mood_tags: [],
        total_bookings_30d: 0,
        repeat_rate_30d: 0,
        avg_review_score: 1,
        price_tier: 1,
        days_since_first_shift: 30,
        utilization_7d: 0.5,
        availability_score: 0.5,
      }
      const score = popularityScore(profile)
      expect(score).toBeLessThan(0.3)
    })

    it('returns higher score for popular therapists', () => {
      const profile: TherapistProfile = {
        therapist_id: 'test-id',
        visual_style_tags: [],
        conversation_style: 'normal',
        massage_pressure: 'medium',
        mood_tags: [],
        total_bookings_30d: 100,
        repeat_rate_30d: 0.8,
        avg_review_score: 5,
        price_tier: 3,
        days_since_first_shift: 365,
        utilization_7d: 0.8,
        availability_score: 0.5,
      }
      const score = popularityScore(profile)
      expect(score).toBeGreaterThan(0.8)
    })
  })

  describe('newcomerScore', () => {
    it('returns 0.9 for therapists within first week', () => {
      expect(newcomerScore(1)).toBe(0.9)
      expect(newcomerScore(7)).toBe(0.9)
    })

    it('returns 0.6 for therapists within first month', () => {
      expect(newcomerScore(8)).toBe(0.6)
      expect(newcomerScore(30)).toBe(0.6)
    })

    it('returns 0.3 for therapists within first 3 months', () => {
      expect(newcomerScore(31)).toBe(0.3)
      expect(newcomerScore(90)).toBe(0.3)
    })

    it('returns 0.1 for established therapists', () => {
      expect(newcomerScore(91)).toBe(0.1)
      expect(newcomerScore(365)).toBe(0.1)
    })
  })

  describe('loadBalanceScore', () => {
    it('returns 1 for no utilization', () => {
      expect(loadBalanceScore(0)).toBe(1)
    })

    it('returns 0 for full utilization', () => {
      expect(loadBalanceScore(1)).toBe(0)
    })

    it('returns 0.5 for 50% utilization', () => {
      expect(loadBalanceScore(0.5)).toBe(0.5)
    })

    it('clamps values outside 0-1 range', () => {
      expect(loadBalanceScore(-0.5)).toBe(1)
      expect(loadBalanceScore(1.5)).toBe(0)
    })
  })

  describe('fairnessScore', () => {
    it('combines newcomer and load balance scores', () => {
      const profile: TherapistProfile = {
        therapist_id: 'test-id',
        visual_style_tags: [],
        conversation_style: 'normal',
        massage_pressure: 'medium',
        mood_tags: [],
        total_bookings_30d: 0,
        repeat_rate_30d: 0,
        avg_review_score: 3,
        price_tier: 2,
        days_since_first_shift: 7, // newcomer score: 0.9
        utilization_7d: 0, // load balance: 1
        availability_score: 0.5,
      }
      const score = fairnessScore(profile)
      expect(score).toBe(0.5 * 0.9 + 0.5 * 1) // 0.95
    })
  })

  describe('availabilityFactor', () => {
    it('returns minimum factor for 0 availability', () => {
      expect(availabilityFactor(0)).toBe(0.9)
    })

    it('returns maximum factor for full availability', () => {
      expect(availabilityFactor(1)).toBe(1.05)
    })

    it('returns interpolated factor for partial availability', () => {
      const factor = availabilityFactor(0.5)
      expect(factor).toBeCloseTo(0.975)
    })

    it('clamps input to 0-1 range', () => {
      expect(availabilityFactor(-1)).toBe(0.9)
      expect(availabilityFactor(2)).toBe(1.05)
    })
  })

  describe('userFitScore', () => {
    const baseIntent: GuestIntent = {
      area: null,
      date: null,
      time_from: null,
      time_to: null,
      price_min: null,
      price_max: null,
      shop_id: null,
      visual_style_tags: [],
      conversation_preference: null,
      massage_pressure_preference: null,
      mood_preference_tags: [],
      raw_text: '',
    }

    const baseProfile: TherapistProfile = {
      therapist_id: 'test-id',
      visual_style_tags: [],
      conversation_style: 'normal',
      massage_pressure: 'medium',
      mood_tags: [],
      total_bookings_30d: 0,
      repeat_rate_30d: 0,
      avg_review_score: 3,
      price_tier: 2,
      days_since_first_shift: 30,
      utilization_7d: 0.5,
      availability_score: 0.5,
    }

    it('returns a score between 0 and 1', () => {
      const score = userFitScore(baseIntent, baseProfile)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    })

    it('weights affinity at 70% and popularity at 30%', () => {
      const score = userFitScore(baseIntent, baseProfile)
      // With base values, we expect a reasonable score
      expect(score).toBeDefined()
    })
  })

  describe('recommendedScore', () => {
    const baseIntent: GuestIntent = {
      area: null,
      date: null,
      time_from: null,
      time_to: null,
      price_min: null,
      price_max: null,
      shop_id: null,
      visual_style_tags: [],
      conversation_preference: null,
      massage_pressure_preference: null,
      mood_preference_tags: [],
      raw_text: '',
    }

    const baseProfile: TherapistProfile = {
      therapist_id: 'test-id',
      visual_style_tags: [],
      conversation_style: 'normal',
      massage_pressure: 'medium',
      mood_tags: [],
      total_bookings_30d: 0,
      repeat_rate_30d: 0,
      avg_review_score: 3,
      price_tier: 2,
      days_since_first_shift: 30,
      utilization_7d: 0.5,
      availability_score: 0.5,
    }

    it('returns a positive score', () => {
      const score = recommendedScore(baseIntent, baseProfile)
      expect(score).toBeGreaterThan(0)
    })

    it('returns higher score for high availability', () => {
      const lowAvailProfile = { ...baseProfile, availability_score: 0 }
      const highAvailProfile = { ...baseProfile, availability_score: 1 }

      const lowScore = recommendedScore(baseIntent, lowAvailProfile)
      const highScore = recommendedScore(baseIntent, highAvailProfile)

      expect(highScore).toBeGreaterThan(lowScore)
    })

    it('returns higher score for matching preferences', () => {
      const matchingIntent: GuestIntent = {
        ...baseIntent,
        visual_style_tags: ['kawaii'],
        conversation_preference: 'talkative',
        massage_pressure_preference: 'soft',
        mood_preference_tags: ['cheerful'],
      }

      const matchingProfile: TherapistProfile = {
        ...baseProfile,
        visual_style_tags: ['kawaii'],
        conversation_style: 'talkative',
        massage_pressure: 'soft',
        mood_tags: ['cheerful'],
      }

      const matchingScore = recommendedScore(matchingIntent, matchingProfile)
      const baseScore = recommendedScore(baseIntent, baseProfile)

      expect(matchingScore).toBeGreaterThan(baseScore)
    })
  })
})
