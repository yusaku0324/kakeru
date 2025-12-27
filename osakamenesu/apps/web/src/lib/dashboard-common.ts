/**
 * Common types and utilities for Dashboard API functions.
 *
 * This module provides shared functionality to reduce duplication across
 * dashboard-shops.ts, dashboard-therapists.ts, dashboard-notifications.ts, etc.
 */

import { type ApiErrorResult } from '@/lib/http-clients'

// ============================================================================
// Common Types
// ============================================================================

/**
 * Common request options for all dashboard API calls
 */
export type DashboardRequestOptions = {
  cookieHeader?: string
  signal?: AbortSignal
  cache?: RequestCache
}

/**
 * Base result types used across dashboard APIs
 */
export type UnauthorizedResult = { status: 'unauthorized' }
export type ForbiddenResult = { status: 'forbidden'; detail?: string }
export type NotFoundResult = { status: 'not_found' }
export type ErrorResult = { status: 'error'; message: string }
export type ValidationErrorResult<T = unknown> = { status: 'validation_error'; detail: T }
export type ConflictResult<T> = { status: 'conflict'; current: T }

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Extract detail string from various error response formats
 */
export function extractDetailString(detail: unknown): string | undefined {
  if (typeof detail === 'string') {
    return detail
  }
  if (typeof detail === 'object' && detail !== null) {
    const obj = detail as Record<string, unknown>
    if (typeof obj.detail === 'string') {
      return obj.detail
    }
  }
  return undefined
}

/**
 * Handle common error statuses (401, 403, 404) and return appropriate result.
 * Returns undefined if the status is not handled.
 */
export function handleCommonError(
  err: ApiErrorResult,
  defaultErrorMessage: string,
):
  | UnauthorizedResult
  | ForbiddenResult
  | NotFoundResult
  | ErrorResult
  | undefined {
  switch (err.status) {
    case 401:
      return { status: 'unauthorized' }
    case 403:
      return {
        status: 'forbidden',
        detail: extractDetailString(err.detail),
      }
    case 404:
      return { status: 'not_found' }
    default:
      return undefined
  }
}

/**
 * Create a standard error result
 */
export function createErrorResult(
  err: ApiErrorResult,
  defaultMessage: string,
): ErrorResult {
  return {
    status: 'error',
    message: err.error || `${defaultMessage} (status=${err.status})`,
  }
}

/**
 * Handle GET request results with standard error handling
 */
export function handleGetResult<T, TResult extends { status: 'success'; data: T }>(
  result: { ok: true; data: T } | ApiErrorResult,
  successMapper: (data: T) => TResult,
  defaultErrorMessage: string,
): TResult | UnauthorizedResult | ForbiddenResult | NotFoundResult | ErrorResult {
  if ('ok' in result && result.ok) {
    return successMapper(result.data)
  }

  const err = result as ApiErrorResult
  const commonResult = handleCommonError(err, defaultErrorMessage)
  if (commonResult) {
    return commonResult
  }

  return createErrorResult(err, defaultErrorMessage)
}

/**
 * Handle mutation (POST/PUT/PATCH) request results with validation error support
 */
export function handleMutationResult<T, TResult extends { status: 'success'; data: T }>(
  result: { ok: true; data: T; status?: number } | ApiErrorResult,
  successMapper: (data: T) => TResult,
  defaultErrorMessage: string,
  options?: {
    expectedSuccessStatus?: number
    handleConflict?: (err: ApiErrorResult) => ConflictResult<T> | Promise<ConflictResult<T>>
  },
):
  | TResult
  | UnauthorizedResult
  | ForbiddenResult
  | NotFoundResult
  | ValidationErrorResult
  | ConflictResult<T>
  | ErrorResult
  | Promise<TResult | UnauthorizedResult | ForbiddenResult | NotFoundResult | ValidationErrorResult | ConflictResult<T> | ErrorResult> {
  if ('ok' in result && result.ok) {
    // Check expected status if specified
    if (options?.expectedSuccessStatus && result.status !== options.expectedSuccessStatus) {
      return {
        status: 'error',
        message: `${defaultErrorMessage} (status=${result.status})`,
      }
    }
    return successMapper(result.data)
  }

  const err = result as ApiErrorResult

  // Handle common errors
  const commonResult = handleCommonError(err, defaultErrorMessage)
  if (commonResult) {
    return commonResult
  }

  // Handle conflict
  if (err.status === 409 && options?.handleConflict) {
    return options.handleConflict(err)
  }

  // Handle validation error
  if (err.status === 422) {
    return { status: 'validation_error', detail: err.detail }
  }

  return createErrorResult(err, defaultErrorMessage)
}
