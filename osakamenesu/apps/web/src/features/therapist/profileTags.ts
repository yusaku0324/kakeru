export type ProfileTagOption = { value: string; label: string }

export const moodTagOptions: ProfileTagOption[] = [
  { value: 'calm', label: '落ち着いた' },
  { value: 'energetic', label: '元気・明るい' },
  { value: 'mature', label: '大人っぽい' },
  { value: 'friendly', label: '親しみやすい' },
]

export const styleTagOptions: ProfileTagOption[] = [
  { value: 'relax', label: 'ゆったりリラックス' },
  { value: 'strong', label: 'しっかり強め' },
  { value: 'exciting', label: '刺激的・ドキドキ' },
]

export const lookTypeOptions: ProfileTagOption[] = [
  { value: 'cute', label: 'かわいい' },
  { value: 'oneesan', label: 'お姉さん' },
  { value: 'beauty', label: 'キレイ系' },
  { value: 'gal', label: 'ギャル' },
  { value: 'natural', label: 'ナチュラル' },
  { value: 'cool', label: 'クール' },
]

export const contactStyleOptions: ProfileTagOption[] = [
  { value: 'strict', label: 'きっちり距離感' },
  { value: 'standard', label: 'ほどよい距離感' },
  { value: 'relaxed', label: 'フランク' },
]

export const talkLevelOptions: ProfileTagOption[] = [
  { value: 'quiet', label: '静かめ' },
  { value: 'normal', label: 'ふつう' },
  { value: 'talkative', label: 'よく話す' },
]

const PROFILE_TAG_OPTION_MAP = {
  mood_tag: moodTagOptions,
  style_tag: styleTagOptions,
  look_type: lookTypeOptions,
  contact_style: contactStyleOptions,
  talk_level: talkLevelOptions,
} as const

const PROFILE_TAG_LABELS: Record<keyof typeof PROFILE_TAG_OPTION_MAP, string> = {
  mood_tag: '雰囲気',
  style_tag: '施術スタイル',
  look_type: '印象',
  contact_style: '距離感',
  talk_level: '会話のテンポ',
}

export type ProfileTagValues = {
  mood_tag?: string | null
  style_tag?: string | null
  look_type?: string | null
  contact_style?: string | null
  talk_level?: string | null
  hobby_tags?: string[] | null
}

export type ProfileTagDisplay = { key: string; label: string }

function normalizeTagValue(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed || null
}

function mapOptionLabel(
  field: keyof typeof PROFILE_TAG_OPTION_MAP,
  value: string | null,
): string | null {
  const normalized = normalizeTagValue(value)
  if (!normalized) return null
  const match = PROFILE_TAG_OPTION_MAP[field].find((option) => option.value === normalized)
  return match?.label ?? normalized
}

export function normalizeHobbyTags(tags?: string[] | null): string[] {
  if (!Array.isArray(tags)) return []
  return tags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter(Boolean)
}

export function buildProfileTagDisplays(
  values: ProfileTagValues,
  options: { includeTalkLevel?: boolean } = {},
): ProfileTagDisplay[] {
  const items: ProfileTagDisplay[] = []
  const shouldIncludeTalk = options.includeTalkLevel ?? false

  const moodLabel = mapOptionLabel('mood_tag', values.mood_tag)
  if (moodLabel) {
    items.push({ key: 'mood_tag', label: `${PROFILE_TAG_LABELS.mood_tag}: ${moodLabel}` })
  }

  const styleLabel = mapOptionLabel('style_tag', values.style_tag)
  if (styleLabel) {
    items.push({ key: 'style_tag', label: `${PROFILE_TAG_LABELS.style_tag}: ${styleLabel}` })
  }

  const lookLabel = mapOptionLabel('look_type', values.look_type)
  if (lookLabel) {
    items.push({ key: 'look_type', label: `${PROFILE_TAG_LABELS.look_type}: ${lookLabel}` })
  }

  const contactLabel = mapOptionLabel('contact_style', values.contact_style)
  if (contactLabel) {
    items.push({
      key: 'contact_style',
      label: `${PROFILE_TAG_LABELS.contact_style}: ${contactLabel}`,
    })
  }

  if (shouldIncludeTalk) {
    const talkLabel = mapOptionLabel('talk_level', values.talk_level)
    if (talkLabel) {
      items.push({
        key: 'talk_level',
        label: `${PROFILE_TAG_LABELS.talk_level}: ${talkLabel}`,
      })
    }
  }

  const hobbies = normalizeHobbyTags(values.hobby_tags)
  hobbies.forEach((tag) => {
    items.push({ key: `hobby-${tag}`, label: `趣味: ${tag}` })
  })

  return items
}
