import { describe, it, expect } from 'vitest'
import {
  AREA_ORDER,
  numberFormatter,
  BUST_SIZES,
  BUST_MIN_INDEX,
  BUST_MAX_INDEX,
  AGE_MIN,
  AGE_MAX_LIMIT,
  AGE_DEFAULT_MAX,
  HEIGHT_MIN,
  HEIGHT_MAX_LIMIT,
  HEIGHT_DEFAULT_MAX,
  DEFAULT_TAG,
  HAIR_COLOR_OPTIONS,
  HAIR_STYLE_OPTIONS,
  BODY_TYPE_OPTIONS,
  TAB_VALUE_SET,
  AREA_SELECT_OPTIONS_DEFAULT,
  SERVICE_SELECT_OPTIONS,
  SORT_SELECT_OPTIONS,
  buildHighlightStyle,
} from '../searchFiltersConstants'

describe('searchFiltersConstants', () => {
  describe('AREA_ORDER', () => {
    it('contains expected areas', () => {
      expect(AREA_ORDER).toContain('難波/日本橋')
      expect(AREA_ORDER).toContain('梅田')
      expect(AREA_ORDER).toContain('心斎橋')
    })

    it('has correct length', () => {
      expect(AREA_ORDER.length).toBe(13)
    })
  })

  describe('numberFormatter', () => {
    it('formats numbers in Japanese locale', () => {
      expect(numberFormatter.format(1234)).toBe('1,234')
      expect(numberFormatter.format(1000000)).toBe('1,000,000')
    })
  })

  describe('BUST_SIZES', () => {
    it('contains all letters A-Z', () => {
      expect(BUST_SIZES).toHaveLength(26)
      expect(BUST_SIZES[0]).toBe('A')
      expect(BUST_SIZES[25]).toBe('Z')
    })

    it('has correct min and max indices', () => {
      expect(BUST_MIN_INDEX).toBe(0)
      expect(BUST_MAX_INDEX).toBe(25)
    })
  })

  describe('AGE constants', () => {
    it('has correct age boundaries', () => {
      expect(AGE_MIN).toBe(18)
      expect(AGE_MAX_LIMIT).toBe(65)
      expect(AGE_DEFAULT_MAX).toBe(35)
    })

    it('default max is within limits', () => {
      expect(AGE_DEFAULT_MAX).toBeGreaterThanOrEqual(AGE_MIN)
      expect(AGE_DEFAULT_MAX).toBeLessThanOrEqual(AGE_MAX_LIMIT)
    })
  })

  describe('HEIGHT constants', () => {
    it('has correct height boundaries', () => {
      expect(HEIGHT_MIN).toBe(145)
      expect(HEIGHT_MAX_LIMIT).toBe(190)
      expect(HEIGHT_DEFAULT_MAX).toBe(175)
    })

    it('default max is within limits', () => {
      expect(HEIGHT_DEFAULT_MAX).toBeGreaterThanOrEqual(HEIGHT_MIN)
      expect(HEIGHT_DEFAULT_MAX).toBeLessThanOrEqual(HEIGHT_MAX_LIMIT)
    })
  })

  describe('DEFAULT_TAG', () => {
    it('has correct value', () => {
      expect(DEFAULT_TAG).toBe('指定なし')
    })
  })

  describe('HAIR_COLOR_OPTIONS', () => {
    it('starts with default tag', () => {
      expect(HAIR_COLOR_OPTIONS[0]).toBe(DEFAULT_TAG)
    })

    it('contains expected colors', () => {
      expect(HAIR_COLOR_OPTIONS).toContain('黒髪')
      expect(HAIR_COLOR_OPTIONS).toContain('茶髪')
      expect(HAIR_COLOR_OPTIONS).toContain('金髪')
    })
  })

  describe('HAIR_STYLE_OPTIONS', () => {
    it('starts with default tag', () => {
      expect(HAIR_STYLE_OPTIONS[0]).toBe(DEFAULT_TAG)
    })

    it('contains expected styles', () => {
      expect(HAIR_STYLE_OPTIONS).toContain('ロング')
      expect(HAIR_STYLE_OPTIONS).toContain('ショート')
      expect(HAIR_STYLE_OPTIONS).toContain('ボブ')
    })
  })

  describe('BODY_TYPE_OPTIONS', () => {
    it('starts with default tag', () => {
      expect(BODY_TYPE_OPTIONS[0]).toBe(DEFAULT_TAG)
    })

    it('contains expected body types', () => {
      expect(BODY_TYPE_OPTIONS).toContain('スレンダー')
      expect(BODY_TYPE_OPTIONS).toContain('普通')
      expect(BODY_TYPE_OPTIONS).toContain('グラマー')
    })
  })

  describe('TAB_VALUE_SET', () => {
    it('contains expected tab values', () => {
      expect(TAB_VALUE_SET.has('all')).toBe(true)
      expect(TAB_VALUE_SET.has('therapists')).toBe(true)
      expect(TAB_VALUE_SET.has('shops')).toBe(true)
    })

    it('has correct size', () => {
      expect(TAB_VALUE_SET.size).toBe(3)
    })
  })

  describe('AREA_SELECT_OPTIONS_DEFAULT', () => {
    it('has empty value option', () => {
      expect(AREA_SELECT_OPTIONS_DEFAULT[0]).toEqual({ value: '', label: 'すべて' })
    })
  })

  describe('SERVICE_SELECT_OPTIONS', () => {
    it('contains all service types', () => {
      expect(SERVICE_SELECT_OPTIONS).toContainEqual({ value: '', label: 'すべて' })
      expect(SERVICE_SELECT_OPTIONS).toContainEqual({ value: 'store', label: '店舗型' })
      expect(SERVICE_SELECT_OPTIONS).toContainEqual({ value: 'dispatch', label: '派遣型' })
    })
  })

  describe('SORT_SELECT_OPTIONS', () => {
    it('contains recommended as first option', () => {
      expect(SORT_SELECT_OPTIONS[0]).toEqual({ value: 'recommended', label: 'おすすめ順' })
    })

    it('contains expected sort options', () => {
      const values = SORT_SELECT_OPTIONS.map((opt) => opt.value)
      expect(values).toContain('price_asc')
      expect(values).toContain('price_desc')
      expect(values).toContain('rating')
    })
  })

  describe('buildHighlightStyle', () => {
    it('calculates correct style for full range', () => {
      const style = buildHighlightStyle(0, 100, 0, 100)
      expect(style.left).toBe('0%')
      expect(style.right).toBe('0%')
    })

    it('calculates correct style for partial range', () => {
      const style = buildHighlightStyle(25, 75, 0, 100)
      expect(style.left).toBe('25%')
      expect(style.right).toBe('25%')
    })

    it('handles range at start', () => {
      const style = buildHighlightStyle(0, 50, 0, 100)
      expect(style.left).toBe('0%')
      expect(style.right).toBe('50%')
    })

    it('handles range at end', () => {
      const style = buildHighlightStyle(50, 100, 0, 100)
      expect(style.left).toBe('50%')
      expect(style.right).toBe('0%')
    })

    it('handles zero range', () => {
      const style = buildHighlightStyle(0, 0, 0, 0)
      expect(style.left).toBe('0%')
      expect(style.right).toBe('0%')
    })

    it('clamps values within bounds', () => {
      const style = buildHighlightStyle(-10, 150, 0, 100)
      expect(parseFloat(style.left)).toBeGreaterThanOrEqual(0)
      expect(parseFloat(style.right)).toBeGreaterThanOrEqual(0)
    })
  })
})
