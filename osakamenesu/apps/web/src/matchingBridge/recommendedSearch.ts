import {
  type ConversationStyle,
  type GuestIntent,
  type MassagePressure,
  type MoodTag,
  type TherapistProfile,
  type VisualStyleTag,
  recommendedScore,
} from './recommendedScore'

export type SearchParams = {
  area?: string | null
  date?: string | null
  time_from?: string | null
  time_to?: string | null
  price_min?: number | null
  price_max?: number | null
  shop_id?: string | null
  visual_style_tags?: VisualStyleTag[]
  conversation_preference?: ConversationStyle | null
  massage_pressure_preference?: MassagePressure | null
  mood_preference_tags?: MoodTag[]
  raw_text?: string | null
}

export type RecommendedCandidateInput = {
  therapist_id: string
  therapist_name?: string
  shop_id?: string
  shop_name?: string
  look_type?: string | null
  style_tag?: string | null
  mood_tag?: string | null
  talk_level?: string | null
  price_rank?: number | null
  availability_score?: number | null
  total_bookings_30d?: number | null
  repeat_rate_30d?: number | null
  avg_review_score?: number | null
  days_since_first_shift?: number | null
  utilization_7d?: number | null
}

export type RankedCandidate = RecommendedCandidateInput & {
  recommended_score: number
}

const LOOK_TYPE_MAP: Record<string, VisualStyleTag> = {
  cute: 'kawaii',
  kawaii: 'kawaii',
  baby_face: 'baby_face',
  natural: 'natural',
  oneesan: 'oneesan',
  beauty: 'elegant',
  elegant: 'elegant',
  cool: 'cool_beauty',
  cool_beauty: 'cool_beauty',
  gal: 'gal',
}

const MOOD_TAG_MAP: Record<string, MoodTag> = {
  cheerful: 'cheerful',
  calm: 'calm',
  healing: 'healing',
  friendly: 'playful',
  playful: 'playful',
  energetic: 'cheerful',
  mature: 'oneesan_mood',
  oneesan_mood: 'oneesan_mood',
}

function normalizeConversation(input?: string | null): ConversationStyle {
  const lowered = input?.toLowerCase()
  if (lowered === 'talkative') return 'talkative'
  if (lowered === 'quiet') return 'quiet'
  return 'normal'
}

function normalizePressure(input?: string | null): MassagePressure {
  const lowered = input?.toLowerCase()
  if (lowered === 'strong') return 'strong'
  if (lowered === 'relax' || lowered === 'soft') return 'soft'
  return 'medium'
}

function normalizeMood(tag?: string | null): MoodTag[] {
  if (!tag) return []
  const mapped = MOOD_TAG_MAP[tag.toLowerCase()]
  return mapped ? [mapped] : []
}

function normalizeVisual(tag?: string | null): VisualStyleTag[] {
  if (!tag) return []
  const mapped = LOOK_TYPE_MAP[tag.toLowerCase()]
  return mapped ? [mapped] : []
}

function toPriceTier(price_rank?: number | null): number {
  if (price_rank === null || price_rank === undefined) return 2
  if (price_rank <= 1) return 1
  if (price_rank >= 3) return 3
  return price_rank
}

function toTherapistProfile(candidate: RecommendedCandidateInput): TherapistProfile {
  return {
    therapist_id: candidate.therapist_id,
    visual_style_tags: normalizeVisual(candidate.look_type),
    conversation_style: normalizeConversation(candidate.talk_level),
    massage_pressure: normalizePressure(candidate.style_tag),
    mood_tags: normalizeMood(candidate.mood_tag),
    total_bookings_30d: candidate.total_bookings_30d ?? 0,
    repeat_rate_30d: candidate.repeat_rate_30d ?? 0,
    avg_review_score: candidate.avg_review_score ?? 0,
    price_tier: toPriceTier(candidate.price_rank),
    days_since_first_shift: candidate.days_since_first_shift ?? 180,
    utilization_7d: candidate.utilization_7d ?? 0.5,
    availability_score: candidate.availability_score ?? 0.5,
  }
}

export function buildGuestIntentFromSearchParams(params: SearchParams): GuestIntent {
  return {
    area: params.area ?? null,
    date: params.date ?? null,
    time_from: params.time_from ?? null,
    time_to: params.time_to ?? null,
    price_min: params.price_min ?? null,
    price_max: params.price_max ?? null,
    shop_id: params.shop_id ?? null,
    visual_style_tags: params.visual_style_tags ?? [],
    conversation_preference: params.conversation_preference ?? null,
    massage_pressure_preference: params.massage_pressure_preference ?? null,
    mood_preference_tags: params.mood_preference_tags ?? [],
    raw_text: params.raw_text ?? '',
  }
}

export function rankMatchingCandidates(
  guestIntent: GuestIntent,
  candidates: RecommendedCandidateInput[],
): RankedCandidate[] {
  return candidates
    .map((c) => {
      const profile = toTherapistProfile(c)
      const score = recommendedScore(guestIntent, profile)
      return { ...c, recommended_score: score }
    })
    .sort((a, b) => {
      if (b.recommended_score !== a.recommended_score) {
        return b.recommended_score - a.recommended_score
      }
      return a.therapist_id.localeCompare(b.therapist_id)
    })
}
