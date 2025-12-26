'use client'

import React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

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

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <span data-next-image="true" {...props} />,
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
