/**
 * Reviews Dashboard API
 *
 * 垂直スライスアーキテクチャ: ダッシュボード向けレビューAPI
 */

import { buildApiUrl, resolveApiBases } from '@/lib/api'
import type {
  ReviewStatus,
  ReviewItem,
  ReviewListResponse,
  ReviewStats,
  DashboardReviewsRequestOptions,
  DashboardReviewsListResult,
  DashboardReviewsStatsResult,
  DashboardReviewsItemResult,
  DashboardReviewsError,
} from '../domain/types'

// =============================================================================
// Internal Helpers
// =============================================================================

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

// =============================================================================
// Public API Functions
// =============================================================================

/**
 * ダッシュボード用レビュー一覧を取得
 */
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

/**
 * ダッシュボード用レビュー統計を取得
 */
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

/**
 * ダッシュボード用レビューステータスを更新
 */
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
