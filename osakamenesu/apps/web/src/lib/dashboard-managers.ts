import { dashboardClient, type ApiErrorResult } from '@/lib/http-clients'

export type ShopManagerRole = 'owner' | 'manager' | 'staff'

export type ShopManager = {
  id: string
  user_id: string
  email: string
  display_name: string | null
  role: ShopManagerRole
  created_at: string
}

export type ShopManagerListResponse = {
  managers: ShopManager[]
}

export type AddShopManagerPayload = {
  email: string
  role: ShopManagerRole
}

export type AddShopManagerResponse = {
  id: string
  user_id: string
  email: string
  display_name: string | null
  role: string
  created_at: string
  user_created: boolean
}

export type UpdateShopManagerPayload = {
  role: ShopManagerRole
}

export type DashboardManagerRequestOptions = {
  cookieHeader?: string
  signal?: AbortSignal
  cache?: RequestCache
}

export type ShopManagerListResult =
  | { status: 'success'; data: ShopManager[] }
  | { status: 'unauthorized' }
  | { status: 'forbidden'; detail?: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

export type AddShopManagerResult =
  | { status: 'success'; data: AddShopManagerResponse }
  | { status: 'conflict'; message: string }
  | { status: 'validation_error'; detail: unknown }
  | { status: 'unauthorized' }
  | { status: 'forbidden'; detail?: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

export type UpdateShopManagerResult =
  | { status: 'success'; data: ShopManager }
  | { status: 'validation_error'; detail: unknown }
  | { status: 'unauthorized' }
  | { status: 'forbidden'; detail?: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

export type DeleteShopManagerResult =
  | { status: 'success' }
  | { status: 'unauthorized' }
  | { status: 'forbidden'; detail?: string }
  | { status: 'not_found' }
  | { status: 'cannot_remove_last_owner' }
  | { status: 'error'; message: string }

export async function fetchShopManagers(
  shopId: string,
  options?: DashboardManagerRequestOptions,
): Promise<ShopManagerListResult> {
  const result = await dashboardClient.get<ShopManagerListResponse>(
    `shops/${shopId}/managers`,
    {
      cookieHeader: options?.cookieHeader,
      signal: options?.signal,
      cache: options?.cache,
    },
  )

  if (result.ok) {
    return { status: 'success', data: result.data.managers }
  }

  const err = result as ApiErrorResult
  switch (err.status) {
    case 401:
      return { status: 'unauthorized' }
    case 403:
      return {
        status: 'forbidden',
        detail:
          typeof err.detail === 'object' && err.detail !== null
            ? (err.detail as { detail?: string }).detail
            : undefined,
      }
    case 404:
      return { status: 'not_found' }
    default:
      return {
        status: 'error',
        message: err.error || `スタッフ情報の取得に失敗しました (status=${err.status})`,
      }
  }
}

export async function addShopManager(
  shopId: string,
  payload: AddShopManagerPayload,
  options?: DashboardManagerRequestOptions,
): Promise<AddShopManagerResult> {
  const result = await dashboardClient.post<AddShopManagerResponse>(
    `shops/${shopId}/managers`,
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
  switch (err.status) {
    case 401:
      return { status: 'unauthorized' }
    case 403:
      return {
        status: 'forbidden',
        detail:
          typeof err.detail === 'string'
            ? err.detail
            : typeof err.detail === 'object' && err.detail !== null
              ? (err.detail as { detail?: string }).detail
              : undefined,
      }
    case 404:
      return { status: 'not_found' }
    case 409:
      return { status: 'conflict', message: 'このユーザーは既にスタッフとして登録されています' }
    case 422:
      return { status: 'validation_error', detail: err.detail }
    default:
      return {
        status: 'error',
        message: err.error || `スタッフの追加に失敗しました (status=${err.status})`,
      }
  }
}

export async function updateShopManager(
  shopId: string,
  managerId: string,
  payload: UpdateShopManagerPayload,
  options?: DashboardManagerRequestOptions,
): Promise<UpdateShopManagerResult> {
  const result = await dashboardClient.patch<ShopManager>(
    `shops/${shopId}/managers/${managerId}`,
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
  switch (err.status) {
    case 401:
      return { status: 'unauthorized' }
    case 403:
      return {
        status: 'forbidden',
        detail:
          typeof err.detail === 'string'
            ? err.detail
            : typeof err.detail === 'object' && err.detail !== null
              ? (err.detail as { detail?: string }).detail
              : undefined,
      }
    case 404:
      return { status: 'not_found' }
    case 422:
      return { status: 'validation_error', detail: err.detail }
    default:
      return {
        status: 'error',
        message: err.error || `スタッフ情報の更新に失敗しました (status=${err.status})`,
      }
  }
}

export async function deleteShopManager(
  shopId: string,
  managerId: string,
  options?: DashboardManagerRequestOptions,
): Promise<DeleteShopManagerResult> {
  const result = await dashboardClient.delete<{ deleted: boolean; message: string }>(
    `shops/${shopId}/managers/${managerId}`,
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
  switch (err.status) {
    case 400:
      if (err.detail === 'cannot_remove_last_owner') {
        return { status: 'cannot_remove_last_owner' }
      }
      return { status: 'error', message: '削除に失敗しました' }
    case 401:
      return { status: 'unauthorized' }
    case 403:
      return {
        status: 'forbidden',
        detail:
          typeof err.detail === 'string'
            ? err.detail
            : typeof err.detail === 'object' && err.detail !== null
              ? (err.detail as { detail?: string }).detail
              : undefined,
      }
    case 404:
      return { status: 'not_found' }
    default:
      return {
        status: 'error',
        message: err.error || `スタッフの削除に失敗しました (status=${err.status})`,
      }
  }
}
