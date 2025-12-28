'use client'

import React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import TherapistCard, { type TherapistHit } from '../TherapistCard'

const toggleFavoriteMock = vi.fn()
const isFavoriteMock = vi.fn()
const isProcessingMock = vi.fn()

vi.mock('@/features/favorites', () => ({
  useTherapistFavorites: () => ({
    favorites: new Map<string, unknown>(),
    isAuthenticated: true,
    loading: false,
    isFavorite: isFavoriteMock,
    isProcessing: isProcessingMock,
    toggleFavorite: toggleFavoriteMock,
  }),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/SafeImage', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: any) => <img data-testid="safe-image" src={props.src} alt={props.alt} />,
}))

const openReservationOverlayMock = vi.fn()
vi.mock('@/components/reservationOverlayBus', () => ({
  openReservationOverlay: (...args: unknown[]) => openReservationOverlayMock(...args),
}))

const BASE_HIT: TherapistHit = {
  id: 'test-id',
  therapistId: 'therapist-uuid',
  staffId: 'staff-identifier',
  name: 'テストセラピスト',
  alias: null,
  headline: null,
  specialties: [],
  avatarUrl: null,
  rating: null,
  reviewCount: null,
  shopId: 'shop-uuid',
  shopSlug: null,
  shopName: 'テスト店舗',
  shopArea: '大阪',
  shopAreaName: null,
  todayAvailable: true,
  nextAvailableSlot: {
    start_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    status: 'ok',
  },
}

