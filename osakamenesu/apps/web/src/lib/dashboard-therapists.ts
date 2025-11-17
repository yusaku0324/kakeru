import { buildApiUrl, resolveApiBases } from '@/lib/api'
import type { DashboardShopRequestOptions } from './dashboard-shops'

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

function createRequestInit(
  method: string,
  options?: DashboardShopRequestOptions,
  body?: unknown,
): RequestInit {
  const headers: Record<string, string> = {}
  if (options?.cookieHeader) {
    headers.cookie = options.cookieHeader
  }

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  const init: RequestInit = {
    method,
    cache: options?.cache ?? 'no-store',
    signal: options?.signal,
    credentials: options?.cookieHeader ? 'omit' : 'include',
  }

  if (Object.keys(headers).length) {
    init.headers = headers
  }

  if (body !== undefined) {
    if (isFormData) {
      init.body = body as FormData
    } else {
      init.body = JSON.stringify(body)
    }
  }

  return init
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  successStatuses: number[],
): Promise<{ response: Response; data?: T }> {
  let lastError: { status: string; message?: string } | null = null

  for (const base of resolveApiBases()) {
    try {
      const res = await fetch(buildApiUrl(base, path), init)

      if (successStatuses.includes(res.status)) {
        let data: T | undefined
        const shouldParseJson =
          res.status !== 204 && (res.headers.get('content-type')?.includes('json') ?? false)
        if (shouldParseJson) {
          data = (await res.json()) as T
        }
        return { response: res, data }
      }

      if ([401, 403, 404, 409, 413, 415, 422].includes(res.status)) {
        let data: T | undefined
        const shouldParseJson =
          res.headers.get('content-type')?.includes('json') ||
          res.status === 413 ||
          res.status === 415
        if (shouldParseJson) {
          data = (await res.json()) as T
        }
        return { response: res, data }
      }

      lastError = {
        status: 'error',
        message: `リクエストに失敗しました (status=${res.status})`,
      }
    } catch (error) {
      lastError = {
        status: 'error',
        message: error instanceof Error ? error.message : 'リクエスト中にエラーが発生しました',
      }
    }
  }

  throw (
    lastError ?? {
      status: 'error',
      message: 'API リクエストが完了しませんでした',
    }
  )
}

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

