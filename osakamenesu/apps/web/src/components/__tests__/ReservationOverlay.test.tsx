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

    const detailOverlay = await screen.findByRole('dialog', { name: /りなの予約詳細/ })
    fireEvent.click(within(detailOverlay).getByRole('button', { name: '空き状況・予約' }))

    const scheduleButtons = await within(detailOverlay).findAllByRole('button', { name: /11\/4.*13:00/ })
    fireEvent.click(scheduleButtons[0])

    const candidateBadges = await within(detailOverlay).findAllByText(/第\d候補/)
    expect(candidateBadges.length).toBeGreaterThan(1)
  })
})
