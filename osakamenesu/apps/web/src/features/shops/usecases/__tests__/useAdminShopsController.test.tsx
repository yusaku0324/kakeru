import { act, renderHook, waitFor } from '@testing-library/react'
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest'

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

// Mock timezone functions
vi.mock('@/lib/timezone', () => ({
  formatDatetimeLocal: (value: unknown) => {
    if (typeof value === 'string') return value?.slice(0, 16) || ''
    if (value && typeof value === 'object' && 'toISOString' in value) {
      return (value as { toISOString: () => string }).toISOString().slice(0, 16)
    }
    return ''
  },
  formatZonedIso: (value?: unknown) => {
    if (typeof value === 'string') return value || new Date().toISOString().slice(0, 10)
    if (value && typeof value === 'object' && 'toISOString' in value) {
      return (value as { toISOString: () => string }).toISOString()
    }
    return new Date().toISOString().slice(0, 10)
  },
  toZonedDayjs: () => ({
    add: () => ({
      toISOString: () => '2024-01-01T11:00:00+09:00',
    }),
    toISOString: () => '2024-01-01T10:00:00+09:00',
  }),
}))

const getMocks = () => apiMocks

const baseShop = {
  id: 'shop-1',
  name: 'テスト店舗',
  slug: 'test-shop',
  area: '心斎橋',
  status: 'published',
  service_type: 'store',
}

const baseDetail = {
  id: baseShop.id,
  slug: baseShop.slug,
  name: baseShop.name,
  area: baseShop.area,
  price_min: 5000,
  price_max: 15000,
  service_type: 'store',
  service_tags: ['アロマ', 'オイル'],
  contact: { phone: '06-1234-5678', line_id: 'testline' },
  description: 'テスト説明',
  catch_copy: 'キャッチコピー',
  address: '大阪市中央区',
  photos: ['photo1.jpg', 'photo2.jpg'],
  menus: [{ id: 'm1', name: '60分コース', price: 8000, duration_minutes: 60, description: '', tags: [] }],
  staff: [{ id: 's1', name: 'スタッフA', alias: 'A', headline: '', specialties: ['アロマ'] }],
  availability: [],
}

describe('useAdminShopsController service tags helpers', () => {
  beforeEach(() => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockResolvedValue([])
    mocks.fetchAdminShopDetail.mockResolvedValue(null)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })
  })

  afterEach(() => {
    Object.values(getMocks()).forEach((mockFn) => mockFn.mockReset())
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
      {
        id: shopId,
        name: 'サンプル',
        slug: 'sample',
        area: '心斎橋',
        status: 'draft',
        service_type: 'store',
      },
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
    Object.values(mocks).forEach((mockFn) => mockFn.mockReset())
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

    const slot = {
      start_at: '2024-02-01T09:00',
      end_at: '2024-02-01T10:00',
      status: 'open' as const,
    }

    await act(async () => {
      const saved = await result.current.actions.saveAvailability('2024-02-01', [slot])
      expect(saved).toBe(true)
    })

    const savedPayload = mocks.upsertShopAvailability.mock.calls[0]?.[1]
    expect(savedPayload).toMatchObject({ date: '2024-02-01' })
    expect(savedPayload?.slots?.length).toBe(1)
    expect(savedPayload?.slots?.[0]).toMatchObject({ status: 'open' })
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

describe('useAdminShopsController shop loading', () => {
  beforeEach(() => {
    Object.values(getMocks()).forEach((mockFn) => mockFn.mockReset())
  })

  it('loads shops on mount and auto-selects first shop', async () => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockResolvedValue([baseShop])
    mocks.fetchAdminShopDetail.mockResolvedValue(baseDetail)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })

    const { result } = renderHook(() => useAdminShopsController())

    await waitFor(() => expect(result.current.state.selectedId).toBe('shop-1'))
    expect(result.current.state.shops).toHaveLength(1)
    expect(result.current.state.shops[0].name).toBe('テスト店舗')
  })

  it('notifies error when loadShops fails', async () => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockRejectedValue(new Error('Network error'))
    const onError = vi.fn()

    renderHook(() => useAdminShopsController({ onError }))

    await waitFor(() => expect(onError).toHaveBeenCalledWith('店舗一覧の取得に失敗しました'))
  })

  it('loads detail when shop is selected', async () => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockResolvedValue([baseShop])
    mocks.fetchAdminShopDetail.mockResolvedValue(baseDetail)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })

    const { result } = renderHook(() => useAdminShopsController())

    await waitFor(() => expect(result.current.state.detail).not.toBeNull())
    expect(result.current.state.form.name).toBe('テスト店舗')
    expect(result.current.state.form.priceMin).toBe(5000)
    expect(result.current.state.form.serviceTags).toEqual(['アロマ', 'オイル'])
  })

  it('notifies error when loadDetail fails', async () => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockResolvedValue([baseShop])
    mocks.fetchAdminShopDetail.mockRejectedValue(new Error('Detail error'))
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })
    const onError = vi.fn()

    renderHook(() => useAdminShopsController({ onError }))

    await waitFor(() => expect(onError).toHaveBeenCalledWith('店舗詳細の取得に失敗しました'))
  })
})

