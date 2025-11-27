import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'

import AdminShopReservationsPage from '@/app/admin/shops/[shopId]/reservations/page'

describe('Admin shop reservations list', () => {
  const params = { shopId: 'shop-1' }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders reservations with status badges', async () => {
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          items: [
            {
              id: 'r-1',
              shop_id: params.shopId,
              start_at: '2025-01-01T12:00:00Z',
              end_at: '2025-01-01T13:00:00Z',
              status: 'pending',
              therapist_id: 't-1',
              created_at: '2025-01-01T09:00:00Z',
              updated_at: '2025-01-01T09:00:00Z',
            },
          ],
          summary: { pending: 1 },
        }),
        { status: 200 },
      )
    }) as any

    render(<AdminShopReservationsPage params={params} />)

    await waitFor(() => expect(screen.getByText('予約一覧')).toBeInTheDocument())
    expect(screen.getByText('pending')).toBeInTheDocument()
    expect(screen.getByText(/2025\/01\/01/)).toBeInTheDocument()
  })

  it('shows empty state', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ items: [], summary: {} }), { status: 200 })) as any

    render(<AdminShopReservationsPage params={params} />)

    await waitFor(() =>
      expect(screen.getByText('この店舗には現在表示できる予約がありません。')).toBeInTheDocument(),
    )
  })
})
