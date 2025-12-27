import { dashboardClient, type ApiErrorResult } from '@/lib/http-clients'
import {
  type DashboardRequestOptions,
  handleCommonError,
  createErrorResult,
} from '@/lib/dashboard-common'

// Re-export for backward compatibility
export type DashboardTherapistRequestOptions = DashboardRequestOptions

export type DashboardTherapistStatus = 'draft' | 'published' | 'archived'

export type DashboardTherapistSummary = {
  id: string
  name: string
  alias?: string | null
  headline?: string | null
  status: DashboardTherapistStatus
  display_order: number
  is_booking_enabled: boolean
  updated_at: string
  photo_urls: string[]
  specialties: string[]
}

export type DashboardTherapistDetail = DashboardTherapistSummary & {
  biography?: string | null
  qualifications: string[]
  experience_years?: number | null
  created_at: string
}

export type DashboardTherapistCreatePayload = {
  name: string
  alias?: string | null
  headline?: string | null
  biography?: string | null
  specialties?: string[]
  qualifications?: string[]
  experience_years?: number | null
  photo_urls?: string[]
  is_booking_enabled?: boolean
}

export type DashboardTherapistUpdatePayload = {
  updated_at: string
  name?: string
  alias?: string | null
  headline?: string | null
  biography?: string | null
  specialties?: string[]
  qualifications?: string[]
  experience_years?: number | null
  photo_urls?: string[]
  status?: DashboardTherapistStatus
  is_booking_enabled?: boolean
  display_order?: number
}

export type DashboardTherapistReorderPayload = {
  items: {
    therapist_id: string
    display_order: number
  }[]
}