describe('useAdminShopsController form operations', () => {
  beforeEach(() => {
    const mocks = getMocks()
    Object.values(mocks).forEach((mockFn) => mockFn.mockReset())
    mocks.fetchAdminShops.mockResolvedValue([])
    mocks.fetchAdminShopDetail.mockResolvedValue(null)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })
  })

  it('updateForm updates a single form field', async () => {
    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(getMocks().fetchAdminShops).toHaveBeenCalled())

    act(() => {
      result.current.actions.updateForm('name', '新しい店舗名')
    })
    expect(result.current.state.form.name).toBe('新しい店舗名')

    act(() => {
      result.current.actions.updateForm('area', '梅田')
    })
    expect(result.current.state.form.area).toBe('梅田')
  })

  it('updateContact updates contact info partially', async () => {
    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(getMocks().fetchAdminShops).toHaveBeenCalled())

    act(() => {
      result.current.actions.updateContact({ phone: '06-1234-5678' })
    })
    expect(result.current.state.form.contact.phone).toBe('06-1234-5678')

    act(() => {
      result.current.actions.updateContact({ line_id: 'myline' })
    })
    expect(result.current.state.form.contact.phone).toBe('06-1234-5678')
    expect(result.current.state.form.contact.line_id).toBe('myline')
  })
})

describe('useAdminShopsController menu operations', () => {
  beforeEach(() => {
    const mocks = getMocks()
    Object.values(mocks).forEach((mockFn) => mockFn.mockReset())
    mocks.fetchAdminShops.mockResolvedValue([])
    mocks.fetchAdminShopDetail.mockResolvedValue(null)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })
  })

  it('addMenu adds an empty menu item', async () => {
    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(getMocks().fetchAdminShops).toHaveBeenCalled())

    expect(result.current.state.form.menus).toHaveLength(0)

    act(() => {
      result.current.actions.addMenu()
    })
    expect(result.current.state.form.menus).toHaveLength(1)
    expect(result.current.state.form.menus[0]).toMatchObject({
      name: '',
      price: 0,
      description: '',
    })
  })

  it('updateMenu updates menu at specified index', async () => {
    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(getMocks().fetchAdminShops).toHaveBeenCalled())

    act(() => {
      result.current.actions.addMenu()
      result.current.actions.addMenu()
    })

    act(() => {
      result.current.actions.updateMenu(0, { name: '60分コース', price: 8000 })
      result.current.actions.updateMenu(1, { name: '90分コース', price: 12000 })
    })

    expect(result.current.state.form.menus[0].name).toBe('60分コース')
    expect(result.current.state.form.menus[0].price).toBe(8000)
    expect(result.current.state.form.menus[1].name).toBe('90分コース')
  })

  it('removeMenu removes menu at specified index', async () => {
    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(getMocks().fetchAdminShops).toHaveBeenCalled())

    act(() => {
      result.current.actions.addMenu()
      result.current.actions.addMenu()
      result.current.actions.updateMenu(0, { name: 'コースA' })
      result.current.actions.updateMenu(1, { name: 'コースB' })
    })

    act(() => {
      result.current.actions.removeMenu(0)
    })

    expect(result.current.state.form.menus).toHaveLength(1)
    expect(result.current.state.form.menus[0].name).toBe('コースB')
  })
})

