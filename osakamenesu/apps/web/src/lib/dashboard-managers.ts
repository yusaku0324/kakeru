import { dashboardClient, type ApiErrorResult } from '@/lib/http-clients'
import {
  type DashboardRequestOptions,
  handleCommonError,
  createErrorResult,
  extractDetailString,
} from '@/lib/dashboard-common'

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

// Re-export shared type for backward compatibility
export type DashboardManagerRequestOptions = DashboardRequestOptions

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
  const commonResult = handleCommonError(err, 'スタッフ情報の取得に失敗しました')
  if (commonResult) {
    return commonResult
  }

  return createErrorResult(err, 'スタッフ情報の取得に失敗しました')
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

  // Handle common errors (401, 403, 404)
  const commonResult = handleCommonError(err, 'スタッフの追加に失敗しました')
  if (commonResult) {
    // For 403, extract detail using both string and object formats
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
    return { status: 'conflict', message: 'このユーザーは既にスタッフとして登録されています' }
  }

  // Handle validation error (422)
  if (err.status === 422) {
    return { status: 'validation_error', detail: err.detail }
  }

  return createErrorResult(err, 'スタッフの追加に失敗しました')
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

  // Handle common errors (401, 403, 404)
  const commonResult = handleCommonError(err, 'スタッフ情報の更新に失敗しました')
  if (commonResult) {
    if (err.status === 403) {
      return {
        status: 'forbidden',
        detail: extractDetailString(err.detail),
      }
    }
    return commonResult
  }

  // Handle validation error (422)
  if (err.status === 422) {
    return { status: 'validation_error', detail: err.detail }
  }

  return createErrorResult(err, 'スタッフ情報の更新に失敗しました')
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

  // Handle special 400 case for last owner
  if (err.status === 400) {
    if (err.detail === 'cannot_remove_last_owner') {
      return { status: 'cannot_remove_last_owner' }
    }
    return { status: 'error', message: '削除に失敗しました' }
  }

  // Handle common errors (401, 403, 404)
  const commonResult = handleCommonError(err, 'スタッフの削除に失敗しました')
  if (commonResult) {
    if (err.status === 403) {
      return {
        status: 'forbidden',
        detail: extractDetailString(err.detail),
      }
    }
    return commonResult
  }

  return createErrorResult(err, 'スタッフの削除に失敗しました')
}