describe('TherapistCard favorite button', () => {
  beforeEach(() => {
    toggleFavoriteMock.mockClear()
    isFavoriteMock.mockReset()
    isProcessingMock.mockReset()
    isFavoriteMock.mockReturnValue(false)
    isProcessingMock.mockReturnValue(false)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calls toggleFavorite when therapistId is available', () => {
    const { getByRole } = render(<TherapistCard hit={BASE_HIT} />)
    const button = getByRole('button', { name: 'お気に入りに追加' })
    expect(button).not.toHaveAttribute('disabled')

    fireEvent.click(button)
    expect(toggleFavoriteMock).toHaveBeenCalledTimes(1)
    expect(toggleFavoriteMock).toHaveBeenCalledWith({
      therapistId: 'therapist-uuid',
      shopId: 'shop-uuid',
    })
  })

  it('disables the button when therapistId is missing', () => {
    const hitWithoutTherapist: TherapistHit = { ...BASE_HIT, therapistId: null }
    const { getByRole } = render(<TherapistCard hit={hitWithoutTherapist} />)
    const button = getByRole('button', { name: 'お気に入りに追加' })
    expect(button).toHaveAttribute('disabled')

    fireEvent.click(button)
    expect(toggleFavoriteMock).not.toHaveBeenCalled()
  })

  it('exposes aria-pressed state explicitly', () => {
    const { getByRole, rerender } = render(<TherapistCard hit={BASE_HIT} />)
    const button = getByRole('button', { name: 'お気に入りに追加' })
    expect(button).toHaveAttribute('aria-pressed', 'false')

    isFavoriteMock.mockReturnValueOnce(true)
    rerender(<TherapistCard hit={BASE_HIT} />)
    expect(getByRole('button', { name: 'お気に入りから削除' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('TherapistCard rendering', () => {
  beforeEach(() => {
    isFavoriteMock.mockReturnValue(false)
    isProcessingMock.mockReturnValue(false)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders therapist name', () => {
    render(<TherapistCard hit={BASE_HIT} />)
    expect(screen.getByText('テストセラピスト')).toBeInTheDocument()
  })

  it('renders therapist avatar when provided', () => {
    const hitWithAvatar = { ...BASE_HIT, avatarUrl: 'https://example.com/avatar.jpg' }
    render(<TherapistCard hit={hitWithAvatar} />)
    expect(screen.getByTestId('safe-image')).toBeInTheDocument()
  })

  it('renders placeholder when no avatar', () => {
    render(<TherapistCard hit={BASE_HIT} />)
    // Placeholder shows first character of name
    expect(screen.getByText('テ')).toBeInTheDocument()
  })

  it('renders headline when provided', () => {
    const hitWithHeadline = { ...BASE_HIT, headline: 'テスト紹介文' }
    render(<TherapistCard hit={hitWithHeadline} />)
    expect(screen.getByText('テスト紹介文')).toBeInTheDocument()
  })

  it('renders shop area name when provided', () => {
    const hitWithArea = { ...BASE_HIT, shopAreaName: '梅田エリア' }
    render(<TherapistCard hit={hitWithArea} />)
    expect(screen.getByText('梅田エリア')).toBeInTheDocument()
  })

  it('renders specialties when provided', () => {
    const hitWithSpecialties = { ...BASE_HIT, specialties: ['アロマ', 'ボディ', 'オイル'] }
    render(<TherapistCard hit={hitWithSpecialties} />)
    expect(screen.getByText('アロマ')).toBeInTheDocument()
    expect(screen.getByText('ボディ')).toBeInTheDocument()
    expect(screen.getByText('オイル')).toBeInTheDocument()
  })

  it('limits specialties to 3 items', () => {
    const hitWithManySpecialties = {
      ...BASE_HIT,
      specialties: ['アロマ', 'ボディ', 'オイル', 'ストレッチ', 'リンパ'],
    }
    render(<TherapistCard hit={hitWithManySpecialties} />)
    expect(screen.getByText('アロマ')).toBeInTheDocument()
    expect(screen.queryByText('ストレッチ')).not.toBeInTheDocument()
  })

  it('renders rating when provided', () => {
    const hitWithRating = { ...BASE_HIT, rating: 4.5, reviewCount: 10 }
    render(<TherapistCard hit={hitWithRating} />)
    expect(screen.getByText('4.5')).toBeInTheDocument()
    expect(screen.getByText('(10)')).toBeInTheDocument()
  })

  it('renders availability badge for today', () => {
    const hitToday = {
      ...BASE_HIT,
      todayAvailable: true,
      nextAvailableSlot: {
        start_at: new Date().toISOString(),
        status: 'ok' as const,
      },
    }
    render(<TherapistCard hit={hitToday} />)
    expect(screen.getByTestId('therapist-availability-badge')).toBeInTheDocument()
  })

  it('shows "本日空きあり" when todayAvailable but no slot', () => {
    const hitTodayNoSlot = { ...BASE_HIT, todayAvailable: true, nextAvailableSlot: null }
    render(<TherapistCard hit={hitTodayNoSlot} />)
    expect(screen.getByText('本日空きあり')).toBeInTheDocument()
  })

  it('shows "詳細を見る" link when not clickable', () => {
    render(<TherapistCard hit={BASE_HIT} />)
    expect(screen.getByText('詳細を見る')).toBeInTheDocument()
  })

  it('shows "予約する" button when useOverlay is true', () => {
    render(<TherapistCard hit={BASE_HIT} useOverlay={true} />)
    expect(screen.getByText('予約する')).toBeInTheDocument()
  })

  it('builds correct staff href with shopSlug', () => {
    const hitWithSlug = { ...BASE_HIT, shopSlug: 'test-shop' }
    render(<TherapistCard hit={hitWithSlug} />)
    const link = screen.getByRole('link', { name: 'テストセラピスト' })
    expect(link).toHaveAttribute('href', '/profiles/test-shop/staff/staff-identifier')
  })

  it('builds correct staff href without shopSlug', () => {
    render(<TherapistCard hit={BASE_HIT} />)
    const link = screen.getByRole('link', { name: 'テストセラピスト' })
    expect(link).toHaveAttribute('href', '/profiles/shop-uuid/staff/staff-identifier')
  })
})

describe('TherapistCard interactions', () => {
  beforeEach(() => {
    isFavoriteMock.mockReturnValue(false)
    isProcessingMock.mockReturnValue(false)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calls onReserve when card is clicked', async () => {
    const onReserve = vi.fn()
    render(<TherapistCard hit={BASE_HIT} onReserve={onReserve} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('therapist-card'))
    })
    expect(onReserve).toHaveBeenCalledWith(BASE_HIT)
  })

  it('handles keyboard navigation with Enter', async () => {
    const onReserve = vi.fn()
    render(<TherapistCard hit={BASE_HIT} onReserve={onReserve} />)
    await act(async () => {
      fireEvent.keyDown(screen.getByTestId('therapist-card'), { key: 'Enter' })
    })
    expect(onReserve).toHaveBeenCalled()
  })

  it('handles keyboard navigation with Space', async () => {
    const onReserve = vi.fn()
    render(<TherapistCard hit={BASE_HIT} onReserve={onReserve} />)
    await act(async () => {
      fireEvent.keyDown(screen.getByTestId('therapist-card'), { key: ' ' })
    })
    expect(onReserve).toHaveBeenCalled()
  })

  it('has role button when clickable', () => {
    render(<TherapistCard hit={BASE_HIT} useOverlay={true} />)
    expect(screen.getByTestId('therapist-card')).toHaveAttribute('role', 'button')
  })

  it('does not have role button when not clickable', () => {
    render(<TherapistCard hit={BASE_HIT} />)
    expect(screen.getByTestId('therapist-card')).not.toHaveAttribute('role')
  })
})

describe('TherapistCard overlay reservation', () => {
  beforeEach(() => {
    isFavoriteMock.mockReturnValue(false)
    isProcessingMock.mockReturnValue(false)
    openReservationOverlayMock.mockClear()
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ days: [] }),
    } as Response)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('opens overlay when useOverlay is true and card is clicked', async () => {
    const hitWithSlots = {
      ...BASE_HIT,
      availabilitySlots: [{ start_at: '2024-12-01T10:00:00+09:00', end_at: '2024-12-01T11:00:00+09:00' }],
    }
    render(<TherapistCard hit={hitWithSlots} useOverlay={true} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('therapist-card'))
    })

    expect(openReservationOverlayMock).toHaveBeenCalledTimes(1)
    expect(openReservationOverlayMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hit: hitWithSlots,
      }),
    )
  })

  it('fetches availability from API when availabilitySlots is not provided', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        days: [{ date: '2024-12-01', slots: [{ start_at: '2024-12-01T10:00:00+09:00', end_at: '2024-12-01T11:00:00+09:00', status: 'open' }] }],
      }),
    } as Response)

    render(<TherapistCard hit={BASE_HIT} useOverlay={true} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('therapist-card'))
    })

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/guest/therapists/therapist-uuid/availability_slots')
    })
    expect(openReservationOverlayMock).toHaveBeenCalled()
  })

  it('shows loading state while fetching availability', async () => {
    let resolvePromise: (value: Response) => void
    const fetchPromise = new Promise<Response>((resolve) => {
      resolvePromise = resolve
    })
    vi.spyOn(global, 'fetch').mockReturnValue(fetchPromise)

    render(<TherapistCard hit={BASE_HIT} useOverlay={true} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('therapist-card'))
    })

    expect(screen.getByText('読み込み中...')).toBeInTheDocument()

    await act(async () => {
      resolvePromise!({
        ok: true,
        json: async () => ({ days: [] }),
      } as Response)
    })

    await waitFor(() => {
      expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument()
    })
  })

  it('handles API error gracefully', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))

    render(<TherapistCard hit={BASE_HIT} useOverlay={true} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('therapist-card'))
    })

    await waitFor(() => {
      expect(openReservationOverlayMock).toHaveBeenCalled()
    })
  })

  it('handles non-ok API response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response)

    render(<TherapistCard hit={BASE_HIT} useOverlay={true} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('therapist-card'))
    })

    await waitFor(() => {
      expect(openReservationOverlayMock).toHaveBeenCalled()
    })
  })

  it('uses staffId when therapistId is not available', async () => {
    const hitWithoutTherapistId = { ...BASE_HIT, therapistId: null }
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ days: [] }),
    } as Response)

    render(<TherapistCard hit={hitWithoutTherapistId} useOverlay={true} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('therapist-card'))
    })

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/guest/therapists/staff-identifier/availability_slots')
    })
  })

  it('opens overlay without fetch when no targetId available', async () => {
    const hitWithoutIds = { ...BASE_HIT, therapistId: null, staffId: '', name: '' }
    const fetchSpy = vi.spyOn(global, 'fetch')

    render(<TherapistCard hit={hitWithoutIds} useOverlay={true} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('therapist-card'))
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(openReservationOverlayMock).toHaveBeenCalled()
  })

  it('passes menus to overlay when provided', async () => {
    const hitWithSlots = {
      ...BASE_HIT,
      availabilitySlots: [{ start_at: '2024-12-01T10:00:00+09:00', end_at: '2024-12-01T11:00:00+09:00' }],
    }
    const menus = [{ id: 'menu-1', name: 'コース A', price: 5000 }]

    render(<TherapistCard hit={hitWithSlots} useOverlay={true} menus={menus} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('therapist-card'))
    })

    expect(openReservationOverlayMock).toHaveBeenCalledWith(
      expect.objectContaining({
        menus,
      }),
    )
  })

  it('does not click while loading', async () => {
    let resolvePromise: (value: Response) => void
    const fetchPromise = new Promise<Response>((resolve) => {
      resolvePromise = resolve
    })
    vi.spyOn(global, 'fetch').mockReturnValue(fetchPromise)

    render(<TherapistCard hit={BASE_HIT} useOverlay={true} />)

    // First click starts loading
    await act(async () => {
      fireEvent.click(screen.getByTestId('therapist-card'))
    })

    // Second click while loading should be ignored
    await act(async () => {
      fireEvent.click(screen.getByTestId('therapist-card'))
    })

    // Only one fetch should have been called
    expect(global.fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolvePromise!({
        ok: true,
        json: async () => ({ days: [] }),
      } as Response)
    })
  })
})

