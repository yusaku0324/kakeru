import { describe, expect, it } from 'vitest'

import {
  availabilityFactor,
  fairnessScore,
  popularityScore,
  recommendedScore,
  userFitScore,
  type GuestIntent,
  type TherapistProfile,
} from './recommendedScore'

function intent(overrides: Partial<GuestIntent> = {}): GuestIntent {
  return {
    area: null,
    date: null,
    time_from: null,
    time_to: null,
    price_min: null,
    price_max: null,
    shop_id: null,
    visual_style_tags: ['kawaii'],
    conversation_preference: 'talkative',
    massage_pressure_preference: 'medium',
    mood_preference_tags: ['cheerful'],
    raw_text: '',
    ...overrides,
  }
}

function profile(overrides: Partial<TherapistProfile> = {}): TherapistProfile {
  return {
    therapist_id: 't1',
    visual_style_tags: ['kawaii'],
    conversation_style: 'talkative',
    massage_pressure: 'medium',
    mood_tags: ['cheerful'],
    total_bookings_30d: 30,
    repeat_rate_30d: 0.5,
    avg_review_score: 4.0,
    price_tier: 2,
    days_since_first_shift: 100,
    utilization_7d: 0.5,
    availability_score: 0.5,
    ...overrides,
  }
}

describe('recommendedScore spec alignment', () => {
  it('prefers an affinity-strong newcomer over a very popular veteran', () => {
    const userIntent = intent()

    const veteran = profile({
      therapist_id: 'vet',
      total_bookings_30d: 80,
      repeat_rate_30d: 0.8,
      avg_review_score: 4.8,
      days_since_first_shift: 400,
      utilization_7d: 0.9,
      availability_score: 0.5,
    })

    const newcomer = profile({
      therapist_id: 'newbie',
      visual_style_tags: ['kawaii', 'natural'],
      mood_tags: ['cheerful', 'healing'],
      total_bookings_30d: 5,
      repeat_rate_30d: 0.2,
      avg_review_score: 4.0,
      days_since_first_shift: 5,
      utilization_7d: 0.1,
      availability_score: 0.5,
    })

    const scoreVeteran = recommendedScore(userIntent, veteran)
    const scoreNewcomer = recommendedScore(userIntent, newcomer)

    expect(scoreNewcomer).toBeGreaterThanOrEqual(scoreVeteran)
  })

  it('does not let popularity alone outrank a high-affinity profile', () => {
    const userIntent = intent({ visual_style_tags: ['cool_beauty'] })

    const popularLowAffinity = profile({
      therapist_id: 'pop',
      visual_style_tags: ['kawaii'],
      conversation_style: 'talkative',
      massage_pressure: 'strong',
      mood_tags: ['playful'],
      total_bookings_30d: 90,
      repeat_rate_30d: 0.9,
      avg_review_score: 4.9,
      price_tier: 3,
      days_since_first_shift: 300,
      utilization_7d: 0.8,
    })

    const highAffinityLowPop = profile({
      therapist_id: 'fit',
      visual_style_tags: ['cool_beauty'],
      conversation_style: 'normal',
      massage_pressure: 'medium',
      mood_tags: ['calm'],
      total_bookings_30d: 10,
      repeat_rate_30d: 0.3,
      avg_review_score: 4.2,
      price_tier: 2,
      days_since_first_shift: 40,
      utilization_7d: 0.2,
    })

    const scorePop = recommendedScore(userIntent, popularLowAffinity)
    const scoreFit = recommendedScore(userIntent, highAffinityLowPop)

    expect(scoreFit).toBeGreaterThan(scorePop)
  })

  it('availability factor stays within expected range', () => {
    const userIntent = intent()

    const baseProfile = profile({
      availability_score: 0.5,
    })

    const highAvail = { ...baseProfile, availability_score: 1.0 }
    const lowAvail = { ...baseProfile, availability_score: 0.0 }

    const scoreHigh = recommendedScore(userIntent, highAvail)
    const scoreLow = recommendedScore(userIntent, lowAvail)

    expect(scoreHigh).toBeGreaterThan(scoreLow)

    const ratio = scoreHigh / scoreLow
    expect(ratio).toBeLessThanOrEqual(1.2) // 約±10%〜15% の範囲に収まること
  })

  it('sanity: sub-scores respect weights and ranges', () => {
    const userIntent = intent()
    const prof = profile()

    const fit = userFitScore(userIntent, prof)
    const fairness = fairnessScore(prof)
    const popularity = popularityScore(prof)
    const avail = availabilityFactor(prof.availability_score)

    expect(fit).toBeGreaterThan(0)
    expect(fairness).toBeGreaterThan(0)
    expect(popularity).toBeGreaterThan(0)
    expect(avail).toBeGreaterThan(0.89)
    expect(avail).toBeLessThanOrEqual(1.05)
  })
})
