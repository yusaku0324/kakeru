import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dashboardClient - must use inline factory to avoid hoisting issues
vi.mock('@/lib/http-clients', () => ({
  dashboardClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import { dashboardClient } from '@/lib/http-clients'
import {
  fetchShopManagers,
  addShopManager,
  updateShopManager,
  deleteShopManager,
  type ShopManager,
  type AddShopManagerResponse,
} from '../dashboard-managers'

// Cast to mock type
const mockDashboardClient = dashboardClient as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

describe('dashboard-managers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockManager: ShopManager = {
    id: 'manager-1',
    user_id: 'user-1',
    email: 'test@example.com',
    display_name: 'Test User',
    role: 'manager',
    created_at: '2024-12-26T00:00:00Z',
  }

  describe('fetchShopManagers', () => {
    it('fetches managers successfully', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: true,
        data: { managers: [mockManager] },
      })

      const result = await fetchShopManagers('shop-1')

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data).toEqual([mockManager])
      }
      expect(mockDashboardClient.get).toHaveBeenCalledWith('shops/shop-1/managers', {
        cookieHeader: undefined,
        signal: undefined,
        cache: undefined,
      })
    })

    it('passes options correctly', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: true,
        data: { managers: [] },
      })

      const controller = new AbortController()
      await fetchShopManagers('shop-1', {
        cookieHeader: 'session=abc',
        signal: controller.signal,
        cache: 'no-store',
      })

      expect(mockDashboardClient.get).toHaveBeenCalledWith('shops/shop-1/managers', {
        cookieHeader: 'session=abc',
        signal: controller.signal,
        cache: 'no-store',
      })
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await fetchShopManagers('shop-1')

      expect(result.status).toBe('unauthorized')
    })

    it('returns forbidden with object detail on 403', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: { detail: 'Access denied' },
      })

      const result = await fetchShopManagers('shop-1')

      expect(result.status).toBe('forbidden')
      if (result.status === 'forbidden') {
        expect(result.detail).toBe('Access denied')
      }
    })

    it('returns forbidden with string detail on 403', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: 'Simple string',
      })

      const result = await fetchShopManagers('shop-1')

      expect(result.status).toBe('forbidden')
      if (result.status === 'forbidden') {
        expect(result.detail).toBe('Simple string')
      }
    })

    it('returns not_found on 404', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await fetchShopManagers('shop-1')

      expect(result.status).toBe('not_found')
    })

    it('returns error on other status codes', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 500,
        error: 'Server error',
      })

      const result = await fetchShopManagers('shop-1')

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toBe('Server error')
      }
    })

    it('returns default error message when error is not provided', async () => {
      mockDashboardClient.get.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await fetchShopManagers('shop-1')

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toContain('スタッフ情報の取得に失敗しました')
      }
    })
  })

  describe('addShopManager', () => {
    const mockAddResponse: AddShopManagerResponse = {
      id: 'manager-new',
      user_id: 'user-new',
      email: 'new@example.com',
      display_name: 'New User',
      role: 'staff',
      created_at: '2024-12-27T00:00:00Z',
      user_created: true,
    }

    it('adds manager successfully', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: true,
        data: mockAddResponse,
      })

      const result = await addShopManager('shop-1', {
        email: 'new@example.com',
        role: 'staff',
      })

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data).toEqual(mockAddResponse)
      }
    })

    it('returns conflict on 409', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 409,
      })

      const result = await addShopManager('shop-1', {
        email: 'existing@example.com',
        role: 'staff',
      })

      expect(result.status).toBe('conflict')
      if (result.status === 'conflict') {
        expect(result.message).toContain('既にスタッフとして登録されています')
      }
    })

    it('returns validation_error on 422', async () => {
      const validationDetail = { email: ['Invalid email format'] }
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 422,
        detail: validationDetail,
      })

      const result = await addShopManager('shop-1', {
        email: 'invalid',
        role: 'staff',
      })

      expect(result.status).toBe('validation_error')
      if (result.status === 'validation_error') {
        expect(result.detail).toEqual(validationDetail)
      }
    })

    it('returns forbidden with string detail on 403', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: 'No permission to add staff',
      })

      const result = await addShopManager('shop-1', {
        email: 'test@example.com',
        role: 'staff',
      })

      expect(result.status).toBe('forbidden')
      if (result.status === 'forbidden') {
        expect(result.detail).toBe('No permission to add staff')
      }
    })

    it('returns forbidden with object detail on 403', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: { detail: 'Object detail message' },
      })

      const result = await addShopManager('shop-1', {
        email: 'test@example.com',
        role: 'staff',
      })

      expect(result.status).toBe('forbidden')
      if (result.status === 'forbidden') {
        expect(result.detail).toBe('Object detail message')
      }
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await addShopManager('shop-1', {
        email: 'test@example.com',
        role: 'staff',
      })

      expect(result.status).toBe('unauthorized')
    })

    it('returns not_found on 404', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await addShopManager('shop-1', {
        email: 'test@example.com',
        role: 'staff',
      })

      expect(result.status).toBe('not_found')
    })

    it('returns error on other status codes', async () => {
      mockDashboardClient.post.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await addShopManager('shop-1', {
        email: 'test@example.com',
        role: 'staff',
      })

      expect(result.status).toBe('error')
    })
  })

  describe('updateShopManager', () => {
    const updatedManager: ShopManager = {
      ...mockManager,
      role: 'owner',
    }

    it('updates manager successfully', async () => {
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: true,
        data: updatedManager,
      })

      const result = await updateShopManager('shop-1', 'manager-1', { role: 'owner' })

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data.role).toBe('owner')
      }
    })

    it('returns validation_error on 422', async () => {
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        detail: { role: ['Invalid role'] },
      })

      const result = await updateShopManager('shop-1', 'manager-1', { role: 'owner' })

      expect(result.status).toBe('validation_error')
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await updateShopManager('shop-1', 'manager-1', { role: 'owner' })

      expect(result.status).toBe('unauthorized')
    })

    it('returns forbidden with string detail on 403', async () => {
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: 'Cannot change role',
      })

      const result = await updateShopManager('shop-1', 'manager-1', { role: 'owner' })

      expect(result.status).toBe('forbidden')
      if (result.status === 'forbidden') {
        expect(result.detail).toBe('Cannot change role')
      }
    })

    it('returns forbidden with object detail on 403', async () => {
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: { detail: 'Object message' },
      })

      const result = await updateShopManager('shop-1', 'manager-1', { role: 'owner' })

      expect(result.status).toBe('forbidden')
      if (result.status === 'forbidden') {
        expect(result.detail).toBe('Object message')
      }
    })

    it('returns not_found on 404', async () => {
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await updateShopManager('shop-1', 'manager-1', { role: 'owner' })

      expect(result.status).toBe('not_found')
    })

    it('returns error on other status codes', async () => {
      mockDashboardClient.patch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        error: 'Internal error',
      })

      const result = await updateShopManager('shop-1', 'manager-1', { role: 'owner' })

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toBe('Internal error')
      }
    })
  })

  describe('deleteShopManager', () => {
    it('deletes manager successfully', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: true,
        data: { deleted: true, message: 'Deleted' },
      })

      const result = await deleteShopManager('shop-1', 'manager-1')

      expect(result.status).toBe('success')
    })

    it('returns cannot_remove_last_owner on 400 with specific detail', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: false,
        status: 400,
        detail: 'cannot_remove_last_owner',
      })

      const result = await deleteShopManager('shop-1', 'manager-1')

      expect(result.status).toBe('cannot_remove_last_owner')
    })

    it('returns error on 400 with other detail', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: false,
        status: 400,
        detail: 'some_other_error',
      })

      const result = await deleteShopManager('shop-1', 'manager-1')

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toBe('削除に失敗しました')
      }
    })

    it('returns unauthorized on 401', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await deleteShopManager('shop-1', 'manager-1')

      expect(result.status).toBe('unauthorized')
    })

    it('returns forbidden with string detail on 403', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: 'Cannot delete this manager',
      })

      const result = await deleteShopManager('shop-1', 'manager-1')

      expect(result.status).toBe('forbidden')
      if (result.status === 'forbidden') {
        expect(result.detail).toBe('Cannot delete this manager')
      }
    })

    it('returns forbidden with object detail on 403', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: false,
        status: 403,
        detail: { detail: 'Object detail' },
      })

      const result = await deleteShopManager('shop-1', 'manager-1')

      expect(result.status).toBe('forbidden')
      if (result.status === 'forbidden') {
        expect(result.detail).toBe('Object detail')
      }
    })

    it('returns not_found on 404', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await deleteShopManager('shop-1', 'manager-1')

      expect(result.status).toBe('not_found')
    })

    it('returns error on other status codes', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await deleteShopManager('shop-1', 'manager-1')

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toContain('スタッフの削除に失敗しました')
      }
    })

    it('passes options to client', async () => {
      mockDashboardClient.delete.mockResolvedValueOnce({
        ok: true,
        data: { deleted: true, message: 'Deleted' },
      })

      const controller = new AbortController()
      await deleteShopManager('shop-1', 'manager-1', {
        cookieHeader: 'session=xyz',
        signal: controller.signal,
        cache: 'force-cache',
      })

      expect(mockDashboardClient.delete).toHaveBeenCalledWith(
        'shops/shop-1/managers/manager-1',
        {
          cookieHeader: 'session=xyz',
          signal: controller.signal,
          cache: 'force-cache',
        },
      )
    })
  })
})
