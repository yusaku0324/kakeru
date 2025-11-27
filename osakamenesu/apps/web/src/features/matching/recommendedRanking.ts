import {
  buildGuestIntentFromSearchParams,
  rankMatchingCandidates,
  type RecommendedCandidateInput,
} from '../../../../../src/matching/recommendedSearch'

export type MatchingSearchParams = {
  area?: string
  date?: string
  time_from?: string
  time_to?: string
}

export type MatchingCandidateLike = {
  therapist_id?: string
  id?: string
  therapist_name?: string
  name?: string
  shop_id?: string
  shop_name?: string
  summary?: string | null
  slots?: { start_at: string; end_at: string }[]
  look_type?: string | null
  style_tag?: string | null
  mood_tag?: string | null
  talk_level?: string | null
  price_rank?: number | null
  availability?: { is_available: boolean | null; rejected_reasons?: string[] }
  availability_score?: number | null
  total_bookings_30d?: number | null
  repeat_rate_30d?: number | null
  avg_review_score?: number | null
  days_since_first_shift?: number | null
  utilization_7d?: number | null
}

export function mapCandidateToRecommendedInput(
  raw: MatchingCandidateLike,
): RecommendedCandidateInput {
  const availabilityScore = (() => {
    if (raw.availability && typeof raw.availability.is_available === 'boolean') {
      return raw.availability.is_available ? 1 : 0
    }
    return raw.availability_score ?? null
  })()

  return {
    therapist_id: raw.therapist_id || raw.id || '',
    therapist_name: raw.therapist_name || raw.name,
    shop_id: raw.shop_id,
    shop_name: raw.shop_name,
    look_type: raw.look_type ?? null,
    style_tag: raw.style_tag ?? null,
    mood_tag: raw.mood_tag ?? null,
    talk_level: raw.talk_level ?? null,
    price_rank: raw.price_rank ?? null,
    availability_score: availabilityScore,
    total_bookings_30d: raw.total_bookings_30d ?? null,
    repeat_rate_30d: raw.repeat_rate_30d ?? null,
    avg_review_score: raw.avg_review_score ?? null,
    days_since_first_shift: raw.days_since_first_shift ?? null,
    utilization_7d: raw.utilization_7d ?? null,
  }
}

export function rerankMatchingCandidates(
  params: MatchingSearchParams,
  items: MatchingCandidateLike[],
) {
  const guestIntent = buildGuestIntentFromSearchParams({
    area: params.area ?? null,
    date: params.date ?? null,
    time_from: params.time_from ?? null,
    time_to: params.time_to ?? null,
  })

  const ranked = rankMatchingCandidates(
    guestIntent,
    items.map((item) => mapCandidateToRecommendedInput(item)),
  )

  return ranked.map((rankedItem) => {
    const original = items.find(
      (item) => (item.therapist_id || item.id) === rankedItem.therapist_id,
    )

    return {
      ...rankedItem,
      therapist_name:
        rankedItem.therapist_name || original?.therapist_name || original?.name || '',
      shop_id: rankedItem.shop_id || original?.shop_id,
      shop_name: rankedItem.shop_name || original?.shop_name,
      availability: original?.availability,
      summary: original?.summary,
      slots: original?.slots,
    }
  })
}
