import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchAdminShops,
  fetchAdminShopDetail,
  updateAdminShopContent,
  createAdminShop,
  fetchShopAvailability,
  upsertShopAvailability,
} from '../adminShopsApi'

const originalFetch = global.fetch

describe('adminShopsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('fetchAdminShops', () => {
    it('fetches shops successfully', async () => {
      const mockShops = [
        { id: 'shop-1', name: 'Shop 1' },
        { id: 'shop-2', name: 'Shop 2' },
      ]
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: mockShops }),
      })

      const result = await fetchAdminShops()

      expect(result).toEqual(mockShops)
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/shops', { cache: 'no-store' })
    })

    it('returns empty array when no items', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const result = await fetchAdminShops()

      expect(result).toEqual([])
    })

    it('throws error on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ detail: 'Access denied' }),
      })

      await expect(fetchAdminShops()).rejects.toThrow('Access denied')
    })

    it('uses statusText when no detail in error', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      })

      await expect(fetchAdminShops()).rejects.toThrow('Internal Server Error')
    })

    it('uses fallback message when no detail or statusText', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: '',
        json: () => Promise.resolve({}),
      })

      await expect(fetchAdminShops()).rejects.toThrow('Request failed')
    })

    it('handles JSON parse error gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Gateway',
        json: () => Promise.reject(new Error('Invalid JSON')),
      })

      await expect(fetchAdminShops()).rejects.toThrow('Bad Gateway')
    })
  })

  describe('fetchAdminShopDetail', () => {
    it('fetches shop detail successfully', async () => {
      const mockShop = {
        id: 'shop-1',
        name: 'Test Shop',
        area: 'Tokyo',
        price_min: 5000,
        price_max: 10000,
      }
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockShop),
      })

      const result = await fetchAdminShopDetail('shop-1')

      expect(result).toEqual(mockShop)
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/shops/shop-1', { cache: 'no-store' })
    })

    it('throws error on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ detail: 'Shop not found' }),
      })

      await expect(fetchAdminShopDetail('invalid-id')).rejects.toThrow('Shop not found')
    })
  })

  describe('updateAdminShopContent', () => {
    const mockPayload = {
      name: 'Updated Shop',
      area: 'Osaka',
      price_min: 6000,
      price_max: 12000,
      service_type: 'relaxation',
      service_tags: ['massage', 'spa'],
      contact: { phone: '03-1234-5678' },
      photos: ['photo1.jpg'],
      menus: [],
      staff: [],
    }

    it('updates shop content successfully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await updateAdminShopContent('shop-1', mockPayload)

      expect(global.fetch).toHaveBeenCalledWith('/api/admin/shops/shop-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockPayload),
      })
    })

    it('throws error on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Validation Error',
        json: () => Promise.resolve({ detail: 'Invalid data' }),
      })

      await expect(updateAdminShopContent('shop-1', mockPayload)).rejects.toThrow('Invalid data')
    })
  })

  describe('createAdminShop', () => {
    it('creates shop successfully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-shop-id' }),
      })

      const result = await createAdminShop({ name: 'New Shop', area: 'Tokyo' })

      expect(result).toEqual({ id: 'new-shop-id' })
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Shop', area: 'Tokyo' }),
      })
    })

    it('throws error on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Conflict',
        json: () => Promise.resolve({ detail: 'Shop already exists' }),
      })

      await expect(createAdminShop({ name: 'Duplicate Shop' })).rejects.toThrow('Shop already exists')
    })
  })

  describe('fetchShopAvailability', () => {
    it('fetches availability successfully', async () => {
      const mockAvailability = {
        days: [
          { date: '2024-01-15', slots: [{ start_at: '10:00', end_at: '18:00' }] },
          { date: '2024-01-16', slots: [{ start_at: '10:00', end_at: '18:00' }] },
        ],
      }
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAvailability),
      })

      const result = await fetchShopAvailability('shop-1')

      expect(result).toEqual(mockAvailability)
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/shops/shop-1/availability', { cache: 'no-store' })
    })

    it('throws error on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ detail: 'Shop not found' }),
      })

      await expect(fetchShopAvailability('invalid-id')).rejects.toThrow('Shop not found')
    })
  })

  describe('upsertShopAvailability', () => {
    const mockPayload = {
      date: '2024-01-15',
      slots: [
        { start_at: '10:00', end_at: '14:00', status: 'available' },
        { start_at: '15:00', end_at: '18:00' },
      ],
    }

    it('upserts availability successfully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await upsertShopAvailability('shop-1', mockPayload)

      expect(global.fetch).toHaveBeenCalledWith('/api/admin/shops/shop-1/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockPayload),
      })
    })

    it('throws error on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ detail: 'Invalid slot format' }),
      })

      await expect(upsertShopAvailability('shop-1', mockPayload)).rejects.toThrow('Invalid slot format')
    })
  })
})
