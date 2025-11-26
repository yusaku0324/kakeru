import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ReservePage from '@/app/guest/therapists/[therapistId]/reserve/page'

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'shop_id' ? 'shop-1' : null),
  }),
}))

describe('Guest reserve form', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'crypto',
      // @ts-expect-error partial mock
      {
        randomUUID: () => 'guest-token-1',
      },
    )
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ status: 'confirmed', id: 'r1', debug: { rejected_reasons: [] } }), {
        status: 200,
      })
    }) as any
    // @ts-expect-error partial window mock
    global.window = {
      localStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      },
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends reservation payload on submit', async () => {
    render(<ReservePage params={{ therapistId: 'thera-1' }} />)

    await userEvent.type(screen.getByLabelText('日付'), '2025-01-02')
    await userEvent.type(screen.getByLabelText('開始'), '10:00')
    await userEvent.selectOptions(screen.getByLabelText('コース時間'), '90')
    await userEvent.type(screen.getByLabelText('電話番号'), '09012345678')

    await userEvent.click(screen.getByRole('button', { name: '予約する' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body as string)
    expect(body).toMatchObject({
      shop_id: 'shop-1',
      therapist_id: 'thera-1',
      start_at: '2025-01-02T10:00:00',
      duration_minutes: 90,
      guest_token: 'guest-token-1',
    })
    expect(body.end_at).toBe('2025-01-02T11:30:00')
  })
})
