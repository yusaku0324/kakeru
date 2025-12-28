import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import RecentlyViewedList from '../RecentlyViewedList'
import {
  RECENTLY_VIEWED_STORAGE_KEY,
  RECENTLY_VIEWED_UPDATE_EVENT,
} from '../RecentlyViewedRecorder'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/SafeImage', () => ({
  default: ({ alt, ...props }: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}))

const sampleEntry = {
  shopId: 'shop-1',
  slug: 'shop-1-slug',
  name: 'テストショップ',
  area: '難波',
  imageUrl: 'https://example.com/image.jpg',
  viewedAt: '2024-01-15T10:30:00Z',
}

describe('RecentlyViewedList', () => {
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

  it('renders section with heading', () => {
    render(<RecentlyViewedList />)
    expect(
      screen.getByRole('heading', { name: '最近見た店舗' }),
    ).toBeInTheDocument()
  })

  it('shows empty message when no entries', () => {
    render(<RecentlyViewedList />)
    expect(
      screen.getByText(/最近閲覧した店舗がここに表示されます/),
    ).toBeInTheDocument()
  })

  it('renders shop entries from localStorage', async () => {
    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = JSON.stringify([sampleEntry])

    render(<RecentlyViewedList />)

    await waitFor(() => {
      expect(screen.getByText('テストショップ')).toBeInTheDocument()
    })
    expect(screen.getByText('難波')).toBeInTheDocument()
  })

  it('links to shop using slug when available', async () => {
    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = JSON.stringify([sampleEntry])

    render(<RecentlyViewedList />)

    await waitFor(() => {
      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        '/profiles/shop-1-slug',
      )
    })
  })

  it('links to shop using shopId when no slug', async () => {
    const entryWithoutSlug = { ...sampleEntry, slug: null }
    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = JSON.stringify([entryWithoutSlug])

    render(<RecentlyViewedList />)

    await waitFor(() => {
      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        '/profiles/shop-1',
      )
    })
  })

  it('shows image when imageUrl is available', async () => {
    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = JSON.stringify([sampleEntry])

    render(<RecentlyViewedList />)

    await waitFor(() => {
      expect(screen.getByAltText('テストショップの写真')).toBeInTheDocument()
    })
  })

  it('shows initial letter when no image', async () => {
    const entryWithoutImage = { ...sampleEntry, imageUrl: null }
    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = JSON.stringify([entryWithoutImage])

    render(<RecentlyViewedList />)

    await waitFor(() => {
      expect(screen.getByText('テ')).toBeInTheDocument()
    })
  })

  it('limits display to 8 entries', async () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({
      ...sampleEntry,
      shopId: `shop-${i}`,
      name: `ショップ${i}`,
      viewedAt: new Date(2024, 0, 15, 10 + i).toISOString(),
    }))
    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = JSON.stringify(entries)

    render(<RecentlyViewedList />)

    await waitFor(() => {
      expect(screen.getAllByRole('link')).toHaveLength(8)
    })
  })

  it('clears entries when button is clicked', async () => {
    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = JSON.stringify([sampleEntry])

    render(<RecentlyViewedList />)

    await waitFor(() => {
      expect(screen.getByText('テストショップ')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '履歴をクリア' }))

    await waitFor(() => {
      expect(
        screen.getByText(/最近閲覧した店舗がここに表示されます/),
      ).toBeInTheDocument()
    })
    expect(localStorage.removeItem).toHaveBeenCalledWith(
      RECENTLY_VIEWED_STORAGE_KEY,
    )
  })

  it('disables clear button when no entries', () => {
    render(<RecentlyViewedList />)
    expect(screen.getByRole('button', { name: '履歴をクリア' })).toBeDisabled()
  })

  it('enables clear button when entries exist', async () => {
    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = JSON.stringify([sampleEntry])

    render(<RecentlyViewedList />)

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '履歴をクリア' }),
      ).not.toBeDisabled()
    })
  })

  it('refreshes on custom update event', async () => {
    render(<RecentlyViewedList />)

    expect(
      screen.getByText(/最近閲覧した店舗がここに表示されます/),
    ).toBeInTheDocument()

    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = JSON.stringify([sampleEntry])

    await act(async () => {
      window.dispatchEvent(new CustomEvent(RECENTLY_VIEWED_UPDATE_EVENT))
    })

    await waitFor(() => {
      expect(screen.getByText('テストショップ')).toBeInTheDocument()
    })
  })

  it('refreshes on storage event', async () => {
    render(<RecentlyViewedList />)

    expect(
      screen.getByText(/最近閲覧した店舗がここに表示されます/),
    ).toBeInTheDocument()

    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = JSON.stringify([sampleEntry])

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: RECENTLY_VIEWED_STORAGE_KEY }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText('テストショップ')).toBeInTheDocument()
    })
  })

  it('ignores storage events for other keys', async () => {
    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = JSON.stringify([sampleEntry])

    render(<RecentlyViewedList />)

    await waitFor(() => {
      expect(screen.getByText('テストショップ')).toBeInTheDocument()
    })

    // Modify storage (simulating another component clearing it)
    delete mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY]

    // Fire storage event for different key
    window.dispatchEvent(new StorageEvent('storage', { key: 'other_key' }))

    // Should still show the entry (no refresh)
    expect(screen.getByText('テストショップ')).toBeInTheDocument()
  })

  it('handles malformed localStorage gracefully', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = 'not valid json'

    render(<RecentlyViewedList />)

    expect(
      screen.getByText(/最近閲覧した店舗がここに表示されます/),
    ).toBeInTheDocument()

    warnSpy.mockRestore()
  })

  it('handles entries without area', async () => {
    const entryWithoutArea = { ...sampleEntry, area: null }
    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = JSON.stringify([entryWithoutArea])

    render(<RecentlyViewedList />)

    await waitFor(() => {
      expect(screen.getByText('テストショップ')).toBeInTheDocument()
    })
    expect(screen.queryByText('難波')).not.toBeInTheDocument()
  })

  it('handles invalid viewedAt date', async () => {
    const entryWithInvalidDate = { ...sampleEntry, viewedAt: 'not a date' }
    mockLocalStorage[RECENTLY_VIEWED_STORAGE_KEY] = JSON.stringify([entryWithInvalidDate])

    render(<RecentlyViewedList />)

    await waitFor(() => {
      expect(screen.getByText('テストショップ')).toBeInTheDocument()
    })
    // Should not crash, just not show the date
    expect(screen.queryByText(/最終閲覧:/)).not.toBeInTheDocument()
  })

  it('applies className prop', () => {
    const { container } = render(<RecentlyViewedList className="custom-class" />)
    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })
})
