import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ReservationForm from '@/components/ReservationForm'

const { createReservationActionMock, enqueueAsyncJobMock } = vi.hoisted(() => ({
  createReservationActionMock: vi.fn(),
  enqueueAsyncJobMock: vi.fn(),
}))

vi.mock('@/app/actions/reservations', () => ({
  createReservationAction: (...args: unknown[]) => createReservationActionMock(...args),
}))

vi.mock('@/lib/async-jobs', () => ({
  enqueueAsyncJob: enqueueAsyncJobMock,
}))

const uuidShopId = '11111111-2222-3333-4444-555555555555'

describe('ReservationForm payload', () => {
  beforeEach(() => {
    createReservationActionMock.mockResolvedValue({
      success: true,
      reservation: {
        id: 'reservation-1',
        status: 'pending',
        shop_id: uuidShopId,
        customer: {
          name: '山田 太郎',
          phone: '090-1111-2222',
          email: 'guest@example.com',
        },
      },
      asyncJob: { status: 'queued' },
    })
    enqueueAsyncJobMock.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sends preferred slot list and course details when submitting', async () => {
    const slotAStart = '2025-11-04T13:00:00+09:00'
    const slotAEnd = '2025-11-04T14:30:00+09:00'
    const slotBStart = '2025-11-05T10:00:00+09:00'
    const slotBEnd = '2025-11-05T11:30:00+09:00'

    render(
      <ReservationForm
        shopId={uuidShopId}
        staffId="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        selectedSlots={[
          { startAt: slotAStart, endAt: slotAEnd, date: '2025-11-04', status: 'open' },
          { startAt: slotBStart, endAt: slotBEnd, date: '2025-11-05', status: 'tentative' },
        ]}
        courseOptions={[
          { id: 'course-60', label: '60分コース', durationMinutes: 60, priceLabel: '¥8,000' },
          { id: 'course-90', label: '90分コース', durationMinutes: 90, priceLabel: '¥12,000' },
        ]}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('例: 山田 太郎'), { target: { value: '山田 太郎' } })
    fireEvent.change(screen.getByPlaceholderText('090-1234-5678'), { target: { value: '090-1111-2222' } })
    fireEvent.change(screen.getByPlaceholderText('example@mail.com'), { target: { value: 'guest@example.com' } })

    const submitButton = screen.getByRole('button', { name: '予約リクエストを送信' })
    fireEvent.click(submitButton)

    await waitFor(() => expect(createReservationActionMock).toHaveBeenCalledTimes(1))

    const [payload] = createReservationActionMock.mock.calls[0]!

    expect(payload.shop_id).toBe(uuidShopId)
    expect(payload.customer).toMatchObject({
      name: '山田 太郎',
      phone: '090-1111-2222',
      email: 'guest@example.com',
    })
    expect(payload.preferred_slots).toHaveLength(2)
    expect(payload.preferred_slots[0]).toMatchObject({
      desired_start: new Date(slotAStart).toISOString(),
      desired_end: new Date(slotAEnd).toISOString(),
      status: 'open',
    })
    expect(payload.preferred_slots[1]).toMatchObject({
      desired_start: new Date(slotBStart).toISOString(),
      desired_end: new Date(slotBEnd).toISOString(),
      status: 'tentative',
    })
    expect(payload.notes).toContain('第1候補')
    expect(payload.notes).toContain('第2候補')
  })
})