describe('TherapistCard availability label', () => {
  beforeEach(() => {
    isFavoriteMock.mockReturnValue(false)
    isProcessingMock.mockReturnValue(false)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows no badge when no availability', () => {
    const hitNoAvailability = { ...BASE_HIT, todayAvailable: false, nextAvailableSlot: null }
    render(<TherapistCard hit={hitNoAvailability} />)
    expect(screen.queryByTestId('therapist-availability-badge')).not.toBeInTheDocument()
  })

  it('shows tentative status differently', () => {
    const hitTentative = {
      ...BASE_HIT,
      todayAvailable: false,
      nextAvailableSlot: {
        start_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'maybe' as const,
      },
    }
    render(<TherapistCard hit={hitTentative} />)
    expect(screen.getByTestId('therapist-availability-badge')).toBeInTheDocument()
  })

  it('shows badge with today availability from slot', () => {
    // Use nextAvailableSlot which is a more reliable way to show badge
    const hitWithTodaySlot = {
      ...BASE_HIT,
      todayAvailable: true,
      nextAvailableSlot: {
        start_at: new Date().toISOString(),
        status: 'ok' as const,
      },
    }
    render(<TherapistCard hit={hitWithTodaySlot} useOverlay={true} />)
    expect(screen.getByTestId('therapist-availability-badge')).toBeInTheDocument()
  })
})