describe('useAdminShopsController staff operations', () => {
  beforeEach(() => {
    const mocks = getMocks()
    Object.values(mocks).forEach((mockFn) => mockFn.mockReset())
    mocks.fetchAdminShops.mockResolvedValue([])
    mocks.fetchAdminShopDetail.mockResolvedValue(null)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })
  })

  it('addStaff adds an empty staff member', async () => {
    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(getMocks().fetchAdminShops).toHaveBeenCalled())

    expect(result.current.state.form.staff).toHaveLength(0)

    act(() => {
      result.current.actions.addStaff()
    })
    expect(result.current.state.form.staff).toHaveLength(1)
    expect(result.current.state.form.staff[0]).toMatchObject({
      name: '',
      alias: '',
      headline: '',
      specialties: [],
    })
  })

  it('updateStaff updates staff at specified index', async () => {
    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(getMocks().fetchAdminShops).toHaveBeenCalled())

    act(() => {
      result.current.actions.addStaff()
    })

    act(() => {
      result.current.actions.updateStaff(0, {
        name: 'スタッフ太郎',
        alias: 'タロウ',
        specialties: ['オイル', 'アロマ'],
      })
    })

    expect(result.current.state.form.staff[0].name).toBe('スタッフ太郎')
    expect(result.current.state.form.staff[0].alias).toBe('タロウ')
    expect(result.current.state.form.staff[0].specialties).toEqual(['オイル', 'アロマ'])
  })

  it('removeStaff removes staff at specified index', async () => {
    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(getMocks().fetchAdminShops).toHaveBeenCalled())

    act(() => {
      result.current.actions.addStaff()
      result.current.actions.addStaff()
      result.current.actions.updateStaff(0, { name: 'スタッフA' })
      result.current.actions.updateStaff(1, { name: 'スタッフB' })
    })

    act(() => {
      result.current.actions.removeStaff(0)
    })

    expect(result.current.state.form.staff).toHaveLength(1)
    expect(result.current.state.form.staff[0].name).toBe('スタッフB')
  })
})

describe('useAdminShopsController photo operations', () => {
  beforeEach(() => {
    const mocks = getMocks()
    Object.values(mocks).forEach((mockFn) => mockFn.mockReset())
    mocks.fetchAdminShops.mockResolvedValue([])
    mocks.fetchAdminShopDetail.mockResolvedValue(null)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })
  })

  it('addPhoto adds an empty photo slot', async () => {
    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(getMocks().fetchAdminShops).toHaveBeenCalled())

    const initialCount = result.current.state.form.photos.length

    act(() => {
      result.current.actions.addPhoto()
    })
    expect(result.current.state.form.photos).toHaveLength(initialCount + 1)
  })

  it('updatePhoto updates photo URL at specified index', async () => {
    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(getMocks().fetchAdminShops).toHaveBeenCalled())

    act(() => {
      result.current.actions.updatePhoto(0, 'https://example.com/photo1.jpg')
    })

    expect(result.current.state.form.photos[0]).toBe('https://example.com/photo1.jpg')
  })

  it('removePhoto removes photo at specified index', async () => {
    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(getMocks().fetchAdminShops).toHaveBeenCalled())

    act(() => {
      result.current.actions.addPhoto()
      result.current.actions.updatePhoto(0, 'photo1.jpg')
      result.current.actions.updatePhoto(1, 'photo2.jpg')
    })

    act(() => {
      result.current.actions.removePhoto(0)
    })

    expect(result.current.state.form.photos).toHaveLength(1)
    expect(result.current.state.form.photos[0]).toBe('photo2.jpg')
  })
})

describe('useAdminShopsController slot operations', () => {
  beforeEach(() => {
    const mocks = getMocks()
    Object.values(mocks).forEach((mockFn) => mockFn.mockReset())
    mocks.fetchAdminShops.mockResolvedValue([])
    mocks.fetchAdminShopDetail.mockResolvedValue(null)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })
  })

  it('addSlot adds a new slot to the specified day', async () => {
    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(getMocks().fetchAdminShops).toHaveBeenCalled())

    act(() => {
      result.current.actions.addAvailabilityDay()
    })

    expect(result.current.state.availability[0].slots).toHaveLength(0)

    act(() => {
      result.current.actions.addSlot(0)
    })

    expect(result.current.state.availability[0].slots).toHaveLength(1)
    expect(result.current.state.availability[0].slots[0].status).toBe('open')
  })

  it('updateSlot updates slot at specified day and slot index', async () => {
    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(getMocks().fetchAdminShops).toHaveBeenCalled())

    act(() => {
      result.current.actions.addAvailabilityDay()
      result.current.actions.addSlot(0)
    })

    act(() => {
      result.current.actions.updateSlot(0, 0, 'status', 'reserved')
    })

    expect(result.current.state.availability[0].slots[0].status).toBe('reserved')
  })

  it('removeSlot removes slot at specified day and slot index', async () => {
    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(getMocks().fetchAdminShops).toHaveBeenCalled())

    act(() => {
      result.current.actions.addAvailabilityDay()
      result.current.actions.addSlot(0)
      result.current.actions.addSlot(0)
    })

    expect(result.current.state.availability[0].slots).toHaveLength(2)

    act(() => {
      result.current.actions.removeSlot(0, 0)
    })

    expect(result.current.state.availability[0].slots).toHaveLength(1)
  })
})

