import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShopsPage from '@/app/admin/shops/page'
import ShopTherapistsPage from '@/app/admin/shops/[shopId]/therapists/page'

describe('admin shops page', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('lists shops and submits create form', async () => {
    ;(fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: 's1', name: 'テスト店', area: 'osaka', status: 'published' }] }),
    })
    render(<ShopsPage />)
    await waitFor(() => expect(screen.getByText('テスト店')).toBeInTheDocument())

    ;(fetch as vi.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 's2', name: '新店舗' }) })
    ;(fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: 's2', name: '新店舗', area: '', status: null }] }),
    })

    await userEvent.type(screen.getByLabelText('店舗名'), '新店舗')
    await userEvent.click(screen.getByRole('button', { name: '追加する' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/shops', expect.anything()))
    await waitFor(() => expect(screen.getByText('新店舗')).toBeInTheDocument())
  })
})

describe('admin shop therapists page', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('lists therapists and has shift link', async () => {
    ;(fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: 't1', name: 'セラA', profile_id: 's1', tags: ['healing'] }] }),
    })
    render(<ShopTherapistsPage params={{ shopId: 's1' }} />)
    await waitFor(() => expect(screen.getByText('セラA')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'シフト管理' })).toHaveAttribute(
      'href',
      '/admin/therapists/t1/shifts',
    )
  })
})

