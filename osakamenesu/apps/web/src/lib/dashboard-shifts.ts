import { dashboardClient, type ApiErrorResult } from '@/lib/http-clients'
import {
  type DashboardRequestOptions,
  handleCommonError,
  createErrorResult,
} from '@/lib/dashboard-common'

// Re-export for backward compatibility
export type DashboardShiftRequestOptions = DashboardRequestOptions

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

function extractDetailString(detail: unknown): string | undefined {
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object' && detail !== null) {
    const obj = detail as Record<string, unknown>
    if (typeof obj.detail === 'string') return obj.detail
  }
  return undefined
}

export type FetchShiftsOptions = {
  therapistId?: string
  dateFrom?: string
  dateTo?: string
}

export async function fetchDashboardShifts(
  profileId: string,
  filterOptions?: FetchShiftsOptions,
  options?: DashboardRequestOptions,
): Promise<DashboardShiftListResult> {
  let path = `shops/${profileId}/shifts`
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

  const result = await dashboardClient.get<DashboardShift[]>(path, {
    cookieHeader: options?.cookieHeader,
    signal: options?.signal,
    cache: options?.cache,
  })

  if (result.ok) {
    return { status: 'success', data: result.data ?? [] }
  }

  const err = result as ApiErrorResult
  const commonResult = handleCommonError(err, 'シフト情報の取得に失敗しました')
  if (commonResult) {
    if (err.status === 403) {
      return {
        status: 'forbidden',
        detail: extractDetailString(err.detail),
      }
    }
    return commonResult
  }

  return createErrorResult(err, 'シフト情報の取得に失敗しました')
}

export async function fetchDashboardShift(
  profileId: string,
  shiftId: string,
  options?: DashboardRequestOptions,
): Promise<DashboardShiftMutationResult> {
  const result = await dashboardClient.get<DashboardShift>(
    `shops/${profileId}/shifts/${shiftId}`,
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
  const commonResult = handleCommonError(err, 'シフト情報の取得に失敗しました')
  if (commonResult) {
    if (err.status === 403) {
      return {
        status: 'forbidden',
        detail: extractDetailString(err.detail),
      }
    }
    return commonResult
  }

  return createErrorResult(err, 'シフト情報の取得に失敗しました')
}

export async function createDashboardShift(
  profileId: string,
  payload: DashboardShiftCreatePayload,
  options?: DashboardRequestOptions,
): Promise<DashboardShiftMutationResult> {
  const result = await dashboardClient.post<DashboardShift>(
    `shops/${profileId}/shifts`,
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
  const commonResult = handleCommonError(err, 'シフトの作成に失敗しました')
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
    return {
      status: 'conflict',
      detail: extractDetailString(err.detail),
    }
  }

  // Handle validation error (422)
  if (err.status === 422) {
    return { status: 'validation_error', detail: err.detail }
  }

  return createErrorResult(err, 'シフトの作成に失敗しました')
}

export async function updateDashboardShift(
  profileId: string,
  shiftId: string,
  payload: DashboardShiftUpdatePayload,
  options?: DashboardRequestOptions,
): Promise<DashboardShiftMutationResult> {
  const result = await dashboardClient.patch<DashboardShift>(
    `shops/${profileId}/shifts/${shiftId}`,
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
  const commonResult = handleCommonError(err, 'シフトの更新に失敗しました')
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
    return {
      status: 'conflict',
      detail: extractDetailString(err.detail),
    }
  }

  // Handle validation error (422)
  if (err.status === 422) {
    return { status: 'validation_error', detail: err.detail }
  }

  return createErrorResult(err, 'シフトの更新に失敗しました')
}

export async function deleteDashboardShift(
  profileId: string,
  shiftId: string,
  options?: DashboardRequestOptions,
): Promise<DashboardShiftDeleteResult> {
  const result = await dashboardClient.delete<undefined>(
    `shops/${profileId}/shifts/${shiftId}`,
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
  const commonResult = handleCommonError(err, 'シフトの削除に失敗しました')
  if (commonResult) {
    if (err.status === 403) {
      return {
        status: 'forbidden',
        detail: extractDetailString(err.detail),
      }
    }
    return commonResult
  }

  return createErrorResult(err, 'シフトの削除に失敗しました')
}