describe('useAdminShopsController saveContent', () => {
  beforeEach(() => {
    Object.values(getMocks()).forEach((mockFn) => mockFn.mockReset())
  })

  it('creates a new shop when in creating mode', async () => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockResolvedValue([])
    mocks.fetchAdminShopDetail.mockResolvedValue(null)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })
    mocks.createAdminShop.mockResolvedValue({ id: 'new-shop-id' })
    const onSuccess = vi.fn()

    const { result } = renderHook(() => useAdminShopsController({ onSuccess }))
    await waitFor(() => expect(mocks.fetchAdminShops).toHaveBeenCalled())

    act(() => {
      result.current.actions.startCreate()
      result.current.actions.updateForm('name', '新規店舗')
      result.current.actions.updateForm('slug', 'new-shop')
    })

    await act(async () => {
      await result.current.actions.saveContent()
    })

    expect(mocks.createAdminShop).toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledWith('店舗を作成しました')
    expect(result.current.state.isCreating).toBe(false)
    expect(result.current.state.selectedId).toBe('new-shop-id')
  })

  it('updates existing shop content', async () => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockResolvedValue([baseShop])
    mocks.fetchAdminShopDetail.mockResolvedValue(baseDetail)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })
    mocks.updateAdminShopContent.mockResolvedValue({ ok: true })
    const onSuccess = vi.fn()

    const { result } = renderHook(() => useAdminShopsController({ onSuccess }))
    await waitFor(() => expect(result.current.state.selectedId).toBe('shop-1'))

    act(() => {
      result.current.actions.updateForm('name', '更新店舗名')
    })

    await act(async () => {
      await result.current.actions.saveContent()
    })

    expect(mocks.updateAdminShopContent).toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledWith('店舗情報を保存しました')
  })

  it('notifies error when name is missing', async () => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockResolvedValue([])
    mocks.fetchAdminShopDetail.mockResolvedValue(null)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })
    const onError = vi.fn()

    const { result } = renderHook(() => useAdminShopsController({ onError }))
    await waitFor(() => expect(mocks.fetchAdminShops).toHaveBeenCalled())

    act(() => {
      result.current.actions.startCreate()
      result.current.actions.updateForm('slug', 'new-shop')
    })

    await act(async () => {
      await result.current.actions.saveContent()
    })

    expect(onError).toHaveBeenCalledWith('店舗名を入力してください')
    expect(mocks.createAdminShop).not.toHaveBeenCalled()
  })

  it('notifies error when slug is missing in create mode', async () => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockResolvedValue([])
    mocks.fetchAdminShopDetail.mockResolvedValue(null)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })
    const onError = vi.fn()

    const { result } = renderHook(() => useAdminShopsController({ onError }))
    await waitFor(() => expect(mocks.fetchAdminShops).toHaveBeenCalled())

    act(() => {
      result.current.actions.startCreate()
      result.current.actions.updateForm('name', '新店舗')
    })

    await act(async () => {
      await result.current.actions.saveContent()
    })

    expect(onError).toHaveBeenCalledWith('スラッグを入力してください')
  })

  it('notifies error when save fails', async () => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockResolvedValue([baseShop])
    mocks.fetchAdminShopDetail.mockResolvedValue(baseDetail)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })
    mocks.updateAdminShopContent.mockRejectedValue(new Error('Save failed'))
    const onError = vi.fn()

    const { result } = renderHook(() => useAdminShopsController({ onError }))
    await waitFor(() => expect(result.current.state.selectedId).toBe('shop-1'))

    await act(async () => {
      await result.current.actions.saveContent()
    })

    expect(onError).toHaveBeenCalledWith('保存に失敗しました')
  })
})

