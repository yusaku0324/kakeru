import { buildApiUrl, resolveApiBases } from '@/lib/api'

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

export type DashboardNotificationsRequestOptions = {
  cookieHeader?: string
  signal?: AbortSignal
  cache?: RequestCache
}

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

function createRequestInit(
  method: string,
  options?: DashboardNotificationsRequestOptions,
  body?: unknown
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
  successStatuses: number[]
): Promise<{ response: Response; data?: T }> {
  let lastError: DashboardNotificationsError | null = null

  for (const base of resolveApiBases()) {
    try {
      const res = await fetch(buildApiUrl(base, path), init)

      if (successStatuses.includes(res.status)) {
        let data: T | undefined
        if (res.status !== 204 && res.headers.get('content-type')?.includes('json')) {
          data = (await res.json()) as T
        }
        return { response: res, data }
      }

      switch (res.status) {
        case 401:
        case 403:
        case 404:
        case 409:
        case 422: {
          let data: T | undefined
          if (res.headers.get('content-type')?.includes('json')) {
            data = (await res.json()) as T
          }
          return { response: res, data }
        }
        default:
          lastError = {
            status: 'error',
            message: `リクエストに失敗しました (status=${res.status})`,
          }
          continue
      }
    } catch (error) {
      lastError = {
        status: 'error',
        message:
          error instanceof Error ? error.message : 'リクエスト中にエラーが発生しました',
      }
    }
  }

  throw lastError ?? {
    status: 'error',
    message: 'API リクエストが完了しませんでした',
  }
}

export async function fetchDashboardNotificationSettings(
  profileId: string,
  options?: DashboardNotificationsRequestOptions
): Promise<DashboardNotificationsFetchResult> {
  try {
    const { response, data } = await requestJson<DashboardNotificationSettingsResponse>(
      `api/dashboard/shops/${profileId}/notifications`,
      createRequestInit('GET', options),
      [200]
    )

    switch (response.status) {
      case 200:
        return { status: 'success', data: data! }
      case 401:
        return { status: 'unauthorized' }
      case 403:
        return {
          status: 'forbidden',
          detail: (data as { detail?: string } | undefined)?.detail ?? 'dashboard_access_denied',
        }
      case 404:
        return { status: 'not_found' }
      default:
        return {
          status: 'error',
          message: `通知設定の取得に失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardNotificationsError
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '通知設定の取得に失敗しました',
    }
  }
}

export async function updateDashboardNotificationSettings(
  profileId: string,
  payload: DashboardNotificationSettingsUpdatePayload,
  options?: DashboardNotificationsRequestOptions
): Promise<DashboardNotificationsUpdateResult> {
  try {
    const { response, data } = await requestJson<
      | DashboardNotificationSettingsResponse
      | { detail?: { current?: DashboardNotificationSettingsResponse } }
    >(
      `api/dashboard/shops/${profileId}/notifications`,
      createRequestInit('PUT', options, payload),
      [200]
    )

    switch (response.status) {
      case 200:
        return { status: 'success', data: data as DashboardNotificationSettingsResponse }
      case 401:
        return { status: 'unauthorized' }
      case 403:
        return {
          status: 'forbidden',
          detail: (data as { detail?: string } | undefined)?.detail ?? 'dashboard_access_denied',
        }
      case 404:
        return { status: 'not_found' }
      case 409: {
        const detail = data as { detail?: { current?: DashboardNotificationSettingsResponse } } | undefined
        if (detail?.detail?.current) {
          return { status: 'conflict', current: detail.detail.current }
        }
        const refreshed = await fetchDashboardNotificationSettings(profileId, options)
        if (refreshed.status === 'success') {
          return { status: 'conflict', current: refreshed.data }
        }
        const fallbackCurrent =
          (detail?.detail?.current ?? (data as DashboardNotificationSettingsResponse | undefined)) ?? {
            profile_id: profileId,
            updated_at: payload.updated_at,
            trigger_status: payload.trigger_status,
            channels: payload.channels,
          }
        return { status: 'conflict', current: fallbackCurrent }
      }
      case 422:
        return { status: 'validation_error', detail: data }
      default:
        return {
          status: 'error',
          message: `通知設定の更新に失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardNotificationsError
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '通知設定の更新に失敗しました',
    }
  }
}

export async function testDashboardNotificationSettings(
  profileId: string,
  payload: DashboardNotificationSettingsTestPayload,
  options?: DashboardNotificationsRequestOptions
): Promise<DashboardNotificationsTestResult> {
  try {
    const { response, data } = await requestJson<unknown>(
      `api/dashboard/shops/${profileId}/notifications/test`,
      createRequestInit('POST', options, payload),
      [204]
    )

    switch (response.status) {
      case 204:
        return { status: 'success' }
      case 401:
        return { status: 'unauthorized' }
      case 403:
        return {
          status: 'forbidden',
          detail: (data as { detail?: string } | undefined)?.detail ?? 'dashboard_access_denied',
        }
      case 404:
        return { status: 'not_found' }
      case 422:
        return { status: 'validation_error', detail: data }
      default:
        return {
          status: 'error',
          message: `テスト通知のリクエストに失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardNotificationsError
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'テスト通知のリクエストに失敗しました',
    }
  }
}
