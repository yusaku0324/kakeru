import { describe, it, expect } from 'vitest'
import {
  isValidUUID,
  formatPhoneNumber,
  extractPhoneDigits,
  validatePhone,
  validateName,
  validateEmail,
  validateEmailRequired,
} from '../validation'

describe('validation utilities', () => {
  describe('isValidUUID', () => {
    it('returns true for valid UUID', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
    })

    it('returns true for uppercase UUID', () => {
      expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true)
    })

    it('returns false for invalid UUID format', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false)
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false)
      expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false)
    })

    it('returns false for null or undefined', () => {
      expect(isValidUUID(null)).toBe(false)
      expect(isValidUUID(undefined)).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(isValidUUID('')).toBe(false)
    })
  })

  describe('formatPhoneNumber', () => {
    it('returns digits only for 3 or fewer digits', () => {
      expect(formatPhoneNumber('090')).toBe('090')
      expect(formatPhoneNumber('09')).toBe('09')
    })

    it('formats 4-7 digits with one hyphen', () => {
      expect(formatPhoneNumber('0901')).toBe('090-1')
      expect(formatPhoneNumber('0901234')).toBe('090-1234')
    })

    it('formats 8+ digits with two hyphens', () => {
      expect(formatPhoneNumber('09012345678')).toBe('090-1234-5678')
      expect(formatPhoneNumber('0901234567')).toBe('090-1234-567')
    })

    it('removes non-digit characters', () => {
      expect(formatPhoneNumber('090-1234-5678')).toBe('090-1234-5678')
      expect(formatPhoneNumber('(090) 1234 5678')).toBe('090-1234-5678')
    })

    it('truncates to 11 digits', () => {
      expect(formatPhoneNumber('090123456789012')).toBe('090-1234-5678')
    })
  })

  describe('extractPhoneDigits', () => {
    it('extracts only digits from formatted phone', () => {
      expect(extractPhoneDigits('090-1234-5678')).toBe('09012345678')
    })

    it('handles various formats', () => {
      expect(extractPhoneDigits('(090) 1234-5678')).toBe('09012345678')
      expect(extractPhoneDigits('090 1234 5678')).toBe('09012345678')
    })

    it('returns empty string for no digits', () => {
      expect(extractPhoneDigits('abc')).toBe('')
    })
  })

  describe('validatePhone', () => {
    it('returns valid for 10-digit phone', () => {
      expect(validatePhone('0312345678')).toEqual({ valid: true })
    })

    it('returns valid for 11-digit phone', () => {
      expect(validatePhone('09012345678')).toEqual({ valid: true })
    })

    it('returns valid for 13-digit phone', () => {
      expect(validatePhone('0123456789012')).toEqual({ valid: true })
    })

    it('returns empty error for empty input', () => {
      expect(validatePhone('')).toEqual({ valid: false, error: 'empty' })
      expect(validatePhone('   ')).toEqual({ valid: false, error: 'empty' })
    })

    it('returns too_short error for less than 10 digits', () => {
      expect(validatePhone('090123456')).toEqual({ valid: false, error: 'too_short' })
    })

    it('returns too_long error for more than 13 digits', () => {
      expect(validatePhone('01234567890123')).toEqual({ valid: false, error: 'too_long' })
    })

    it('handles formatted input', () => {
      expect(validatePhone('090-1234-5678')).toEqual({ valid: true })
    })
  })

  describe('validateName', () => {
    it('returns valid for non-empty name', () => {
      expect(validateName('田中太郎')).toEqual({ valid: true })
    })

    it('returns empty error for empty name', () => {
      expect(validateName('')).toEqual({ valid: false, error: 'empty' })
      expect(validateName('   ')).toEqual({ valid: false, error: 'empty' })
    })

    it('returns too_long error for name over 80 characters', () => {
      const longName = 'あ'.repeat(81)
      expect(validateName(longName)).toEqual({ valid: false, error: 'too_long' })
    })

    it('accepts name at exactly 80 characters', () => {
      const exactName = 'あ'.repeat(80)
      expect(validateName(exactName)).toEqual({ valid: true })
    })

    it('supports custom maxLength', () => {
      expect(validateName('abcdef', 5)).toEqual({ valid: false, error: 'too_long' })
      expect(validateName('abcde', 5)).toEqual({ valid: true })
    })
  })

  describe('validateEmail', () => {
    it('returns valid for valid email', () => {
      expect(validateEmail('test@example.com')).toEqual({ valid: true })
      expect(validateEmail('user.name@domain.co.jp')).toEqual({ valid: true })
    })

    it('returns valid for empty email (optional field)', () => {
      expect(validateEmail('')).toEqual({ valid: true })
      expect(validateEmail('   ')).toEqual({ valid: true })
    })

    it('returns invalid_format for invalid email', () => {
      expect(validateEmail('invalid')).toEqual({ valid: false, error: 'invalid_format' })
      expect(validateEmail('invalid@')).toEqual({ valid: false, error: 'invalid_format' })
      expect(validateEmail('@example.com')).toEqual({ valid: false, error: 'invalid_format' })
      expect(validateEmail('test@example')).toEqual({ valid: false, error: 'invalid_format' })
    })
  })

  describe('validateEmailRequired', () => {
    it('returns valid for valid email', () => {
      expect(validateEmailRequired('test@example.com')).toEqual({ valid: true })
    })

    it('returns empty error for empty email', () => {
      expect(validateEmailRequired('')).toEqual({ valid: false, error: 'empty' })
      expect(validateEmailRequired('   ')).toEqual({ valid: false, error: 'empty' })
    })

    it('returns invalid_format for invalid email', () => {
      expect(validateEmailRequired('invalid')).toEqual({ valid: false, error: 'invalid_format' })
    })
  })
})
