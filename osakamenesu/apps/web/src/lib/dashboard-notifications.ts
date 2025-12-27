import { dashboardClient, type ApiErrorResult } from '@/lib/http-clients'
import {
  type DashboardRequestOptions,
  handleCommonError,
  createErrorResult,
} from '@/lib/dashboard-common'

export type DashboardNotificationStatus =
  | 'pending'
  | 'confirmed'
  | 'declined'
  | 'cancelled'
  | 'expired'

export type DashboardNotificationChannelEmail = {
  enabled: boolean
  recipients: string[]
}

export type DashboardNotificationChannelLine = {
  enabled: boolean
  token: string | null
  webhook_url?: string | null
}

export type DashboardNotificationChannelSlack = {
  enabled: boolean
  webhook_url: string | null
}

export type DashboardNotificationChannels = {
  email: DashboardNotificationChannelEmail
  line: DashboardNotificationChannelLine
  slack: DashboardNotificationChannelSlack
}

export type DashboardNotificationSettingsResponse = {
  profile_id: string
  updated_at: string
  trigger_status: DashboardNotificationStatus[]
  channels: DashboardNotificationChannels
}

export type DashboardNotificationSettingsUpdatePayload = {
  updated_at: string
  trigger_status: DashboardNotificationStatus[]
  channels: DashboardNotificationChannels
}

export type DashboardNotificationSettingsTestPayload = {
  trigger_status: DashboardNotificationStatus[]
  channels: DashboardNotificationChannels
}

// Re-export shared type for backward compatibility
export type DashboardNotificationsRequestOptions = DashboardRequestOptions

export type DashboardNotificationsSuccess = {
  status: 'success'
  data: DashboardNotificationSettingsResponse
}

export type DashboardNotificationsUnauthenticated = {
  status: 'unauthorized'
}

export type DashboardNotificationsForbidden = {
  status: 'forbidden'
  detail: 'dashboard_access_not_configured' | 'dashboard_access_denied' | string
}

export type DashboardNotificationsNotFound = {
  status: 'not_found'
}

export type DashboardNotificationsError = {
  status: 'error'
  message: string
}

export type DashboardNotificationsFetchResult =
  | DashboardNotificationsSuccess
  | DashboardNotificationsUnauthenticated
  | DashboardNotificationsForbidden
  | DashboardNotificationsNotFound
  | DashboardNotificationsError

export type DashboardNotificationsConflict = {
  status: 'conflict'
  current: DashboardNotificationSettingsResponse
}

export type DashboardNotificationsValidationError = {
  status: 'validation_error'
  detail: unknown
}

export type DashboardNotificationsUpdateResult =
  | DashboardNotificationsSuccess
  | DashboardNotificationsConflict
  | DashboardNotificationsValidationError
  | DashboardNotificationsUnauthenticated
  | DashboardNotificationsForbidden
  | DashboardNotificationsNotFound
  | DashboardNotificationsError

export type DashboardNotificationsTestResult =
  | { status: 'success' }
  | DashboardNotificationsValidationError
  | DashboardNotificationsUnauthenticated
  | DashboardNotificationsForbidden
  | DashboardNotificationsNotFound
  | DashboardNotificationsError

export async function fetchDashboardNotificationSettings(
  profileId: string,
  options?: DashboardNotificationsRequestOptions,
): Promise<DashboardNotificationsFetchResult> {
  const result = await dashboardClient.get<DashboardNotificationSettingsResponse>(
    `shops/${profileId}/notifications`,
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
    const detail = typeof err.detail === 'object' && err.detail !== null
      ? (err.detail as { detail?: string }).detail
      : undefined
    return {
      status: 'forbidden',
      detail: detail ?? 'dashboard_access_denied',
    }
  }
  if (err.status === 404) {
    return { status: 'not_found' }
  }

  return createErrorResult(err, '通知設定の取得に失敗しました')
}

export async function updateDashboardNotificationSettings(
  profileId: string,
  payload: DashboardNotificationSettingsUpdatePayload,
  options?: DashboardNotificationsRequestOptions,
): Promise<DashboardNotificationsUpdateResult> {
  const result = await dashboardClient.put<
    | DashboardNotificationSettingsResponse
    | { detail?: { current?: DashboardNotificationSettingsResponse } }
  >(
    `shops/${profileId}/notifications`,
    payload,
    {
      cookieHeader: options?.cookieHeader,
      signal: options?.signal,
      cache: options?.cache,
    },
  )

  if (result.ok) {
    return { status: 'success', data: result.data as DashboardNotificationSettingsResponse }
  }

  const err = result as ApiErrorResult

  // Handle common errors (401, 403, 404)
  if (err.status === 401) {
    return { status: 'unauthorized' }
  }
  if (err.status === 403) {
    const detail = typeof err.detail === 'object' && err.detail !== null
      ? (err.detail as { detail?: string }).detail
      : undefined
    return {
      status: 'forbidden',
      detail: detail ?? 'dashboard_access_denied',
    }
  }
  if (err.status === 404) {
    return { status: 'not_found' }
  }

  // Handle conflict (409)
  if (err.status === 409) {
    const conflictDetail = err.detail as
      | { detail?: { current?: DashboardNotificationSettingsResponse } }
      | undefined
    if (conflictDetail?.detail?.current) {
      return { status: 'conflict', current: conflictDetail.detail.current }
    }
    // Fetch fresh data
    const refreshed = await fetchDashboardNotificationSettings(profileId, options)
    if (refreshed.status === 'success') {
      return { status: 'conflict', current: refreshed.data }
    }
    // Fallback with payload data
    const fallbackCurrent: DashboardNotificationSettingsResponse = {
      profile_id: profileId,
      updated_at: payload.updated_at,
      trigger_status: payload.trigger_status,
      channels: payload.channels,
    }
    return { status: 'conflict', current: fallbackCurrent }
  }

  // Handle validation error (422)
  if (err.status === 422) {
    return { status: 'validation_error', detail: err.detail }
  }

  return createErrorResult(err, '通知設定の更新に失敗しました')
}

export async function testDashboardNotificationSettings(
  profileId: string,
  payload: DashboardNotificationSettingsTestPayload,
  options?: DashboardNotificationsRequestOptions,
): Promise<DashboardNotificationsTestResult> {
  const result = await dashboardClient.post<undefined>(
    `shops/${profileId}/notifications/test`,
    payload,
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

  // Handle common errors (401, 403, 404)
  if (err.status === 401) {
    return { status: 'unauthorized' }
  }
  if (err.status === 403) {
    const detail = typeof err.detail === 'object' && err.detail !== null
      ? (err.detail as { detail?: string }).detail
      : undefined
    return {
      status: 'forbidden',
      detail: detail ?? 'dashboard_access_denied',
    }
  }
  if (err.status === 404) {
    return { status: 'not_found' }
  }

  // Handle validation error (422)
  if (err.status === 422) {
    return { status: 'validation_error', detail: err.detail }
  }

  return createErrorResult(err, 'テスト通知のリクエストに失敗しました')
}
