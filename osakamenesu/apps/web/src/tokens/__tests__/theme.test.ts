import { describe, it, expect } from 'vitest'
import {
  spacing,
  radius,
  shadow,
  color,
  instinctKindToLabel,
  instinctKindToEmoji,
  instinctKindClasses,
  INSTINCT_KINDS,
  theme,
  type InstinctKind,
} from '../theme'

describe('theme tokens', () => {
  describe('spacing', () => {
    it('has all expected sizes', () => {
      expect(spacing.xs).toBe('4px')
      expect(spacing.sm).toBe('8px')
      expect(spacing.md).toBe('16px')
      expect(spacing.lg).toBe('24px')
      expect(spacing.xl).toBe('32px')
      expect(spacing['2xl']).toBe('48px')
    })
  })

  describe('radius', () => {
    it('has all expected sizes', () => {
      expect(radius.xs).toBe('4px')
      expect(radius.sm).toBe('8px')
      expect(radius.md).toBe('12px')
      expect(radius.lg).toBe('16px')
      expect(radius.xl).toBe('24px')
      expect(radius.full).toBe('9999px')
    })
  })

  describe('shadow', () => {
    it('has all expected shadows', () => {
      expect(shadow.soft).toContain('rgba')
      expect(shadow.subtle).toContain('rgba')
      expect(shadow.inner).toContain('inset')
    })
  })

  describe('color', () => {
    it('has base colors', () => {
      expect(color.base.bg).toBe('#FAFAF9')
      expect(color.base.surface).toBe('#FFFFFF')
    })

    it('has text colors', () => {
      expect(color.text.textMain).toBe('#1C1917')
      expect(color.text.textMuted).toBe('#57534E')
    })

    it('has accent colors', () => {
      expect(color.accent.accent).toBe('#3B82F6')
    })

    it('has border colors', () => {
      expect(color.border.borderSoft).toBe('#E7E5E4')
    })
  })

  describe('INSTINCT_KINDS', () => {
    it('contains all 6 instinct types', () => {
      expect(INSTINCT_KINDS).toHaveLength(6)
      expect(INSTINCT_KINDS).toContain('relax')
      expect(INSTINCT_KINDS).toContain('talk')
      expect(INSTINCT_KINDS).toContain('reset')
      expect(INSTINCT_KINDS).toContain('excitement')
      expect(INSTINCT_KINDS).toContain('healing')
      expect(INSTINCT_KINDS).toContain('quiet')
    })
  })

  describe('instinctKindToLabel', () => {
    it('has labels for all instinct types', () => {
      INSTINCT_KINDS.forEach((kind) => {
        expect(instinctKindToLabel[kind]).toBeDefined()
        expect(typeof instinctKindToLabel[kind]).toBe('string')
        expect(instinctKindToLabel[kind].length).toBeGreaterThan(0)
      })
    })

    it('has correct label for relax', () => {
      expect(instinctKindToLabel.relax).toBe('とにかく癒されたい')
    })

    it('has correct label for talk', () => {
      expect(instinctKindToLabel.talk).toBe('たくさん喋りたい')
    })
  })

  describe('instinctKindToEmoji', () => {
    it('has emojis for all instinct types', () => {
      INSTINCT_KINDS.forEach((kind) => {
        expect(instinctKindToEmoji[kind]).toBeDefined()
        expect(typeof instinctKindToEmoji[kind]).toBe('string')
      })
    })

    it('has correct emoji for relax', () => {
      expect(instinctKindToEmoji.relax).toBe('🌿')
    })

    it('has correct emoji for talk', () => {
      expect(instinctKindToEmoji.talk).toBe('💬')
    })
  })

  describe('instinctKindClasses', () => {
    it('has active and inactive classes for all instinct types', () => {
      INSTINCT_KINDS.forEach((kind) => {
        expect(instinctKindClasses[kind]).toBeDefined()
        expect(instinctKindClasses[kind].active).toBeDefined()
        expect(instinctKindClasses[kind].inactive).toBeDefined()
      })
    })

    it('active classes contain bg and text styles', () => {
      INSTINCT_KINDS.forEach((kind) => {
        expect(instinctKindClasses[kind].active).toContain('bg-')
        expect(instinctKindClasses[kind].active).toContain('text-')
      })
    })

    it('inactive classes contain hover styles', () => {
      INSTINCT_KINDS.forEach((kind) => {
        expect(instinctKindClasses[kind].inactive).toContain('hover:')
      })
    })
  })

  describe('theme object', () => {
    it('contains all token categories', () => {
      expect(theme.spacing).toBeDefined()
      expect(theme.radius).toBeDefined()
      expect(theme.shadow).toBeDefined()
      expect(theme.color).toBeDefined()
      expect(theme.instinct).toBeDefined()
    })

    it('instinct property contains all mappings', () => {
      expect(theme.instinct.kinds).toEqual(INSTINCT_KINDS)
      expect(theme.instinct.labels).toEqual(instinctKindToLabel)
      expect(theme.instinct.emojis).toEqual(instinctKindToEmoji)
      expect(theme.instinct.classes).toEqual(instinctKindClasses)
    })
  })
})
