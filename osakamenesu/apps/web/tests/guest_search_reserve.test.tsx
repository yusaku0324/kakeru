import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import SearchPage from '@/app/guest/search/page'

describe('Guest search & reserve link', () => {
  const items = [
    {
      id: 't1',
      therapist_id: 't1',
      therapist_name: 'Aさん',
      shop_id: 's1',
      shop_name: 'ショップ',
      score: 0.8,
      availability: { is_available: true, rejected_reasons: [] },
    },
  ]

  beforeEach(() => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ items, total: 1 }), { status: 200 })
    }) as any
  })

  it('search form submits and shows result with reserve link', async () => {
    render(<SearchPage />)

    await userEvent.type(screen.getByLabelText('エリア'), 'osaka')
    await userEvent.type(screen.getByLabelText('日付'), '2025-01-01')
    await userEvent.click(screen.getByRole('button', { name: 'この条件で検索' }))

    await waitFor(() => expect(screen.getByText('Aさん')).toBeInTheDocument())
    const link = screen.getByRole('link', { name: 'この人で予約' })
    expect(link).toHaveAttribute('href', '/guest/therapists/t1/reserve?shop_id=s1')
  })
})
