import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ReservationForm from '@/components/ReservationForm'

const uuidShopId = '11111111-2222-3333-4444-555555555555'
const fetchMock = vi.fn()

describe('ReservationForm payload', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: 'reservation-1' }),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
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

    fireEvent.change(screen.getByPlaceholderText('例: 山田 太郎'), {
      target: { value: '山田 太郎' },
    })
    fireEvent.change(screen.getByPlaceholderText('090-1234-5678'), {
      target: { value: '090-1111-2222' },
    })
    fireEvent.change(screen.getByPlaceholderText('example@mail.com'), {
      target: { value: 'guest@example.com' },
    })

    const submitButton = screen.getByRole('button', { name: '予約リクエストを送信' })
    fireEvent.click(submitButton)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, requestOptions] = fetchMock.mock.calls[0]!
    const payload = JSON.parse((requestOptions?.body as string) ?? '{}')

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

  it('shows submission memo and supports copying summary content', async () => {
    const clipboardMock = vi.fn().mockResolvedValue(undefined)
    const originalClipboard = navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardMock },
    })

    try {
      render(
        <ReservationForm
          shopId={uuidShopId}
          selectedSlots={[
            {
              startAt: '2025-11-06T10:00:00+09:00',
              endAt: '2025-11-06T11:00:00+09:00',
              date: '2025-11-06',
              status: 'open',
            },
          ]}
          courseOptions={[
            { id: 'course-60', label: '60分コース', durationMinutes: 60, priceLabel: '¥8,000' },
          ]}
        />,
      )

      fireEvent.change(screen.getByPlaceholderText('例: 山田 太郎'), {
        target: { value: '山田 太郎' },
      })
      fireEvent.change(screen.getByPlaceholderText('090-1234-5678'), {
        target: { value: '090-3333-4444' },
      })

      fireEvent.click(screen.getByRole('button', { name: '予約リクエストを送信' }))

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
      expect(await screen.findByText('送信内容メモ')).toBeInTheDocument()

      const copyButton = screen.getByRole('button', { name: 'コピーする' })
      fireEvent.click(copyButton)

      await waitFor(() => expect(clipboardMock).toHaveBeenCalled())
      const copiedText = clipboardMock.mock.calls[0]?.[0]
      expect(copiedText).toContain('希望コース')

      await screen.findByRole('button', { name: 'コピーしました' })
    } finally {
      if (originalClipboard) {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: originalClipboard,
        })
      } else {
        delete (navigator as any).clipboard
      }
    }
  })
})
