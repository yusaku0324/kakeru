import { act, renderHook, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

import { useAdminShopsController } from '@/features/shops/usecases/useAdminShopsController'

const apiMocks = vi.hoisted(() => ({
  fetchAdminShops: vi.fn(),
  fetchAdminShopDetail: vi.fn(),
  fetchShopAvailability: vi.fn(),
  updateAdminShopContent: vi.fn(),
  createAdminShop: vi.fn(),
  upsertShopAvailability: vi.fn(),
}))

vi.mock('@/features/shops/infra/adminShopsApi', () => apiMocks)

const getMocks = () => apiMocks

describe('useAdminShopsController service tags helpers', () => {
  beforeEach(() => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockResolvedValue([])
    mocks.fetchAdminShopDetail.mockResolvedValue(null)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })
  })

  afterEach(() => {
    Object.values(getMocks()).forEach(mockFn => mockFn.mockReset())
  })

  it('adds a trimmed unique service tag and clears the draft', async () => {
    const { result } = renderHook(() => useAdminShopsController())

    await waitFor(() => expect(getMocks().fetchAdminShops).toHaveBeenCalled())

    act(() => {
      result.current.actions.setTagDraft('  アロマ ')
    })
    act(() => {
      result.current.actions.addServiceTag()
    })

    expect(result.current.state.form.serviceTags).toEqual(['アロマ'])
    expect(result.current.state.tagDraft).toBe('')

    act(() => {
      result.current.actions.setTagDraft('アロマ')
      result.current.actions.addServiceTag()
    })

    expect(result.current.state.form.serviceTags).toEqual(['アロマ'])
  })

  it('removes service tags by index via removeServiceTag', async () => {
    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(getMocks().fetchAdminShops).toHaveBeenCalled())

    act(() => {
      result.current.actions.setServiceTags(['指圧', 'オイル', 'ストレッチ'])
    })
    act(() => {
      result.current.actions.removeServiceTag(1)
    })

    expect(result.current.state.form.serviceTags).toEqual(['指圧', 'ストレッチ'])
  })

  it('removes unsaved availability day locally', async () => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockResolvedValue([])
    const { result } = renderHook(() => useAdminShopsController())

    await waitFor(() => expect(mocks.fetchAdminShops).toHaveBeenCalledTimes(1))

    act(() => {
      result.current.actions.addAvailabilityDay()
      result.current.actions.updateAvailabilityDate(0, '')
    })

    act(() => {
      result.current.actions.deleteAvailabilityDay(0)
    })

    expect(result.current.state.availability).toHaveLength(0)
    expect(mocks.upsertShopAvailability).not.toHaveBeenCalled()
  })

  it('clears persisted availability day via API when date exists', async () => {
    const mocks = getMocks()
    const shopId = 'shop-1'
    mocks.fetchAdminShops.mockResolvedValue([
      { id: shopId, name: 'サンプル', slug: 'sample', area: '心斎橋', status: 'draft', service_type: 'store' },
    ])
    mocks.fetchAdminShopDetail.mockResolvedValue({
      id: shopId,
      slug: 'sample',
      name: 'サンプル',
      area: '心斎橋',
      price_min: 0,
      price_max: 0,
      service_type: 'store',
      service_tags: [],
      contact: null,
      description: '',
      catch_copy: '',
      address: '',
      photos: [],
      menus: [],
      staff: [],
      availability: [],
    })
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })
    const { result } = renderHook(() => useAdminShopsController())

    await waitFor(() => expect(result.current.state.selectedId).toBe(shopId))

    act(() => {
      result.current.actions.addAvailabilityDay()
    })

    await act(async () => {
      await result.current.actions.deleteAvailabilityDay(0)
    })

    expect(mocks.upsertShopAvailability).toHaveBeenCalledTimes(1)
    const payload = mocks.upsertShopAvailability.mock.calls[0]
    expect(payload[0]).toBe(shopId)
  })
})

describe('useAdminShopsController availability and validation', () => {
  beforeEach(() => {
    const mocks = getMocks()
    Object.values(mocks).forEach(mockFn => mockFn.mockReset())
  })

  const baseShop = {
    id: 'shop-alpha',
    name: 'アルファ',
    slug: 'alpha',
    area: '難波',
    status: 'published',
    service_type: 'store',
  }

  const baseDetail = {
    id: baseShop.id,
    slug: baseShop.slug,
    name: baseShop.name,
    area: baseShop.area,
    price_min: 0,
    price_max: 0,
    service_type: 'store',
    service_tags: [],
    contact: null,
    description: '',
    catch_copy: '',
    address: '',
    photos: [],
    menus: [],
    staff: [],
    availability: [],
  }

  it('saves availability slots and refreshes the calendar', async () => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockResolvedValue([baseShop])
    mocks.fetchAdminShopDetail.mockResolvedValue(baseDetail)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })
    mocks.upsertShopAvailability.mockResolvedValue({ ok: true })

    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(result.current.state.selectedId).toBe(baseShop.id))

    const slot = { start_at: '2024-02-01T09:00', end_at: '2024-02-01T10:00', status: 'open' as const }

    await act(async () => {
      const saved = await result.current.actions.saveAvailability('2024-02-01', [slot])
      expect(saved).toBe(true)
    })

    expect(mocks.upsertShopAvailability).toHaveBeenCalledWith(baseShop.id, {
      date: '2024-02-01',
      slots: [
        {
          start_at: new Date(slot.start_at).toISOString(),
          end_at: new Date(slot.end_at).toISOString(),
          status: 'open',
        },
      ],
    })
    expect(mocks.fetchShopAvailability).toHaveBeenCalledTimes(2)
  })

  it('requires slug only when creating a new shop', async () => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockResolvedValue([])
    mocks.fetchAdminShopDetail.mockResolvedValue(null)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })

    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(mocks.fetchAdminShops).toHaveBeenCalled())

    await act(async () => {
      result.current.actions.startCreate()
    })
    expect(result.current.state.canSave).toBe(false)

    await act(async () => {
      result.current.actions.updateForm('name', '新店舗')
    })
    expect(result.current.state.canSave).toBe(false)

    await act(async () => {
      result.current.actions.updateForm('slug', 'new-shop')
    })
    expect(result.current.state.canSave).toBe(true)
  })
})
