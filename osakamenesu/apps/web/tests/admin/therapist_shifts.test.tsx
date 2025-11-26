import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import Page from '@/app/admin/therapists/[therapistId]/shifts/page'

describe('Admin Therapist Shifts Page', () => {
  const therapistId = 'test-therapist'

  beforeEach(() => {
    global.fetch = vi.fn(async (url, init) => {
      if (typeof url === 'string' && url.startsWith('/api/admin/therapist_shifts')) {
        if (init?.method === 'POST') {
          return new Response(JSON.stringify({ ok: true }), { status: 200 })
        }
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 's1',
                therapist_id: therapistId,
                shop_id: 'shop1',
                date: '2025-01-01',
                start_at: '2025-01-01T10:00:00Z',
                end_at: '2025-01-01T18:00:00Z',
                availability_status: 'available',
                notes: 'note',
              },
            ],
          }),
          { status: 200 },
        )
      }
      return new Response(null, { status: 404 })
    }) as any
  })

  it('renders shifts and allows creation', async () => {
    render(<Page params={{ therapistId }} />)

    await waitFor(() => expect(screen.getByText('シフト管理')).toBeInTheDocument())
    expect(await screen.findByText('available')).toBeInTheDocument()

    const submit = screen.getByRole('button', { name: '追加する' })
    await userEvent.click(submit)

    await waitFor(() => expect(screen.getByText(/シフトを登録しました/)).toBeInTheDocument())
  })
})

