import { render, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import RecentlyViewedRecorder, {
  RECENTLY_VIEWED_STORAGE_KEY,
  RECENTLY_VIEWED_UPDATE_EVENT,
} from '../RecentlyViewedRecorder'

describe('RecentlyViewedRecorder', () => {
  const mockLocalStorage: Record<string, string> = {}

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key]
      }),
      clear: vi.fn(() => {
        for (const key in mockLocalStorage) {
          delete mockLocalStorage[key]
        }
      }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    for (const key in mockLocalStorage) {
      delete mockLocalStorage[key]
    }
  })

  it('renders nothing', () => {
    const { container } = render(
      <RecentlyViewedRecorder shopId="shop-1" name="テストショップ" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('records shop to localStorage', async () => {
    render(<RecentlyViewedRecorder shopId="shop-1" name="テストショップ" />)

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalled()
    })

    const stored = JSON.parse(mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY])
    expect(stored).toHaveLength(1)
    expect(stored[0].shopId).toBe('shop-1')
    expect(stored[0].name).toBe('テストショップ')
  })

  it('includes optional fields', async () => {
    render(
      <RecentlyViewedRecorder
        shopId="shop-2"
        name="ショップ2"
        slug="shop-2-slug"
        area="難波"
        imageUrl="https://example.com/image.jpg"
      />,
    )

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalled()
    })

    const stored = JSON.parse(mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY])
    expect(stored[0].slug).toBe('shop-2-slug')
    expect(stored[0].area).toBe('難波')
    expect(stored[0].imageUrl).toBe('https://example.com/image.jpg')
  })

  it('trims whitespace from name, slug and area', async () => {
    render(
      <RecentlyViewedRecorder
        shopId="shop-3"
        name="  ショップ3  "
        slug="  slug-3  "
        area="  梅田  "
      />,
    )

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalled()
    })

    const stored = JSON.parse(mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY])
    expect(stored[0].name).toBe('ショップ3')
    expect(stored[0].slug).toBe('slug-3')
    expect(stored[0].area).toBe('梅田')
  })

  it('adds viewedAt timestamp', async () => {
    const before = new Date().toISOString()
    render(<RecentlyViewedRecorder shopId="shop-4" name="ショップ4" />)

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalled()
    })

    const stored = JSON.parse(mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY])
    const after = new Date().toISOString()
    expect(stored[0].viewedAt).toBeDefined()
    expect(stored[0].viewedAt >= before).toBe(true)
    expect(stored[0].viewedAt <= after).toBe(true)
  })

  it('removes duplicate by shopId', async () => {
    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = JSON.stringify([
      { shopId: 'shop-dup', name: 'Old Name', viewedAt: '2024-01-01T00:00:00Z' },
    ])

    render(<RecentlyViewedRecorder shopId="shop-dup" name="New Name" />)

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalled()
    })

    const stored = JSON.parse(mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY])
    expect(stored).toHaveLength(1)
    expect(stored[0].name).toBe('New Name')
  })

  it('removes duplicate by slug', async () => {
    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = JSON.stringify([
      { shopId: 'old-id', slug: 'same-slug', name: 'Old Name', viewedAt: '2024-01-01T00:00:00Z' },
    ])

    render(
      <RecentlyViewedRecorder shopId="new-id" slug="same-slug" name="New Name" />,
    )

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalled()
    })

    const stored = JSON.parse(mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY])
    expect(stored).toHaveLength(1)
    expect(stored[0].shopId).toBe('new-id')
  })

  it('limits entries to 12', async () => {
    const existingEntries = Array.from({ length: 15 }, (_, i) => ({
      shopId: `shop-${i}`,
      name: `Shop ${i}`,
      viewedAt: '2024-01-01T00:00:00Z',
    }))
    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = JSON.stringify(existingEntries)

    render(<RecentlyViewedRecorder shopId="new-shop" name="New Shop" />)

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalled()
    })

    const stored = JSON.parse(mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY])
    expect(stored).toHaveLength(12)
    expect(stored[0].shopId).toBe('new-shop')
  })

  it('dispatches custom event on update', async () => {
    const eventHandler = vi.fn()
    window.addEventListener(RECENTLY_VIEWED_UPDATE_EVENT, eventHandler)

    render(<RecentlyViewedRecorder shopId="shop-event" name="Event Shop" />)

    await waitFor(() => {
      expect(eventHandler).toHaveBeenCalled()
    })

    window.removeEventListener(RECENTLY_VIEWED_UPDATE_EVENT, eventHandler)
  })

  it('handles empty localStorage gracefully', async () => {
    render(<RecentlyViewedRecorder shopId="shop-empty" name="Empty Test" />)

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalled()
    })

    const stored = JSON.parse(mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY])
    expect(stored).toHaveLength(1)
  })

  it('handles malformed localStorage JSON', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = 'not valid json'

    render(<RecentlyViewedRecorder shopId="shop-malformed" name="Malformed Test" />)

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalled()
    })

    const stored = JSON.parse(mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY])
    expect(stored).toHaveLength(1)
    expect(stored[0].shopId).toBe('shop-malformed')

    warnSpy.mockRestore()
  })

  it('handles non-array localStorage value', async () => {
    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = JSON.stringify({ notAnArray: true })

    render(<RecentlyViewedRecorder shopId="shop-nonarray" name="Non-Array Test" />)

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalled()
    })

    const stored = JSON.parse(mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY])
    expect(stored).toHaveLength(1)
    expect(stored[0].shopId).toBe('shop-nonarray')
  })

  it('filters invalid entries from storage', async () => {
    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = JSON.stringify([
      { shopId: 'valid-1', name: 'Valid', viewedAt: '2024-01-01T00:00:00Z' },
      { name: 'No ShopId', viewedAt: '2024-01-01T00:00:00Z' },
      null,
      { shopId: 123, name: 'Number ID', viewedAt: '2024-01-01T00:00:00Z' },
    ])

    render(<RecentlyViewedRecorder shopId="shop-filter" name="Filter Test" />)

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalled()
    })

    const stored = JSON.parse(mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY])
    // New entry + 1 valid existing entry
    expect(stored).toHaveLength(2)
    expect(stored[0].shopId).toBe('shop-filter')
    expect(stored[1].shopId).toBe('valid-1')
  })

  it('does not record if shopId is empty', () => {
    render(<RecentlyViewedRecorder shopId="" name="Empty ID" />)

    // Should not call setItem
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })
})
