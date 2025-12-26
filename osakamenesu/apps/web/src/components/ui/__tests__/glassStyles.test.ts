import { describe, it, expect } from 'vitest'
import {
  GLASS_CARD_CLASS,
  GLASS_SELECT_BUTTON_CLASS,
  GLASS_SELECT_MENU_CLASS,
  GLASS_SELECT_OPTION_CLASS,
} from '../glassStyles'

describe('glassStyles', () => {
  describe('GLASS_CARD_CLASS', () => {
    it('is defined as a string', () => {
      expect(typeof GLASS_CARD_CLASS).toBe('string')
      expect(GLASS_CARD_CLASS.length).toBeGreaterThan(0)
    })

    it('contains backdrop-blur', () => {
      expect(GLASS_CARD_CLASS).toContain('backdrop-blur')
    })

    it('contains rounded corners', () => {
      expect(GLASS_CARD_CLASS).toContain('rounded-')
    })

    it('contains shadow', () => {
      expect(GLASS_CARD_CLASS).toContain('shadow-')
    })

    it('contains border styling', () => {
      expect(GLASS_CARD_CLASS).toContain('border')
    })

    it('contains bg-white with opacity', () => {
      expect(GLASS_CARD_CLASS).toContain('bg-white/')
    })
  })

  describe('GLASS_SELECT_BUTTON_CLASS', () => {
    it('is defined as a string', () => {
      expect(typeof GLASS_SELECT_BUTTON_CLASS).toBe('string')
      expect(GLASS_SELECT_BUTTON_CLASS.length).toBeGreaterThan(0)
    })

    it('contains rounded corners', () => {
      expect(GLASS_SELECT_BUTTON_CLASS).toContain('rounded-')
    })

    it('contains padding', () => {
      expect(GLASS_SELECT_BUTTON_CLASS).toContain('px-')
      expect(GLASS_SELECT_BUTTON_CLASS).toContain('py-')
    })

    it('contains font styling', () => {
      expect(GLASS_SELECT_BUTTON_CLASS).toContain('font-semibold')
    })

    it('contains focus-visible ring', () => {
      expect(GLASS_SELECT_BUTTON_CLASS).toContain('focus-visible:ring-')
    })
  })

  describe('GLASS_SELECT_MENU_CLASS', () => {
    it('is defined as a string', () => {
      expect(typeof GLASS_SELECT_MENU_CLASS).toBe('string')
      expect(GLASS_SELECT_MENU_CLASS.length).toBeGreaterThan(0)
    })

    it('contains max-height', () => {
      expect(GLASS_SELECT_MENU_CLASS).toContain('max-h-')
    })

    it('contains backdrop-blur', () => {
      expect(GLASS_SELECT_MENU_CLASS).toContain('backdrop-blur')
    })

    it('contains margin-top', () => {
      expect(GLASS_SELECT_MENU_CLASS).toContain('mt-')
    })
  })

  describe('GLASS_SELECT_OPTION_CLASS', () => {
    it('is defined as a string', () => {
      expect(typeof GLASS_SELECT_OPTION_CLASS).toBe('string')
      expect(GLASS_SELECT_OPTION_CLASS.length).toBeGreaterThan(0)
    })

    it('contains text size', () => {
      expect(GLASS_SELECT_OPTION_CLASS).toContain('text-sm')
    })
  })

  describe('consistency', () => {
    it('all constants use brand-primary for focus rings', () => {
      const hasRing = GLASS_SELECT_BUTTON_CLASS.includes('ring-brand-primary')
      expect(hasRing).toBe(true)
    })
  })
})
