import { dashboardClient, type ApiErrorResult } from '@/lib/http-clients'
import { buildApiUrl, resolveApiBases } from '@/lib/api'

export type DashboardShopServiceType = 'store' | 'dispatch'

export type DashboardShopContact = {
  phone?: string | null
  line_id?: string | null
  website_url?: string | null
  reservation_form_url?: string | null
  business_hours?: string | null
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

export async function fetchDashboardShopProfile(
  profileId: string,
  options?: DashboardShopRequestOptions,
): Promise<DashboardShopProfileFetchResult> {
  const result = await dashboardClient.get<DashboardShopProfile>(`shops/${profileId}/profile`, {
    cookieHeader: options?.cookieHeader,
    signal: options?.signal,
    cache: options?.cache,
  })

  if (result.ok) {
    return { status: 'success', data: result.data }
  }

  const err = result as ApiErrorResult
  switch (err.status) {
    case 401:
      return { status: 'unauthorized' }
    case 403:
      return {
        status: 'forbidden',
        detail: typeof err.detail === 'object' && err.detail !== null
          ? (err.detail as { detail?: string }).detail
          : undefined,
      }
    case 404:
      return { status: 'not_found' }
    default:
      return {
        status: 'error',
        message: err.error || `店舗情報の取得に失敗しました (status=${err.status})`,
      }
  }
}

export async function updateDashboardShopProfile(
  profileId: string,
  payload: DashboardShopProfileUpdatePayload,
  options?: DashboardShopRequestOptions,
): Promise<DashboardShopProfileUpdateResult> {
  const result = await dashboardClient.put<
    DashboardShopProfile | { detail?: { current?: DashboardShopProfile } }
  >(`shops/${profileId}/profile`, payload, {
    cookieHeader: options?.cookieHeader,
    signal: options?.signal,
    cache: options?.cache,
  })

  if (result.ok) {
    return { status: 'success', data: result.data as DashboardShopProfile }
  }

  const err = result as ApiErrorResult
  switch (err.status) {
    case 401:
      return { status: 'unauthorized' }
    case 403:
      return {
        status: 'forbidden',
        detail: typeof err.detail === 'object' && err.detail !== null
          ? (err.detail as { detail?: string }).detail
          : undefined,
      }
    case 404:
      return { status: 'not_found' }
    case 409: {
      const conflictDetail = err.detail as
        | { detail?: { current?: DashboardShopProfile } }
        | undefined
      if (conflictDetail?.detail?.current) {
        return { status: 'conflict', current: conflictDetail.detail.current }
      }
      const refreshed = await fetchDashboardShopProfile(profileId, options)
      if (refreshed.status === 'success') {
        return { status: 'conflict', current: refreshed.data }
      }
      const fallback: DashboardShopProfile = {
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
      return { status: 'validation_error', detail: err.detail }
    default:
      return {
        status: 'error',
        message: err.error || `店舗情報の更新に失敗しました (status=${err.status})`,
      }
  }
}

export async function createDashboardShopProfile(
  payload: DashboardShopProfileCreatePayload,
  options?: DashboardShopRequestOptions,
): Promise<DashboardShopProfileCreateResult> {
  const result = await dashboardClient.post<DashboardShopProfile | { detail?: unknown }>(
    'shops',
    payload,
    {
      cookieHeader: options?.cookieHeader,
      signal: options?.signal,
      cache: options?.cache,
    },
  )

  if (result.ok && result.status === 201) {
    return { status: 'success', data: result.data as DashboardShopProfile }
  }

  if (result.ok) {
    // Unexpected success status - treat as error
    return {
      status: 'error',
      message: `店舗情報の作成に失敗しました (status=${result.status})`,
    }
  }

  const err = result as ApiErrorResult
  switch (err.status) {
    case 401:
      return { status: 'unauthorized' }
    case 403:
      return {
        status: 'forbidden',
        detail: typeof err.detail === 'object' && err.detail !== null
          ? (err.detail as { detail?: string }).detail
          : undefined,
      }
    case 422:
      return {
        status: 'validation_error',
        detail: typeof err.detail === 'object' && err.detail !== null
          ? (err.detail as { detail?: unknown }).detail
          : err.detail,
      }
    default:
      return {
        status: 'error',
        message: err.error || `店舗情報の作成に失敗しました (status=${err.status})`,
      }
  }
}

export type DashboardShopPhotoUploadResponse = {
  url: string
  filename: string
  content_type: string
  size: number
}

export type DashboardShopPhotoUploadResult =
  | { status: 'success'; data: DashboardShopPhotoUploadResponse }
  | { status: 'too_large'; limitBytes?: number }
  | { status: 'unsupported_media_type'; message?: string }
  | { status: 'validation_error'; message?: string }
  | { status: 'unauthorized' }
  | { status: 'forbidden'; detail?: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

export async function uploadDashboardShopPhoto(
  profileId: string,
  file: File,
  options?: DashboardShopRequestOptions,
): Promise<DashboardShopPhotoUploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  const headers: Record<string, string> = {}
  if (options?.cookieHeader) {
    headers.cookie = options.cookieHeader
  }

  const init: RequestInit = {
    method: 'POST',
    cache: options?.cache ?? 'no-store',
    signal: options?.signal,
    credentials: options?.cookieHeader ? 'omit' : 'include',
    body: formData,
  }

  if (Object.keys(headers).length) {
    init.headers = headers
  }

  try {
    for (const base of resolveApiBases()) {
      try {
        const res = await fetch(
          buildApiUrl(base, `dashboard/shops/${profileId}/photos/upload`),
          init,
        )

        if (res.status === 201) {
          const data = (await res.json()) as DashboardShopPhotoUploadResponse
          return { status: 'success', data }
        }

        switch (res.status) {
          case 401:
            return { status: 'unauthorized' }
          case 403: {
            const json = (await res.json().catch(() => ({}))) as { detail?: string }
            return { status: 'forbidden', detail: json?.detail }
          }
          case 404:
            return { status: 'not_found' }
          case 413: {
            const json = (await res.json().catch(() => ({}))) as { limit_bytes?: number }
            return { status: 'too_large', limitBytes: json?.limit_bytes }
          }
          case 415: {
            const json = (await res.json().catch(() => ({}))) as { message?: string }
            return { status: 'unsupported_media_type', message: json?.message }
          }
          case 422: {
            const json = (await res.json().catch(() => ({}))) as { message?: string }
            return { status: 'validation_error', message: json?.message }
          }
          default:
            continue
        }
      } catch {
        continue
      }
    }

    return { status: 'error', message: '写真のアップロードに失敗しました' }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '写真のアップロードに失敗しました',
    }
  }
}
