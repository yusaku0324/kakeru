import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  CACHE_TAGS,
  CACHE_REVALIDATE_SECONDS,
} from '../cache-tags'

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

describe('CACHE_TAGS', () => {
  it('has correct static tags', () => {
    expect(CACHE_TAGS.stores).toBe('stores')
    expect(CACHE_TAGS.searchFacets).toBe('search-facets')
    expect(CACHE_TAGS.homeFeatured).toBe('home-featured')
  })

  it('generates store tag with id', () => {
    expect(CACHE_TAGS.store('123')).toBe('store-123')
    expect(CACHE_TAGS.store('abc')).toBe('store-abc')
  })

  it('generates staff tag with id', () => {
    expect(CACHE_TAGS.staff('456')).toBe('staff-456')
  })

  it('generates slots tag with storeId and date', () => {
    expect(CACHE_TAGS.slots('store1', '20240115')).toBe('slots-store1-20240115')
  })
})

describe('CACHE_REVALIDATE_SECONDS', () => {
  it('has correct revalidation times', () => {
    const oneHour = 60 * 60
    const oneDay = 60 * 60 * 24

    expect(CACHE_REVALIDATE_SECONDS.homeFeatured).toBe(oneHour)
    expect(CACHE_REVALIDATE_SECONDS.searchFacets).toBe(oneHour)
    expect(CACHE_REVALIDATE_SECONDS.stores).toBe(oneHour)
    expect(CACHE_REVALIDATE_SECONDS.staff).toBe(oneHour)
    expect(CACHE_REVALIDATE_SECONDS.slots).toBe(oneDay)
  })
})

describe('revalidate functions', () => {
  let revalidateTag: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()
    const nextCache = await import('next/cache')
    revalidateTag = nextCache.revalidateTag as ReturnType<typeof vi.fn>
    revalidateTag.mockClear()
  })

  it('revalidateHomeFeatured calls revalidateTag with correct tag', async () => {
    const { revalidateHomeFeatured } = await import('../cache-tags')
    revalidateHomeFeatured()
    expect(revalidateTag).toHaveBeenCalledWith('home-featured')
  })

  it('revalidateStores calls revalidateTag with correct tag', async () => {
    const { revalidateStores } = await import('../cache-tags')
    revalidateStores()
    expect(revalidateTag).toHaveBeenCalledWith('stores')
  })

  it('revalidateStore calls revalidateTag with store id', async () => {
    const { revalidateStore } = await import('../cache-tags')
    revalidateStore('test-id')
    expect(revalidateTag).toHaveBeenCalledWith('store-test-id')
  })

  it('revalidateStaff calls revalidateTag with staff id', async () => {
    const { revalidateStaff } = await import('../cache-tags')
    revalidateStaff('staff-id')
    expect(revalidateTag).toHaveBeenCalledWith('staff-staff-id')
  })

  it('revalidateSlots calls revalidateTag with storeId and date', async () => {
    const { revalidateSlots } = await import('../cache-tags')
    revalidateSlots('store123', '20240115')
    expect(revalidateTag).toHaveBeenCalledWith('slots-store123-20240115')
  })
})
