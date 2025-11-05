import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ReservationOverlay from '@/components/ReservationOverlay'
import type { ReservationOverlayProps } from '@/components/ReservationOverlay'

const baseHit = {
  id: 'shop-staff',
  therapistId: 'staff-1',
  staffId: 'staff-1',
  name: 'りな',
  alias: null,
  headline: '癒やしのアロマで人気のセラピスト',
  specialties: ['アロマ', 'ストレッチ', 'リンパ'],
  avatarUrl: null,
  rating: 4.8,
  reviewCount: 142,
  shopId: 'shop-1',
  shopSlug: 'shop-1',
  shopName: 'アロマリラクゼーション 梅田店',
  shopArea: '大阪',
  shopAreaName: '梅田・北新地',
  todayAvailable: true,
  nextAvailableAt: '2025-11-04T12:00:00+09:00',
} as const

const availabilityDays = [
  {
    date: '2025-11-04',
    is_today: true,
    slots: [
      { start_at: '2025-11-04T12:00:00+09:00', end_at: '2025-11-04T12:30:00+09:00', status: 'open' as const },
      { start_at: '2025-11-04T13:00:00+09:00', end_at: '2025-11-04T13:30:00+09:00', status: 'tentative' as const },
    ],
  },
  {
    date: '2025-11-05',
    is_today: false,
    slots: [
      { start_at: '2025-11-05T10:00:00+09:00', end_at: '2025-11-05T10:30:00+09:00', status: 'open' as const },
    ],
  },
] satisfies NonNullable<ReservationOverlayProps['availabilityDays']>

describe('ReservationOverlay schedule selection', () => {
  it('allows selecting additional schedule slots in schedule tab', async () => {
    const handleClose = vi.fn()
    render(
      <ReservationOverlay
        hit={baseHit}
        onClose={handleClose}
        tel="066-100-1234"
        lineId="namba-resort"
        availabilityDays={availabilityDays}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /予約フォームを開く/ }))

    // schedule tab should be active by default when availability exists
    const formOverlay = await screen.findByRole('dialog', { name: /りな.+予約フォーム/ })
    const targetSlotButtons = within(formOverlay).getAllByRole('button', { name: /11\/4.*13:00/ })
    fireEvent.click(targetSlotButtons[0])

    const candidateBadges = await within(formOverlay).findAllByText(/第\d候補/)
    expect(candidateBadges.length).toBeGreaterThan(1)
  })
})
