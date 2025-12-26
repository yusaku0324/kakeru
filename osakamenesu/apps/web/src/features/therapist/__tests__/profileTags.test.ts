import { describe, it, expect } from 'vitest'
import {
  moodTagOptions,
  styleTagOptions,
  lookTypeOptions,
  contactStyleOptions,
  talkLevelOptions,
  normalizeHobbyTags,
  buildProfileTagDisplays,
  type ProfileTagValues,
} from '../profileTags'

describe('profileTags', () => {
  describe('tag option constants', () => {
    it('has moodTagOptions with correct structure', () => {
      expect(moodTagOptions).toHaveLength(4)
      expect(moodTagOptions[0]).toEqual({ value: 'calm', label: '落ち着いた' })
      expect(moodTagOptions.every((opt) => opt.value && opt.label)).toBe(true)
    })

    it('has styleTagOptions with correct structure', () => {
      expect(styleTagOptions).toHaveLength(3)
      expect(styleTagOptions[0]).toEqual({ value: 'relax', label: 'ゆったりリラックス' })
    })

    it('has lookTypeOptions with correct structure', () => {
      expect(lookTypeOptions).toHaveLength(6)
      expect(lookTypeOptions.find((opt) => opt.value === 'cute')).toEqual({
        value: 'cute',
        label: 'かわいい',
      })
    })

    it('has contactStyleOptions with correct structure', () => {
      expect(contactStyleOptions).toHaveLength(3)
      expect(contactStyleOptions.find((opt) => opt.value === 'standard')).toEqual({
        value: 'standard',
        label: 'ほどよい距離感',
      })
    })

    it('has talkLevelOptions with correct structure', () => {
      expect(talkLevelOptions).toHaveLength(3)
      expect(talkLevelOptions.find((opt) => opt.value === 'quiet')).toEqual({
        value: 'quiet',
        label: '静かめ',
      })
    })
  })

  describe('normalizeHobbyTags', () => {
    it('returns empty array for null input', () => {
      expect(normalizeHobbyTags(null)).toEqual([])
    })

    it('returns empty array for undefined input', () => {
      expect(normalizeHobbyTags(undefined)).toEqual([])
    })

    it('returns empty array for non-array input', () => {
      expect(normalizeHobbyTags('not an array' as unknown as string[])).toEqual([])
    })

    it('trims whitespace from tags', () => {
      expect(normalizeHobbyTags(['  reading  ', '  music  '])).toEqual(['reading', 'music'])
    })

    it('filters empty strings', () => {
      expect(normalizeHobbyTags(['valid', '', '  ', 'another'])).toEqual(['valid', 'another'])
    })

    it('handles non-string elements', () => {
      const input = ['valid', 123, null, 'another'] as unknown as string[]
      expect(normalizeHobbyTags(input)).toEqual(['valid', 'another'])
    })
  })

  describe('buildProfileTagDisplays', () => {
    it('returns empty array when no values provided', () => {
      expect(buildProfileTagDisplays({})).toEqual([])
    })

    it('builds display for mood_tag', () => {
      const values: ProfileTagValues = { mood_tag: 'calm' }
      const result = buildProfileTagDisplays(values)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ key: 'mood_tag', label: '雰囲気: 落ち着いた' })
    })

    it('builds display for style_tag', () => {
      const values: ProfileTagValues = { style_tag: 'relax' }
      const result = buildProfileTagDisplays(values)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ key: 'style_tag', label: '施術スタイル: ゆったりリラックス' })
    })

    it('builds display for look_type', () => {
      const values: ProfileTagValues = { look_type: 'cute' }
      const result = buildProfileTagDisplays(values)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ key: 'look_type', label: '印象: かわいい' })
    })

    it('builds display for contact_style', () => {
      const values: ProfileTagValues = { contact_style: 'standard' }
      const result = buildProfileTagDisplays(values)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ key: 'contact_style', label: '距離感: ほどよい距離感' })
    })

    it('excludes talk_level by default', () => {
      const values: ProfileTagValues = { talk_level: 'quiet' }
      const result = buildProfileTagDisplays(values)

      expect(result).toHaveLength(0)
    })

    it('includes talk_level when option is set', () => {
      const values: ProfileTagValues = { talk_level: 'quiet' }
      const result = buildProfileTagDisplays(values, { includeTalkLevel: true })

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ key: 'talk_level', label: '会話のテンポ: 静かめ' })
    })

    it('builds display for hobby_tags', () => {
      const values: ProfileTagValues = { hobby_tags: ['読書', '映画'] }
      const result = buildProfileTagDisplays(values)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ key: 'hobby-読書', label: '趣味: 読書' })
      expect(result[1]).toEqual({ key: 'hobby-映画', label: '趣味: 映画' })
    })

    it('skips null values', () => {
      const values: ProfileTagValues = {
        mood_tag: null,
        style_tag: 'relax',
        look_type: null,
      }
      const result = buildProfileTagDisplays(values)

      expect(result).toHaveLength(1)
      expect(result[0].key).toBe('style_tag')
    })

    it('skips empty string values', () => {
      const values: ProfileTagValues = {
        mood_tag: '',
        style_tag: 'relax',
      }
      const result = buildProfileTagDisplays(values)

      expect(result).toHaveLength(1)
    })

    it('skips whitespace-only values', () => {
      const values: ProfileTagValues = {
        mood_tag: '   ',
        style_tag: 'relax',
      }
      const result = buildProfileTagDisplays(values)

      expect(result).toHaveLength(1)
    })

    it('uses raw value when no option matches', () => {
      const values: ProfileTagValues = { mood_tag: 'unknown_value' }
      const result = buildProfileTagDisplays(values)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ key: 'mood_tag', label: '雰囲気: unknown_value' })
    })

    it('builds display for all tags combined', () => {
      const values: ProfileTagValues = {
        mood_tag: 'calm',
        style_tag: 'relax',
        look_type: 'cute',
        contact_style: 'standard',
        talk_level: 'quiet',
        hobby_tags: ['読書'],
      }
      const result = buildProfileTagDisplays(values, { includeTalkLevel: true })

      expect(result).toHaveLength(6)
      expect(result.map((r) => r.key)).toEqual([
        'mood_tag',
        'style_tag',
        'look_type',
        'contact_style',
        'talk_level',
        'hobby-読書',
      ])
    })
  })
})