export async function fetchDashboardTherapists(
  profileId: string,
  options?: DashboardShopRequestOptions,
): Promise<DashboardTherapistListResult> {
  try {
    const { response, data } = await requestJson<DashboardTherapistSummary[]>(
      `api/dashboard/shops/${profileId}/therapists`,
      createRequestInit('GET', options),
      [200],
    )

    switch (response.status) {
      case 200:
        return { status: 'success', data: data ?? [] }
      case 401:
        return { status: 'unauthorized' }
      case 403:
        return {
          status: 'forbidden',
          detail: (data as { detail?: string } | undefined)?.detail,
        }
      case 404:
        return { status: 'not_found' }
      default:
        return {
          status: 'error',
          message: `セラピスト情報の取得に失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardTherapistListResult
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'セラピスト情報の取得に失敗しました',
    }
  }
}

export async function fetchDashboardTherapist(
  profileId: string,
  therapistId: string,
  options?: DashboardShopRequestOptions,
): Promise<DashboardTherapistMutationResult> {
  try {
    const { response, data } = await requestJson<DashboardTherapistDetail>(
      `api/dashboard/shops/${profileId}/therapists/${therapistId}`,
      createRequestInit('GET', options),
      [200],
    )

    switch (response.status) {
      case 200:
        return { status: 'success', data: data! }
      case 401:
        return { status: 'unauthorized' }
      case 403:
        return {
          status: 'forbidden',
          detail: (data as { detail?: string } | undefined)?.detail,
        }
      case 404:
        return { status: 'not_found' }
      default:
        return {
          status: 'error',
          message: `セラピスト情報の取得に失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardTherapistMutationResult
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'セラピスト情報の取得に失敗しました',
    }
  }
}

export async function createDashboardTherapist(
  profileId: string,
  payload: DashboardTherapistCreatePayload,
  options?: DashboardShopRequestOptions,
): Promise<DashboardTherapistMutationResult> {
  try {
    const { response, data } = await requestJson<DashboardTherapistDetail>(
      `api/dashboard/shops/${profileId}/therapists`,
      createRequestInit('POST', options, payload),
      [201],
    )

    switch (response.status) {
      case 201:
        return { status: 'success', data: data! }
      case 401:
        return { status: 'unauthorized' }
      case 403:
        return {
          status: 'forbidden',
          detail: (data as { detail?: string } | undefined)?.detail,
        }
      case 422:
        return { status: 'validation_error', detail: data }
      default:
        return {
          status: 'error',
          message: `セラピストの作成に失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardTherapistMutationResult
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'セラピストの作成に失敗しました',
    }
  }
}

export async function updateDashboardTherapist(
  profileId: string,
  therapistId: string,
  payload: DashboardTherapistUpdatePayload,
  options?: DashboardShopRequestOptions,
): Promise<DashboardTherapistMutationResult> {
  try {
    const { response, data } = await requestJson<DashboardTherapistDetail>(
      `api/dashboard/shops/${profileId}/therapists/${therapistId}`,
      createRequestInit('PATCH', options, payload),
      [200],
    )

    switch (response.status) {
      case 200:
        return { status: 'success', data: data! }
      case 401:
        return { status: 'unauthorized' }
      case 403:
        return {
          status: 'forbidden',
          detail: (data as { detail?: string } | undefined)?.detail,
        }
      case 404:
        return { status: 'not_found' }
      case 409:
        return { status: 'conflict', current: data! }
      case 422:
        return { status: 'validation_error', detail: data }
      default:
        return {
          status: 'error',
          message: `セラピストの更新に失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardTherapistMutationResult
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'セラピストの更新に失敗しました',
    }
  }
}

export async function deleteDashboardTherapist(
  profileId: string,
  therapistId: string,
  options?: DashboardShopRequestOptions,
): Promise<DashboardTherapistDeleteResult> {
  try {
    const { response } = await requestJson<undefined>(
      `api/dashboard/shops/${profileId}/therapists/${therapistId}`,
      createRequestInit('DELETE', options),
      [204],
    )

    switch (response.status) {
      case 204:
        return { status: 'success' }
      case 401:
        return { status: 'unauthorized' }
      case 403:
        return { status: 'forbidden' }
      case 404:
        return { status: 'not_found' }
      default:
        return {
          status: 'error',
          message: `セラピストの削除に失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardTherapistDeleteResult
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'セラピストの削除に失敗しました',
    }
  }
}

export async function uploadDashboardTherapistPhoto(
  profileId: string,
  file: File,
  options?: DashboardShopRequestOptions,
): Promise<DashboardTherapistPhotoUploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  try {
    const { response, data } = await requestJson<DashboardTherapistPhotoUploadResponse>(
      `api/dashboard/shops/${profileId}/therapists/photos/upload`,
      createRequestInit('POST', options, formData),
      [201],
    )

    switch (response.status) {
      case 201:
        return { status: 'success', data: data as DashboardTherapistPhotoUploadResponse }
      case 401:
        return { status: 'unauthorized' }
      case 403:
        return { status: 'forbidden', detail: (data as { detail?: string } | undefined)?.detail }
      case 404:
        return { status: 'not_found' }
      case 413: {
        const json = data as { limit_bytes?: number } | undefined
        return { status: 'too_large', limitBytes: json?.limit_bytes }
      }
      case 415:
        return {
          status: 'unsupported_media_type',
          message: (data as { detail?: string } | undefined)?.detail,
        }
      case 422:
        return {
          status: 'validation_error',
          message: (data as { message?: string } | undefined)?.message,
        }
      default:
        return {
          status: 'error',
          message: `写真のアップロードに失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '写真のアップロードに失敗しました',
    }
  }
}

export async function reorderDashboardTherapists(
  profileId: string,
  payload: DashboardTherapistReorderPayload,
  options?: DashboardShopRequestOptions,
): Promise<DashboardTherapistListResult> {
  try {
    const { response, data } = await requestJson<DashboardTherapistSummary[]>(
      `api/dashboard/shops/${profileId}/therapists:reorder`,
      createRequestInit('POST', options, payload),
      [200],
    )

    switch (response.status) {
      case 200:
        return { status: 'success', data: data ?? [] }
      case 401:
        return { status: 'unauthorized' }
      case 403:
        return {
          status: 'forbidden',
          detail: (data as { detail?: string } | undefined)?.detail,
        }
      case 404:
        return { status: 'not_found' }
      default:
        return {
          status: 'error',
          message: `セラピストの並び替えに失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardTherapistListResult
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'セラピストの並び替えに失敗しました',
    }
  }
}