describe('useAdminShopsController selectShop and startCreate', () => {
  beforeEach(() => {
    Object.values(getMocks()).forEach((mockFn) => mockFn.mockReset())
  })

  it('selectShop changes selected shop and clears creating mode', async () => {
    const mocks = getMocks()
    const shop2 = { ...baseShop, id: 'shop-2', name: '店舗2' }
    mocks.fetchAdminShops.mockResolvedValue([baseShop, shop2])
    mocks.fetchAdminShopDetail.mockResolvedValue(baseDetail)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })

    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(result.current.state.selectedId).toBe('shop-1'))

    act(() => {
      result.current.actions.startCreate()
    })
    expect(result.current.state.isCreating).toBe(true)
    expect(result.current.state.selectedId).toBe(null)

    act(() => {
      result.current.actions.selectShop('shop-2')
    })
    expect(result.current.state.isCreating).toBe(false)
    expect(result.current.state.selectedId).toBe('shop-2')
  })

  it('startCreate resets form and clears selection', async () => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockResolvedValue([baseShop])
    mocks.fetchAdminShopDetail.mockResolvedValue(baseDetail)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })

    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(result.current.state.form.name).toBe('テスト店舗'))

    act(() => {
      result.current.actions.startCreate()
    })

    expect(result.current.state.isCreating).toBe(true)
    expect(result.current.state.selectedId).toBe(null)
    expect(result.current.state.form.name).toBe('')
    expect(result.current.state.form.slug).toBe('')
    expect(result.current.state.availability).toHaveLength(0)
  })
})

describe('useAdminShopsController refreshAvailability', () => {
  beforeEach(() => {
    Object.values(getMocks()).forEach((mockFn) => mockFn.mockReset())
  })

  it('refreshes availability from API', async () => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockResolvedValue([baseShop])
    mocks.fetchAdminShopDetail.mockResolvedValue(baseDetail)
    mocks.fetchShopAvailability.mockResolvedValue({
      days: [{ date: '2024-02-01', slots: [{ start_at: '2024-02-01T10:00', end_at: '2024-02-01T11:00', status: 'open' }] }],
    })

    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(result.current.state.selectedId).toBe('shop-1'))

    expect(result.current.state.availability).toHaveLength(1)

    mocks.fetchShopAvailability.mockResolvedValue({
      days: [
        { date: '2024-02-01', slots: [] },
        { date: '2024-02-02', slots: [{ start_at: '2024-02-02T09:00', end_at: '2024-02-02T10:00', status: 'open' }] },
      ],
    })

    await act(async () => {
      await result.current.actions.refreshAvailability()
    })

    expect(result.current.state.availability).toHaveLength(2)
  })

  it('notifies error when refresh fails', async () => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockResolvedValue([baseShop])
    mocks.fetchAdminShopDetail.mockResolvedValue(baseDetail)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })
    const onError = vi.fn()

    const { result } = renderHook(() => useAdminShopsController({ onError }))
    await waitFor(() => expect(result.current.state.selectedId).toBe('shop-1'))

    mocks.fetchShopAvailability.mockRejectedValue(new Error('Fetch failed'))

    await act(async () => {
      await result.current.actions.refreshAvailability()
    })

    expect(onError).toHaveBeenCalledWith('空き枠の取得に失敗しました')
  })

  it('does nothing when no shop is selected', async () => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockResolvedValue([])
    mocks.fetchAdminShopDetail.mockResolvedValue(null)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })

    const { result } = renderHook(() => useAdminShopsController())
    await waitFor(() => expect(mocks.fetchAdminShops).toHaveBeenCalled())

    mocks.fetchShopAvailability.mockClear()

    await act(async () => {
      await result.current.actions.refreshAvailability()
    })

    expect(mocks.fetchShopAvailability).not.toHaveBeenCalled()
  })
})

describe('useAdminShopsController saveAvailability error', () => {
  beforeEach(() => {
    Object.values(getMocks()).forEach((mockFn) => mockFn.mockReset())
  })

  it('returns false and notifies error when save fails', async () => {
    const mocks = getMocks()
    mocks.fetchAdminShops.mockResolvedValue([baseShop])
    mocks.fetchAdminShopDetail.mockResolvedValue(baseDetail)
    mocks.fetchShopAvailability.mockResolvedValue({ days: [] })
    mocks.upsertShopAvailability.mockRejectedValue(new Error('Save failed'))
    const onError = vi.fn()

    const { result } = renderHook(() => useAdminShopsController({ onError }))
    await waitFor(() => expect(result.current.state.selectedId).toBe('shop-1'))

    let saved: boolean = true
    await act(async () => {
      saved = await result.current.actions.saveAvailability('2024-02-01', [
        { start_at: '2024-02-01T09:00', end_at: '2024-02-01T10:00', status: 'open' },
      ])
    })

    expect(saved).toBe(false)
    expect(onError).toHaveBeenCalledWith('空き枠の保存に失敗しました')
  })
})
