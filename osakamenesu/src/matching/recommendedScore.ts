export type ConversationStyle = 'talkative' | 'normal' | 'quiet'
export type MassagePressure = 'soft' | 'medium' | 'strong'
export type MoodTag =
  | 'cheerful'
  | 'calm'
  | 'healing'
  | 'oneesan_mood'
  | 'playful'
export type VisualStyleTag =
  | 'baby_face'
  | 'kawaii'
  | 'natural'
  | 'oneesan'
  | 'cool_beauty'
  | 'gal'
  | 'elegant'

export type GuestIntent = {
  area: string | null
  date: string | null
  time_from: string | null
  time_to: string | null
  price_min: number | null
  price_max: number | null
  shop_id: string | null
  visual_style_tags: VisualStyleTag[]
  conversation_preference: ConversationStyle | null
  massage_pressure_preference: MassagePressure | null
  mood_preference_tags: MoodTag[]
  raw_text: string
}

export type TherapistProfile = {
  therapist_id: string
  visual_style_tags: VisualStyleTag[]
  conversation_style: ConversationStyle
  massage_pressure: MassagePressure
  mood_tags: MoodTag[]
  total_bookings_30d: number
  repeat_rate_30d: number
  avg_review_score: number
  price_tier: number
  days_since_first_shift: number
  utilization_7d: number
  availability_score: number
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

function normalizeBookings(total: number): number {
  // TODO: adjust saturation threshold based on real booking distribution
  const saturated = total / 50 // assume 50件で上限近く
  return clamp01(saturated)
}

function normalizeReview(avg: number): number {
  // assume 1〜5 を 0〜1 に線形マッピング
  return clamp01((avg - 1) / 4)
}

function normalizePriceTier(tier: number): number {
  // assume 1〜3 程度の段階を 0〜1 にマッピング
  return clamp01((tier - 1) / 2)
}

export function computeFaceTagMatchScore(
  userTags: VisualStyleTag[],
  therapistTags: VisualStyleTag[],
): number {
  if (userTags.length === 0 || therapistTags.length === 0) {
    return 0.5
  }

  const setUser = new Set(userTags)
  const setTherapist = new Set(therapistTags)

  let intersectionCount = 0
  for (const tag of setUser) {
    if (setTherapist.has(tag)) intersectionCount++
  }

  const maxPossible = Math.min(setUser.size, setTherapist.size)
  if (maxPossible === 0) return 0

  return intersectionCount / maxPossible
}

function conversationMatchScore(pref: ConversationStyle | null, actual: ConversationStyle): number {
  if (!pref) return 0.5
  if (pref === actual) return 1

  if (
    (pref === 'talkative' && actual === 'normal') ||
    (pref === 'normal' && actual === 'talkative') ||
    (pref === 'quiet' && actual === 'normal') ||
    (pref === 'normal' && actual === 'quiet')
  ) {
    return 0.7
  }

  return 0.3
}

function pressureMatchScore(pref: MassagePressure | null, actual: MassagePressure): number {
  if (!pref) return 0.5
  if (pref === actual) return 1

  if (
    (pref === 'soft' && actual === 'medium') ||
    (pref === 'medium' && actual === 'soft') ||
    (pref === 'medium' && actual === 'strong') ||
    (pref === 'strong' && actual === 'medium')
  ) {
    return 0.7
  }

  return 0.3
}

function moodMatchScore(prefTags: MoodTag[], actualTags: MoodTag[]): number {
  if (prefTags.length === 0 || actualTags.length === 0) {
    return 0.5
  }

  const prefSet = new Set(prefTags)
  const actSet = new Set(actualTags)

  let intersection = 0
  for (const t of prefSet) {
    if (actSet.has(t)) intersection++
  }

  const maxPossible = Math.min(prefSet.size, actSet.size)
  if (maxPossible === 0) return 0.3

  const raw = intersection / maxPossible
  return 0.3 + 0.7 * raw
}

export function styleMatchScore(intent: GuestIntent, profile: TherapistProfile): number {
  const conv = conversationMatchScore(intent.conversation_preference, profile.conversation_style)
  const press = pressureMatchScore(intent.massage_pressure_preference, profile.massage_pressure)
  const mood = moodMatchScore(intent.mood_preference_tags, profile.mood_tags)

  const wConv = 0.4
  const wPress = 0.3
  const wMood = 0.3

  return wConv * conv + wPress * press + wMood * mood
}

export function affinityScore(intent: GuestIntent, profile: TherapistProfile): number {
  const look = computeFaceTagMatchScore(intent.visual_style_tags, profile.visual_style_tags)
  const style = styleMatchScore(intent, profile)

  const wLook = 0.5
  const wStyle = 0.5

  return wLook * look + wStyle * style
}

export function popularityScore(profile: TherapistProfile): number {
  const b = normalizeBookings(profile.total_bookings_30d)
  const r = clamp01(profile.repeat_rate_30d)
  const rev = normalizeReview(profile.avg_review_score)
  const tier = normalizePriceTier(profile.price_tier)

  const raw = 0.4 * b + 0.3 * r + 0.2 * rev + 0.1 * tier
  return Math.sqrt(clamp01(raw))
}

export function newcomerScore(daysSinceFirstShift: number): number {
  if (daysSinceFirstShift <= 7) return 0.9
  if (daysSinceFirstShift <= 30) return 0.6
  if (daysSinceFirstShift <= 90) return 0.3
  return 0.1
}

export function loadBalanceScore(utilization_7d: number): number {
  const u = clamp01(utilization_7d)
  return 1 - u
}

export function fairnessScore(profile: TherapistProfile): number {
  const newcomer = newcomerScore(profile.days_since_first_shift)
  const load = loadBalanceScore(profile.utilization_7d)

  const wNewcomer = 0.5
  const wLoad = 0.5

  return wNewcomer * newcomer + wLoad * load
}

export function availabilityFactor(availability_score: number): number {
  const a = clamp01(availability_score)
  const minFactor = 0.9
  const maxFactor = 1.05

  return minFactor + (maxFactor - minFactor) * a
}

export function userFitScore(intent: GuestIntent, profile: TherapistProfile): number {
  const affinity = affinityScore(intent, profile)
  const popularity = popularityScore(profile)

  const wAffinity = 0.7
  const wPopularity = 0.3

  return wAffinity * affinity + wPopularity * popularity
}

export function recommendedScore(intent: GuestIntent, profile: TherapistProfile): number {
  const user_fit = userFitScore(intent, profile)
  const fair = fairnessScore(profile)
  const availFac = availabilityFactor(profile.availability_score)

  const wUser = 0.8
  const wFair = 0.2

  const base = wUser * user_fit + wFair * fair
  const clampedBase = clamp01(base)

  return clampedBase * availFac
}

export const __testUtils = {
  clamp01,
  normalizeBookings,
  normalizeReview,
  normalizePriceTier,
}
