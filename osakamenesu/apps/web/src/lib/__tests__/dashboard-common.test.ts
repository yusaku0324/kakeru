import { describe, it, expect } from 'vitest'
import {
  extractDetailString,
  handleCommonError,
  createErrorResult,
} from '../dashboard-common'

describe('dashboard-common', () => {
  describe('extractDetailString', () => {
    it('returns undefined for undefined', () => {
      expect(extractDetailString(undefined)).toBeUndefined()
    })

    it('returns string directly', () => {
      expect(extractDetailString('error message')).toBe('error message')
    })

    it('extracts detail from object with string detail', () => {
      expect(extractDetailString({ detail: 'nested error' })).toBe('nested error')
    })

    it('returns undefined for object without detail', () => {
      expect(extractDetailString({ message: 'other field' })).toBeUndefined()
    })

    it('returns undefined for object with non-string detail', () => {
      expect(extractDetailString({ detail: { nested: true } })).toBeUndefined()
    })

    it('returns undefined for null', () => {
      expect(extractDetailString(null)).toBeUndefined()
    })

    it('returns undefined for number', () => {
      expect(extractDetailString(123)).toBeUndefined()
    })
  })

  describe('handleCommonError', () => {
    it('returns unauthorized for 401', () => {
      const result = handleCommonError(
        { ok: false, status: 401, error: 'Unauthorized' },
        'Default message',
      )
      expect(result).toEqual({ status: 'unauthorized' })
    })

    it('returns forbidden for 403 with string detail', () => {
      const result = handleCommonError(
        { ok: false, status: 403, error: 'Forbidden', detail: 'access_denied' },
        'Default message',
      )
      expect(result).toEqual({ status: 'forbidden', detail: 'access_denied' })
    })

    it('returns forbidden for 403 with object detail', () => {
      const result = handleCommonError(
        { ok: false, status: 403, error: 'Forbidden', detail: { detail: 'nested_reason' } },
        'Default message',
      )
      expect(result).toEqual({ status: 'forbidden', detail: 'nested_reason' })
    })

    it('returns not_found for 404', () => {
      const result = handleCommonError(
        { ok: false, status: 404, error: 'Not Found' },
        'Default message',
      )
      expect(result).toEqual({ status: 'not_found' })
    })

    it('returns undefined for unhandled status', () => {
      const result = handleCommonError(
        { ok: false, status: 500, error: 'Internal Server Error' },
        'Default message',
      )
      expect(result).toBeUndefined()
    })

    it('returns undefined for 409', () => {
      const result = handleCommonError(
        { ok: false, status: 409, error: 'Conflict' },
        'Default message',
      )
      expect(result).toBeUndefined()
    })

    it('returns undefined for 422', () => {
      const result = handleCommonError(
        { ok: false, status: 422, error: 'Unprocessable Entity' },
        'Default message',
      )
      expect(result).toBeUndefined()
    })
  })

  describe('createErrorResult', () => {
    it('uses error message from result', () => {
      const result = createErrorResult(
        { ok: false, status: 500, error: 'Specific error' },
        'Default message',
      )
      expect(result).toEqual({ status: 'error', message: 'Specific error' })
    })

    it('falls back to default message with status', () => {
      const result = createErrorResult(
        { ok: false, status: 502, error: '' },
        'Something failed',
      )
      expect(result).toEqual({ status: 'error', message: 'Something failed (status=502)' })
    })

    it('uses default message when error is undefined', () => {
      const result = createErrorResult(
        { ok: false, status: 503, error: '' },
        'Service unavailable',
      )
      expect(result).toEqual({ status: 'error', message: 'Service unavailable (status=503)' })
    })
  })
})
