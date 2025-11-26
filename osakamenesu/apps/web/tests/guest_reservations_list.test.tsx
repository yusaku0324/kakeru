import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'

import GuestReservationsPage from '@/app/guest/reservations/page'

describe('Guest reservations list page', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify([
          {
            id: 'r1',
            status: 'confirmed',
            shop_id: 'shop-1',
            therapist_id: 'thera-1',
            start_at: '2025-01-01T10:00:00Z',
            end_at: '2025-01-01T11:00:00Z',
          },
        ]),
        { status: 200 },
      )
    }) as any
    // @ts-expect-error partial window mock
    global.window = {
      localStorage: {
        getItem: vi.fn(() => 'guest-token-1'),
      },
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders reservations from API', async () => {
    render(<GuestReservationsPage />)

    await waitFor(() => expect(screen.getByText('マイ予約一覧')).toBeInTheDocument())
    expect(await screen.findByText('thera-1')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalled()
  })

  it('shows empty message when none', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })) as any
    render(<GuestReservationsPage />)
    await waitFor(() => expect(screen.getByText('現在予約はありません。')).toBeInTheDocument())
  })
})
