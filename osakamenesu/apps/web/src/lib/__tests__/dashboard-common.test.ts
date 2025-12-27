import { describe, it, expect } from 'vitest'
import {
  extractDetailString,
  handleCommonError,
  createErrorResult,
  handleGetResult,
  handleMutationResult,
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

  describe('handleGetResult', () => {
    const successMapper = (data: { id: string }) => ({
      status: 'success' as const,
      data,
    })

    it('maps successful result', () => {
      const result = handleGetResult(
        { ok: true, data: { id: '123' } },
        successMapper,
        'Failed to get',
      )
      expect(result).toEqual({ status: 'success', data: { id: '123' } })
    })

    it('returns unauthorized for 401', () => {
      const result = handleGetResult(
        { ok: false, status: 401, error: 'Unauthorized' },
        successMapper,
        'Failed to get',
      )
      expect(result).toEqual({ status: 'unauthorized' })
    })

    it('returns forbidden for 403', () => {
      const result = handleGetResult(
        { ok: false, status: 403, error: 'Forbidden', detail: 'access_denied' },
        successMapper,
        'Failed to get',
      )
      expect(result).toEqual({ status: 'forbidden', detail: 'access_denied' })
    })

    it('returns not_found for 404', () => {
      const result = handleGetResult(
        { ok: false, status: 404, error: 'Not Found' },
        successMapper,
        'Failed to get',
      )
      expect(result).toEqual({ status: 'not_found' })
    })

    it('returns error for other status codes', () => {
      const result = handleGetResult(
        { ok: false, status: 500, error: 'Internal Error' },
        successMapper,
        'Failed to get',
      )
      expect(result).toEqual({ status: 'error', message: 'Internal Error' })
    })

    it('uses default message when no error', () => {
      const result = handleGetResult(
        { ok: false, status: 502, error: '' },
        successMapper,
        'Default error',
      )
      expect(result).toEqual({ status: 'error', message: 'Default error (status=502)' })
    })
  })

  describe('handleMutationResult', () => {
    const successMapper = (data: { id: string }) => ({
      status: 'success' as const,
      data,
    })

    it('maps successful result', () => {
      const result = handleMutationResult(
        { ok: true, data: { id: '123' } },
        successMapper,
        'Failed to create',
      )
      expect(result).toEqual({ status: 'success', data: { id: '123' } })
    })

    it('returns unauthorized for 401', () => {
      const result = handleMutationResult(
        { ok: false, status: 401, error: 'Unauthorized' },
        successMapper,
        'Failed to create',
      )
      expect(result).toEqual({ status: 'unauthorized' })
    })

    it('returns forbidden for 403', () => {
      const result = handleMutationResult(
        { ok: false, status: 403, error: 'Forbidden', detail: 'no_permission' },
        successMapper,
        'Failed to create',
      )
      expect(result).toEqual({ status: 'forbidden', detail: 'no_permission' })
    })

    it('returns not_found for 404', () => {
      const result = handleMutationResult(
        { ok: false, status: 404, error: 'Not Found' },
        successMapper,
        'Failed to create',
      )
      expect(result).toEqual({ status: 'not_found' })
    })

    it('returns validation_error for 422', () => {
      const result = handleMutationResult(
        { ok: false, status: 422, error: 'Validation Error', detail: { name: 'required' } },
        successMapper,
        'Failed to create',
      )
      expect(result).toEqual({ status: 'validation_error', detail: { name: 'required' } })
    })

    it('returns error for other status codes', () => {
      const result = handleMutationResult(
        { ok: false, status: 500, error: 'Server Error' },
        successMapper,
        'Failed to create',
      )
      expect(result).toEqual({ status: 'error', message: 'Server Error' })
    })

    it('checks expected success status', () => {
      const result = handleMutationResult(
        { ok: true, data: { id: '123' }, status: 200 },
        successMapper,
        'Failed to create',
        { expectedSuccessStatus: 201 },
      )
      expect(result).toEqual({ status: 'error', message: 'Failed to create (status=200)' })
    })

    it('allows matching expected success status', () => {
      const result = handleMutationResult(
        { ok: true, data: { id: '123' }, status: 201 },
        successMapper,
        'Failed to create',
        { expectedSuccessStatus: 201 },
      )
      expect(result).toEqual({ status: 'success', data: { id: '123' } })
    })

    it('handles conflict with custom handler', () => {
      const conflictHandler = () => ({
        status: 'conflict' as const,
        current: { id: 'existing' },
      })
      const result = handleMutationResult(
        { ok: false, status: 409, error: 'Conflict' },
        successMapper,
        'Failed to create',
        { handleConflict: conflictHandler },
      )
      expect(result).toEqual({ status: 'conflict', current: { id: 'existing' } })
    })

    it('returns error for 409 without conflict handler', () => {
      const result = handleMutationResult(
        { ok: false, status: 409, error: 'Conflict occurred' },
        successMapper,
        'Failed to create',
      )
      expect(result).toEqual({ status: 'error', message: 'Conflict occurred' })
    })

    it('handles async conflict handler', async () => {
      const asyncConflictHandler = async () => ({
        status: 'conflict' as const,
        current: { id: 'async-existing' },
      })
      const result = await handleMutationResult(
        { ok: false, status: 409, error: 'Conflict' },
        successMapper,
        'Failed to create',
        { handleConflict: asyncConflictHandler },
      )
      expect(result).toEqual({ status: 'conflict', current: { id: 'async-existing' } })
    })
  })
})
