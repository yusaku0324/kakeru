import { buildApiUrl, resolveApiBases } from '@/lib/api'

export type ReviewStatus = 'pending' | 'published' | 'rejected'

export type ReviewItem = {
  id: string
  profile_id: string
  status: ReviewStatus
  score: number
  title: string | null
  body: string
  author_alias: string | null
  visited_at: string | null
  created_at: string
  updated_at: string
  aspects: Record<string, unknown>
}

export type ReviewListResponse = {
  total: number
  items: ReviewItem[]
  aspect_averages: Record<string, number>
  aspect_counts: Record<string, number>
}

export type ReviewStats = {
  total: number
  pending: number
  published: number
  rejected: number
  average_score: number | null
}

export type DashboardReviewsRequestOptions = {
  cookieHeader?: string
  signal?: AbortSignal
  cache?: RequestCache
}

export type DashboardReviewsSuccess<T> = {
  status: 'success'
  data: T
}

export type DashboardReviewsUnauthenticated = {
  status: 'unauthorized'
}

export type DashboardReviewsForbidden = {
  status: 'forbidden'
  detail: string
}

export type DashboardReviewsNotFound = {
  status: 'not_found'
}

export type DashboardReviewsError = {
  status: 'error'
  message: string
}

export type DashboardReviewsListResult =
  | DashboardReviewsSuccess<ReviewListResponse>
  | DashboardReviewsUnauthenticated
  | DashboardReviewsForbidden
  | DashboardReviewsNotFound
  | DashboardReviewsError

export type DashboardReviewsStatsResult =
  | DashboardReviewsSuccess<ReviewStats>
  | DashboardReviewsUnauthenticated
  | DashboardReviewsForbidden
  | DashboardReviewsNotFound
  | DashboardReviewsError

export type DashboardReviewsItemResult =
  | DashboardReviewsSuccess<ReviewItem>
  | DashboardReviewsUnauthenticated
  | DashboardReviewsForbidden
  | DashboardReviewsNotFound
  | DashboardReviewsError

function createRequestInit(
  method: string,
  options?: DashboardReviewsRequestOptions,
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
  let lastError: DashboardReviewsError | null = null

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

export async function fetchDashboardReviews(
  profileId: string,
  params?: { status_filter?: ReviewStatus; page?: number; page_size?: number },
  options?: DashboardReviewsRequestOptions,
): Promise<DashboardReviewsListResult> {
  try {
    const searchParams = new URLSearchParams()
    if (params?.status_filter) searchParams.set('status_filter', params.status_filter)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.page_size) searchParams.set('page_size', String(params.page_size))

    const queryString = searchParams.toString()
    const path = `api/dashboard/shops/${profileId}/reviews${queryString ? `?${queryString}` : ''}`

    const { response, data } = await requestJson<ReviewListResponse>(
      path,
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
          detail: (data as { detail?: string } | undefined)?.detail ?? 'dashboard_access_denied',
        }
      case 404:
        return { status: 'not_found' }
      default:
        return {
          status: 'error',
          message: `口コミの取得に失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardReviewsError
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '口コミの取得に失敗しました',
    }
  }
}

export async function fetchDashboardReviewStats(
  profileId: string,
  options?: DashboardReviewsRequestOptions,
): Promise<DashboardReviewsStatsResult> {
  try {
    const { response, data } = await requestJson<ReviewStats>(
      `api/dashboard/shops/${profileId}/reviews/stats`,
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
          detail: (data as { detail?: string } | undefined)?.detail ?? 'dashboard_access_denied',
        }
      case 404:
        return { status: 'not_found' }
      default:
        return {
          status: 'error',
          message: `口コミ統計の取得に失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardReviewsError
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '口コミ統計の取得に失敗しました',
    }
  }
}

export async function updateDashboardReviewStatus(
  profileId: string,
  reviewId: string,
  status: ReviewStatus,
  options?: DashboardReviewsRequestOptions,
): Promise<DashboardReviewsItemResult> {
  try {
    const { response, data } = await requestJson<ReviewItem>(
      `api/dashboard/shops/${profileId}/reviews/${reviewId}/status`,
      createRequestInit('PUT', options, { status }),
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
          detail: (data as { detail?: string } | undefined)?.detail ?? 'dashboard_access_denied',
        }
      case 404:
        return { status: 'not_found' }
      default:
        return {
          status: 'error',
          message: `口コミのステータス更新に失敗しました (status=${response.status})`,
        }
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      return error as DashboardReviewsError
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '口コミのステータス更新に失敗しました',
    }
  }
}