export type DashboardTherapistListResult =
  | { status: 'success'; data: DashboardTherapistSummary[] }
  | { status: 'unauthorized' }
  | { status: 'forbidden'; detail?: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

export type DashboardTherapistMutationResult =
  | { status: 'success'; data: DashboardTherapistDetail }
  | { status: 'validation_error'; detail: unknown }
  | { status: 'conflict'; current: DashboardTherapistDetail }
  | { status: 'unauthorized' }
  | { status: 'forbidden'; detail?: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

export type DashboardTherapistDeleteResult =
  | { status: 'success' }
  | { status: 'unauthorized' }
  | { status: 'forbidden'; detail?: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

export type DashboardTherapistPhotoUploadResponse = {
  url: string
  filename: string
  content_type: string
  size: number
}

export type DashboardTherapistPhotoUploadResult =
  | { status: 'success'; data: DashboardTherapistPhotoUploadResponse }
  | { status: 'too_large'; limitBytes?: number }
  | { status: 'unsupported_media_type'; message?: string }
  | { status: 'validation_error'; message?: string }
  | { status: 'unauthorized' }
  | { status: 'forbidden'; detail?: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

function toSummary(detail: DashboardTherapistDetail): DashboardTherapistSummary {
  return {
    id: detail.id,
    name: detail.name,
    alias: detail.alias ?? null,
    headline: detail.headline ?? null,
    status: detail.status,
    display_order: detail.display_order,
    is_booking_enabled: detail.is_booking_enabled,
    updated_at: detail.updated_at,
    photo_urls: Array.isArray(detail.photo_urls) ? detail.photo_urls : [],
    specialties: Array.isArray(detail.specialties) ? detail.specialties : [],
  }
}

export function summarizeTherapist(detail: DashboardTherapistDetail): DashboardTherapistSummary {
  return toSummary(detail)
}

function extractDetailString(detail: unknown): string | undefined {
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object' && detail !== null) {
    const obj = detail as Record<string, unknown>
    if (typeof obj.detail === 'string') return obj.detail
  }
  return undefined
}

export async function fetchDashboardTherapists(
  profileId: string,
  options?: DashboardRequestOptions,
): Promise<DashboardTherapistListResult> {
  const result = await dashboardClient.get<DashboardTherapistSummary[]>(
    `shops/${profileId}/therapists`,
    {
      cookieHeader: options?.cookieHeader,
      signal: options?.signal,
      cache: options?.cache,
    },
  )

  if (result.ok) {
    return { status: 'success', data: result.data ?? [] }
  }

  const err = result as ApiErrorResult
  const commonResult = handleCommonError(err, 'セラピスト情報の取得に失敗しました')
  if (commonResult) {
    if (err.status === 403) {
      return {
        status: 'forbidden',
        detail: extractDetailString(err.detail),
      }
    }
    return commonResult
  }

  return createErrorResult(err, 'セラピスト情報の取得に失敗しました')
}

export async function fetchDashboardTherapist(
  profileId: string,
  therapistId: string,
  options?: DashboardRequestOptions,
): Promise<DashboardTherapistMutationResult> {
  const result = await dashboardClient.get<DashboardTherapistDetail>(
    `shops/${profileId}/therapists/${therapistId}`,
    {
      cookieHeader: options?.cookieHeader,
      signal: options?.signal,
      cache: options?.cache,
    },
  )

  if (result.ok) {
    return { status: 'success', data: result.data }
  }

  const err = result as ApiErrorResult
  const commonResult = handleCommonError(err, 'セラピスト情報の取得に失敗しました')
  if (commonResult) {
    if (err.status === 403) {
      return {
        status: 'forbidden',
        detail: extractDetailString(err.detail),
      }
    }
    return commonResult
  }

  return createErrorResult(err, 'セラピスト情報の取得に失敗しました')
}

export async function createDashboardTherapist(
  profileId: string,
  payload: DashboardTherapistCreatePayload,
  options?: DashboardRequestOptions,
): Promise<DashboardTherapistMutationResult> {
  const result = await dashboardClient.post<DashboardTherapistDetail>(
    `shops/${profileId}/therapists`,
    payload,
    {
      cookieHeader: options?.cookieHeader,
      signal: options?.signal,
      cache: options?.cache,
    },
  )

  if (result.ok) {
    return { status: 'success', data: result.data }
  }

  const err = result as ApiErrorResult

  // Handle common errors (401, 403, 404)
  const commonResult = handleCommonError(err, 'セラピストの作成に失敗しました')
  if (commonResult) {
    if (err.status === 403) {
      return {
        status: 'forbidden',
        detail: extractDetailString(err.detail),
      }
    }
    return commonResult
  }

  // Handle validation error (422)
  if (err.status === 422) {
    return { status: 'validation_error', detail: err.detail }
  }

  return createErrorResult(err, 'セラピストの作成に失敗しました')
}

export async function updateDashboardTherapist(
  profileId: string,
  therapistId: string,
  payload: DashboardTherapistUpdatePayload,
  options?: DashboardRequestOptions,
): Promise<DashboardTherapistMutationResult> {
  const result = await dashboardClient.patch<DashboardTherapistDetail>(
    `shops/${profileId}/therapists/${therapistId}`,
    payload,
    {
      cookieHeader: options?.cookieHeader,
      signal: options?.signal,
      cache: options?.cache,
    },
  )

  if (result.ok) {
    return { status: 'success', data: result.data }
  }

  const err = result as ApiErrorResult

  // Handle common errors (401, 403, 404)
  const commonResult = handleCommonError(err, 'セラピストの更新に失敗しました')
  if (commonResult) {
    if (err.status === 403) {
      return {
        status: 'forbidden',
        detail: extractDetailString(err.detail),
      }
    }
    return commonResult
  }

  // Handle conflict (409)
  if (err.status === 409) {
    // Try to get current data from error detail
    const conflictDetail = err.detail as
      | { detail?: { current?: DashboardTherapistDetail }; current?: DashboardTherapistDetail }
      | DashboardTherapistDetail
      | undefined

    // Check if current is directly in detail
    if (conflictDetail && 'id' in conflictDetail && 'name' in conflictDetail) {
      return { status: 'conflict', current: conflictDetail as DashboardTherapistDetail }
    }

    // Check nested structure
    const nested = conflictDetail as { detail?: { current?: DashboardTherapistDetail }; current?: DashboardTherapistDetail } | undefined
    if (nested?.detail?.current) {
      return { status: 'conflict', current: nested.detail.current }
    }
    if (nested?.current) {
      return { status: 'conflict', current: nested.current }
    }

    // Fetch fresh data as fallback
    const refreshed = await fetchDashboardTherapist(profileId, therapistId, options)
    if (refreshed.status === 'success') {
      return { status: 'conflict', current: refreshed.data }
    }

    return createErrorResult(err, 'セラピストの更新に失敗しました（競合）')
  }

  // Handle validation error (422)
  if (err.status === 422) {
    return { status: 'validation_error', detail: err.detail }
  }

  return createErrorResult(err, 'セラピストの更新に失敗しました')
}

export async function deleteDashboardTherapist(
  profileId: string,
  therapistId: string,
  options?: DashboardRequestOptions,
): Promise<DashboardTherapistDeleteResult> {
  const result = await dashboardClient.delete<undefined>(
    `shops/${profileId}/therapists/${therapistId}`,
    {
      cookieHeader: options?.cookieHeader,
      signal: options?.signal,
      cache: options?.cache,
    },
  )

  if (result.ok) {
    return { status: 'success' }
  }

  const err = result as ApiErrorResult
  const commonResult = handleCommonError(err, 'セラピストの削除に失敗しました')
  if (commonResult) {
    if (err.status === 403) {
      return {
        status: 'forbidden',
        detail: extractDetailString(err.detail),
      }
    }
    return commonResult
  }

  return createErrorResult(err, 'セラピストの削除に失敗しました')
}

export async function uploadDashboardTherapistPhoto(
  profileId: string,
  file: File,
  options?: DashboardRequestOptions,
): Promise<DashboardTherapistPhotoUploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  const result = await dashboardClient.uploadFormData<DashboardTherapistPhotoUploadResponse>(
    `shops/${profileId}/therapists/photos/upload`,
    formData,
    {
      cookieHeader: options?.cookieHeader,
      signal: options?.signal,
      cache: options?.cache,
    },
  )

  if (result.ok) {
    return { status: 'success', data: result.data }
  }

  const err = result as ApiErrorResult

  // Handle common errors (401, 403, 404)
  if (err.status === 401) {
    return { status: 'unauthorized' }
  }
  if (err.status === 403) {
    return {
      status: 'forbidden',
      detail: extractDetailString(err.detail),
    }
  }
  if (err.status === 404) {
    return { status: 'not_found' }
  }

  // Handle too large (413)
  if (err.status === 413) {
    const json = err.detail as { limit_bytes?: number } | undefined
    return { status: 'too_large', limitBytes: json?.limit_bytes }
  }

  // Handle unsupported media type (415)
  if (err.status === 415) {
    return {
      status: 'unsupported_media_type',
      message: extractDetailString(err.detail),
    }
  }

  // Handle validation error (422)
  if (err.status === 422) {
    const validationDetail = err.detail as { message?: string } | undefined
    return {
      status: 'validation_error',
      message: validationDetail?.message,
    }
  }

  return createErrorResult(err, '写真のアップロードに失敗しました')
}

export async function reorderDashboardTherapists(
  profileId: string,
  payload: DashboardTherapistReorderPayload,
  options?: DashboardRequestOptions,
): Promise<DashboardTherapistListResult> {
  const result = await dashboardClient.post<DashboardTherapistSummary[]>(
    `shops/${profileId}/therapists:reorder`,
    payload,
    {
      cookieHeader: options?.cookieHeader,
      signal: options?.signal,
      cache: options?.cache,
    },
  )

  if (result.ok) {
    return { status: 'success', data: result.data ?? [] }
  }

  const err = result as ApiErrorResult
  const commonResult = handleCommonError(err, 'セラピストの並び替えに失敗しました')
  if (commonResult) {
    if (err.status === 403) {
      return {
        status: 'forbidden',
        detail: extractDetailString(err.detail),
      }
    }
    return commonResult
  }

  return createErrorResult(err, 'セラピストの並び替えに失敗しました')
}
