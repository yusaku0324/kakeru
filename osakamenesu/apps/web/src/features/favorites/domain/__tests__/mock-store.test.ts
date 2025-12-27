import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addMockFavorite, removeMockFavorite } from '../mock-store'
import type { FavoriteRecord } from '../types'

describe('favorites/domain/mock-store', () => {
  describe('addMockFavorite', () => {
    let favorites: Map<string, FavoriteRecord>

    beforeEach(() => {
      favorites = new Map()
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-12-27T10:00:00Z'))
    })

    it('adds a new favorite to the map', () => {
      const result = addMockFavorite(favorites, 'therapist-1')

      expect(favorites.size).toBe(1)
      expect(favorites.has('therapist-1')).toBe(true)
      expect(result.therapistId).toBe('therapist-1')
    })

    it('sets correct therapistId', () => {
      const result = addMockFavorite(favorites, 'therapist-123')
      expect(result.therapistId).toBe('therapist-123')
    })

    it('uses default shopId when not provided', () => {
      const result = addMockFavorite(favorites, 'therapist-1')
      expect(result.shopId).toBe('00000001-0000-0000-0000-000000000001')
    })

    it('uses provided shopId', () => {
      const result = addMockFavorite(favorites, 'therapist-1', 'custom-shop-id')
      expect(result.shopId).toBe('custom-shop-id')
    })

    it('sets createdAt to current timestamp', () => {
      const result = addMockFavorite(favorites, 'therapist-1')
      expect(result.createdAt).toBe('2024-12-27T10:00:00.000Z')
    })

    it('stores the record in the map', () => {
      addMockFavorite(favorites, 'therapist-1', 'shop-1')

      const stored = favorites.get('therapist-1')
      expect(stored).toBeDefined()
      expect(stored?.therapistId).toBe('therapist-1')
      expect(stored?.shopId).toBe('shop-1')
    })

    it('overwrites existing favorite with same therapistId', () => {
      addMockFavorite(favorites, 'therapist-1', 'shop-1')

      vi.setSystemTime(new Date('2024-12-28T10:00:00Z'))
      addMockFavorite(favorites, 'therapist-1', 'shop-2')

      expect(favorites.size).toBe(1)
      const stored = favorites.get('therapist-1')
      expect(stored?.shopId).toBe('shop-2')
      expect(stored?.createdAt).toBe('2024-12-28T10:00:00.000Z')
    })

    it('can add multiple different therapists', () => {
      addMockFavorite(favorites, 'therapist-1')
      addMockFavorite(favorites, 'therapist-2')
      addMockFavorite(favorites, 'therapist-3')

      expect(favorites.size).toBe(3)
      expect(favorites.has('therapist-1')).toBe(true)
      expect(favorites.has('therapist-2')).toBe(true)
      expect(favorites.has('therapist-3')).toBe(true)
    })
  })

  describe('removeMockFavorite', () => {
    let favorites: Map<string, FavoriteRecord>

    beforeEach(() => {
      favorites = new Map()
      favorites.set('therapist-1', {
        therapistId: 'therapist-1',
        shopId: 'shop-1',
        createdAt: '2024-12-27T10:00:00Z',
      })
      favorites.set('therapist-2', {
        therapistId: 'therapist-2',
        shopId: 'shop-2',
        createdAt: '2024-12-27T10:00:00Z',
      })
    })

    it('removes existing favorite and returns true', () => {
      const result = removeMockFavorite(favorites, 'therapist-1')

      expect(result).toBe(true)
      expect(favorites.has('therapist-1')).toBe(false)
      expect(favorites.size).toBe(1)
    })

    it('returns false when therapistId does not exist', () => {
      const result = removeMockFavorite(favorites, 'nonexistent')

      expect(result).toBe(false)
      expect(favorites.size).toBe(2)
    })

    it('does not affect other favorites', () => {
      removeMockFavorite(favorites, 'therapist-1')

      expect(favorites.has('therapist-2')).toBe(true)
      const remaining = favorites.get('therapist-2')
      expect(remaining?.shopId).toBe('shop-2')
    })

    it('can remove all favorites one by one', () => {
      removeMockFavorite(favorites, 'therapist-1')
      removeMockFavorite(favorites, 'therapist-2')

      expect(favorites.size).toBe(0)
    })

    it('returns false when removing from empty map', () => {
      const emptyFavorites = new Map<string, FavoriteRecord>()
      const result = removeMockFavorite(emptyFavorites, 'any-id')

      expect(result).toBe(false)
    })
  })
})
