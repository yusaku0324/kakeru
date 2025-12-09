import { buildApiUrl, resolveApiBases } from '@/lib/api'
import type { DashboardShopRequestOptions } from './dashboard-shops'

export type BreakSlot = {
  start_at: string
  end_at: string
}

export type DashboardShift = {
  id: string
  therapist_id: string
  shop_id: string
  date: string
  start_at: string
  end_at: string
  break_slots: BreakSlot[]
  availability_status: string
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export type DashboardShiftCreatePayload = {
  therapist_id: string
  date: string
  start_at: string
  end_at: string
  break_slots?: BreakSlot[]
  availability_status?: string
  notes?: string | null
}

export type DashboardShiftUpdatePayload = {
  start_at?: string
  end_at?: string
  break_slots?: BreakSlot[]
  availability_status?: string
  notes?: string | null
}

export type DashboardShiftListResult =
  | { status: 'success'; data: DashboardShift[] }
  | { status: 'unauthorized' }
  | { status: 'forbidden'; detail?: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

export type DashboardShiftMutationResult =
  | { status: 'success'; data: DashboardShift }
  | { status: 'validation_error'; detail: unknown }
  | { status: 'conflict'; detail?: string }
  | { status: 'unauthorized' }
  | { status: 'forbidden'; detail?: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

export type DashboardShiftDeleteResult =
  | { status: 'success' }
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

  if (body !== undefined) {
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
    init.body = JSON.stringify(body)
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

      if ([401, 403, 404, 409, 422].includes(res.status)) {
        let data: T | undefined
        const shouldParseJson = res.headers.get('content-type')?.includes('json')
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

export type FetchShiftsOptions = {
  therapistId?: string
  dateFrom?: string
  dateTo?: string
}

export async function fetchDashboardShifts(
  profileId: string,
  filterOptions?: FetchShiftsOptions,
  options?: DashboardShopRequestOptions,
): Promise<DashboardShiftListResult> {
  try {
    let path = `api/dashboard/shops/${profileId}/shifts`
    const params = new URLSearchParams()
    if (filterOptions?.therapistId) {
      params.append('therapist_id', filterOptions.therapistId)
    }
    if (filterOptions?.dateFrom) {
      params.append('date_from', filterOptions.dateFrom)
    }
    if (filterOptions?.dateTo) {
      params.append('date_to', filterOptions.dateTo)
    }
    const queryString = params.toString()
    if (queryString) {
      path = `${path}?${queryString}`
    }

    const { response, data } = await requestJson<DashboardShift[]>(
      path,
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
          message: `シフト情報の取得に失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardShiftListResult
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'シフト情報の取得に失敗しました',
    }
  }
}

export async function fetchDashboardShift(
  profileId: string,
  shiftId: string,
  options?: DashboardShopRequestOptions,
): Promise<DashboardShiftMutationResult> {
  try {
    const { response, data } = await requestJson<DashboardShift>(
      `api/dashboard/shops/${profileId}/shifts/${shiftId}`,
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
          message: `シフト情報の取得に失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardShiftMutationResult
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'シフト情報の取得に失敗しました',
    }
  }
}

export async function createDashboardShift(
  profileId: string,
  payload: DashboardShiftCreatePayload,
  options?: DashboardShopRequestOptions,
): Promise<DashboardShiftMutationResult> {
  try {
    const { response, data } = await requestJson<DashboardShift>(
      `api/dashboard/shops/${profileId}/shifts`,
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
      case 404:
        return { status: 'not_found' }
      case 409:
        return {
          status: 'conflict',
          detail: (data as { detail?: string } | undefined)?.detail,
        }
      case 422:
        return { status: 'validation_error', detail: data }
      default:
        return {
          status: 'error',
          message: `シフトの作成に失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardShiftMutationResult
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'シフトの作成に失敗しました',
    }
  }
}

export async function updateDashboardShift(
  profileId: string,
  shiftId: string,
  payload: DashboardShiftUpdatePayload,
  options?: DashboardShopRequestOptions,
): Promise<DashboardShiftMutationResult> {
  try {
    const { response, data } = await requestJson<DashboardShift>(
      `api/dashboard/shops/${profileId}/shifts/${shiftId}`,
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
        return {
          status: 'conflict',
          detail: (data as { detail?: string } | undefined)?.detail,
        }
      case 422:
        return { status: 'validation_error', detail: data }
      default:
        return {
          status: 'error',
          message: `シフトの更新に失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardShiftMutationResult
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'シフトの更新に失敗しました',
    }
  }
}

export async function deleteDashboardShift(
  profileId: string,
  shiftId: string,
  options?: DashboardShopRequestOptions,
): Promise<DashboardShiftDeleteResult> {
  try {
    const { response, data } = await requestJson<undefined>(
      `api/dashboard/shops/${profileId}/shifts/${shiftId}`,
      createRequestInit('DELETE', options),
      [204],
    )

    switch (response.status) {
      case 204:
        return { status: 'success' }
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
          message: `シフトの削除に失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardShiftDeleteResult
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'シフトの削除に失敗しました',
    }
  }
}
