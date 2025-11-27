import { describe, expect, it } from 'vitest'

import {
  buildGuestIntentFromSearchParams,
  rankMatchingCandidates,
  type RecommendedCandidateInput,
} from './recommendedSearch'

const intent = buildGuestIntentFromSearchParams({
  visual_style_tags: ['cool_beauty'],
  conversation_preference: 'quiet',
  massage_pressure_preference: 'soft',
  mood_preference_tags: ['calm'],
})

describe('rankMatchingCandidates', () => {
  it('prefers high-affinity newcomer over popular veteran', () => {
    const candidates: RecommendedCandidateInput[] = [
      {
        therapist_id: 'popular-vet',
        therapist_name: '人気ベテラン',
        look_type: 'kawaii',
        talk_level: 'talkative',
        style_tag: 'strong',
        mood_tag: 'cheerful',
        total_bookings_30d: 120,
        repeat_rate_30d: 0.85,
        avg_review_score: 4.8,
        price_rank: 3,
        days_since_first_shift: 500,
        utilization_7d: 0.9,
        availability_score: 0.6,
      },
      {
        therapist_id: 'affinity-newbie',
        therapist_name: '相性ドンピシャ新人',
        look_type: 'cool',
        talk_level: 'quiet',
        style_tag: 'relax',
        mood_tag: 'calm',
        total_bookings_30d: 8,
        repeat_rate_30d: 0.2,
        avg_review_score: 4.2,
        price_rank: 2,
        days_since_first_shift: 5,
        utilization_7d: 0.2,
        availability_score: 0.6,
      },
    ]

    const ranked = rankMatchingCandidates(intent, candidates)
    expect(ranked[0].therapist_id).toBe('affinity-newbie')
    expect(ranked[1].therapist_id).toBe('popular-vet')
  })

  it('reflects availability_factor without overwhelming other scores', () => {
    const base: RecommendedCandidateInput = {
      therapist_id: 'base',
      look_type: 'cool',
      talk_level: 'quiet',
      style_tag: 'relax',
      mood_tag: 'calm',
      total_bookings_30d: 10,
      repeat_rate_30d: 0.4,
      avg_review_score: 4.3,
      price_rank: 2,
      days_since_first_shift: 40,
      utilization_7d: 0.4,
    }

    const lowAvail = { ...base, therapist_id: 'low-avail', availability_score: 0 }
    const highAvail = { ...base, therapist_id: 'high-avail', availability_score: 1 }

    const ranked = rankMatchingCandidates(intent, [lowAvail, highAvail])
    expect(ranked[0].therapist_id).toBe('high-avail')
    const ratio = ranked[0].recommended_score / ranked[1].recommended_score
    expect(ratio).toBeLessThan(1.2)
  })

  it('falls back to id ordering when scores tie', () => {
    const a: RecommendedCandidateInput = {
      therapist_id: 'a-therapist',
      look_type: 'natural',
      mood_tag: 'calm',
    }
    const b: RecommendedCandidateInput = {
      therapist_id: 'b-therapist',
      look_type: 'natural',
      mood_tag: 'calm',
    }

    const ranked = rankMatchingCandidates(intent, [b, a])
    expect(ranked.map((r) => r.therapist_id)).toEqual(['a-therapist', 'b-therapist'])
  })
})
