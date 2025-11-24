import { buildApiUrl, resolveApiBases } from '@/lib/api'

export type DashboardShopServiceType = 'store' | 'dispatch'

export type DashboardShopContact = {
  phone?: string | null
  line_id?: string | null
  website_url?: string | null
  reservation_form_url?: string | null
}

export type DashboardShopMenu = {
  id?: string
  name: string
  price: number
  duration_minutes?: number | null
  description?: string | null
  tags?: string[]
  is_reservable_online?: boolean | null
}

export type DashboardShopStaff = {
  id?: string
  name: string
  alias?: string | null
  headline?: string | null
  specialties?: string[]
}

export type DashboardAvailabilitySlot = {
  start_at: string
  end_at: string
  status: 'open' | 'tentative' | 'blocked'
  staff_id?: string | null
  menu_id?: string | null
}

export type DashboardAvailabilityDay = {
  date: string
  is_today?: boolean | null
  slots: DashboardAvailabilitySlot[]
}

export type DashboardAvailabilityCalendar = {
  generated_at?: string | null
  days: DashboardAvailabilityDay[]
}

export type DashboardShopProfile = {
  id: string
  slug?: string | null
  name: string
  store_name?: string | null
  area: string
  price_min: number
  price_max: number
  service_type: DashboardShopServiceType
  service_tags: string[]
  description?: string | null
  catch_copy?: string | null
  address?: string | null
  photos: string[]
  contact: DashboardShopContact | null
  menus: DashboardShopMenu[]
  staff: DashboardShopStaff[]
  availability_calendar?: DashboardAvailabilityCalendar | null
  updated_at?: string
  status?: string | null
}

export type DashboardShopRequestOptions = {
  cookieHeader?: string
  signal?: AbortSignal
  cache?: RequestCache
}

export type DashboardShopProfileFetchResult =
  | { status: 'success'; data: DashboardShopProfile }
  | { status: 'unauthorized' }
  | { status: 'forbidden'; detail?: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

export type DashboardShopProfileUpdatePayload = {
  updated_at?: string
  name?: string
  slug?: string | null
  area?: string
  price_min?: number
  price_max?: number
  service_type?: DashboardShopServiceType
  service_tags?: string[]
  description?: string | null
  catch_copy?: string | null
  address?: string | null
  photos?: string[]
  contact?: DashboardShopContact | null
  menus?: DashboardShopMenu[]
  staff?: DashboardShopStaff[]
  status?: string
}

export type DashboardShopProfileCreatePayload = {
  name: string
  area: string
  price_min: number
  price_max: number
  service_type?: DashboardShopServiceType
  service_tags?: string[]
  description?: string | null
  catch_copy?: string | null
  address?: string | null
  photos?: string[]
  contact?: DashboardShopContact | null
}

export type DashboardShopProfileUpdateResult =
  | { status: 'success'; data: DashboardShopProfile }
  | { status: 'conflict'; current: DashboardShopProfile }
  | { status: 'validation_error'; detail: unknown }
  | { status: 'unauthorized' }
  | { status: 'forbidden'; detail?: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

export type DashboardShopProfileCreateResult =
  | { status: 'success'; data: DashboardShopProfile }
  | { status: 'validation_error'; detail: unknown }
  | { status: 'unauthorized' }
  | { status: 'forbidden'; detail?: string }
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
  let lastError: DashboardShopProfileFetchResult | DashboardShopProfileUpdateResult | null = null

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

export async function fetchDashboardShopProfile(
  profileId: string,
  options?: DashboardShopRequestOptions,
): Promise<DashboardShopProfileFetchResult> {
  try {
    const { response, data } = await requestJson<DashboardShopProfile>(
      `api/dashboard/shops/${profileId}/profile`,
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
          message: `店舗情報の取得に失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardShopProfileFetchResult
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '店舗情報の取得に失敗しました',
    }
  }
}

export async function updateDashboardShopProfile(
  profileId: string,
  payload: DashboardShopProfileUpdatePayload,
  options?: DashboardShopRequestOptions,
): Promise<DashboardShopProfileUpdateResult> {
  try {
    const { response, data } = await requestJson<
      DashboardShopProfile | { detail?: { current?: DashboardShopProfile } }
    >(`api/dashboard/shops/${profileId}/profile`, createRequestInit('PUT', options, payload), [200])

    switch (response.status) {
      case 200:
        return { status: 'success', data: data as DashboardShopProfile }
      case 401:
        return { status: 'unauthorized' }
      case 403:
        return {
          status: 'forbidden',
          detail: (data as { detail?: string } | undefined)?.detail,
        }
      case 404:
        return { status: 'not_found' }
      case 409: {
        const detail = data as { detail?: { current?: DashboardShopProfile } } | undefined
        if (detail?.detail?.current) {
          return { status: 'conflict', current: detail.detail.current }
        }
        const refreshed = await fetchDashboardShopProfile(profileId, options)
        if (refreshed.status === 'success') {
          return { status: 'conflict', current: refreshed.data }
        }
        const fallback = (data as DashboardShopProfile | undefined) ?? {
          id: profileId,
          name: payload.name ?? '',
          area: payload.area ?? '',
          price_min: payload.price_min ?? 0,
          price_max: payload.price_max ?? 0,
          service_type: payload.service_type ?? 'store',
          service_tags: payload.service_tags ?? [],
          description: payload.description ?? null,
          catch_copy: payload.catch_copy ?? null,
          address: payload.address ?? null,
          photos: payload.photos ?? [],
          contact: payload.contact ?? null,
          menus: payload.menus ?? [],
          staff: payload.staff ?? [],
          updated_at: payload.updated_at,
          status: payload.status ?? 'draft',
        }
        return { status: 'conflict', current: fallback }
      }
      case 422:
        return { status: 'validation_error', detail: data }
      default:
        return {
          status: 'error',
          message: `店舗情報の更新に失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardShopProfileUpdateResult
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '店舗情報の更新に失敗しました',
    }
  }
}

export async function createDashboardShopProfile(
  payload: DashboardShopProfileCreatePayload,
  options?: DashboardShopRequestOptions,
): Promise<DashboardShopProfileCreateResult> {
  try {
    const { response, data } = await requestJson<DashboardShopProfile | { detail?: unknown }>(
      'api/dashboard/shops',
      createRequestInit('POST', options, payload),
      [201],
    )

    switch (response.status) {
      case 201:
        return { status: 'success', data: data as DashboardShopProfile }
      case 401:
        return { status: 'unauthorized' }
      case 403:
        return { status: 'forbidden', detail: (data as { detail?: string } | undefined)?.detail }
      case 422:
        return {
          status: 'validation_error',
          detail: (data as { detail?: unknown } | undefined)?.detail,
        }
      default:
        return {
          status: 'error',
          message: `店舗情報の作成に失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardShopProfileCreateResult
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '店舗情報の作成に失敗しました',
    }
  }
}
