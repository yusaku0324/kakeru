import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'

import ShopReviews from '../ShopReviews'

const originalFetch = global.fetch

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

describe('ShopReviews', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
    global.fetch = originalFetch
    vi.useRealTimers()
  })

  it('renders highlighted reviews and aspect summary in demo環境', async () => {
    render(
      <ShopReviews
        shopId="demo-shop"
        summary={{
          review_count: 1,
          highlighted: [
            {
              review_id: 'hl-1',
              title: '癒やされました',
              body: '落ち着いた接客で安心できました。',
              score: 5,
              author_alias: '会社員A',
              visited_at: '2024-10-01',
              aspects: {
                therapist_service: { score: 5, note: 'とても丁寧' },
              },
            },
          ],
          aspect_averages: {
            therapist_service: 4.8,
            staff_response: 4.5,
          },
          aspect_counts: {
            therapist_service: 12,
            staff_response: 10,
          },
        }}
      />,
    )

    expect(await screen.findByText('癒やされました')).toBeInTheDocument()
    expect(screen.getByText('12件の評価')).toBeInTheDocument()
    expect(screen.getAllByText('施術の丁寧さや気配りなど').length).toBeGreaterThan(0)
    // Demo環境のため fetch が呼ばれないことを確認
    expect(global.fetch).toBe(originalFetch)
  })

  it('loads reviews from API and supports load more', async () => {
    const fetchMock = vi.fn()

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        total: 3,
        items: [
          {
            id: 'rev-1',
            profile_id: 'profile-1',
            status: 'published',
            score: 5,
            title: '初訪問',
            body: 'とても良かったです。',
            author_alias: '訪問者1',
            visited_at: '2024-09-01',
            created_at: '2024-09-02T00:00:00Z',
            updated_at: '2024-09-02T00:00:00Z',
            aspects: {
              therapist_service: { score: 5 },
            },
          },
          {
            id: 'rev-2',
            profile_id: 'profile-1',
            status: 'published',
            score: 4,
            title: '再訪問',
            body: '雰囲気が気に入りました。',
            author_alias: '訪問者2',
            visited_at: '2024-09-10',
            created_at: '2024-09-11T00:00:00Z',
            updated_at: '2024-09-11T00:00:00Z',
          },
        ],
        aspect_averages: { therapist_service: 4.5 },
        aspect_counts: { therapist_service: 2 },
      }),
    )

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        total: 3,
        items: [
          {
            id: 'rev-3',
            profile_id: 'profile-1',
            status: 'published',
            score: 5,
            title: '三度目',
            body: 'リピート確定です！',
            author_alias: '訪問者3',
            visited_at: '2024-09-15',
            created_at: '2024-09-16T00:00:00Z',
            updated_at: '2024-09-16T00:00:00Z',
          },
        ],
        aspect_averages: { therapist_service: 4.7 },
        aspect_counts: { therapist_service: 3 },
      }),
    )

    global.fetch = fetchMock as unknown as typeof global.fetch

    render(<ShopReviews shopId="11111111-1111-1111-1111-111111111111" summary={null} />)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/shops/11111111-1111-1111-1111-111111111111/reviews?page=1')

    expect(await screen.findByText('初訪問')).toBeInTheDocument()
    expect(screen.getByText('再訪問')).toBeInTheDocument()

    const moreButton = screen.getByRole('button', { name: 'さらに口コミを読み込む' })
    await userEvent.click(moreButton)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/shops/11111111-1111-1111-1111-111111111111/reviews?page=2')
    expect(await screen.findByText('三度目')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'さらに口コミを読み込む' })).not.toBeInTheDocument()
    })
  })

  it('submits a new review and prepends it to the list', async () => {
    const fetchMock = vi.fn()

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        total: 0,
        items: [],
        aspect_averages: {},
        aspect_counts: {},
      }),
    )

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          id: 'new-review',
          profile_id: 'profile-1',
          status: 'pending',
          score: 5,
          title: '投稿テスト',
          body: 'テスト本文',
          author_alias: 'tester',
          visited_at: '2024-10-01',
          created_at: '2024-10-02T00:00:00Z',
          updated_at: '2024-10-02T00:00:00Z',
          aspects: {
            therapist_service: { score: 5, note: '最高でした' },
          },
        },
        { status: 201 },
      ),
    )

    global.fetch = fetchMock as unknown as typeof global.fetch
    const user = userEvent.setup()

    render(<ShopReviews shopId="22222222-2222-2222-2222-222222222222" summary={null} />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const bodyField = await screen.findByPlaceholderText('利用したコースや接客の印象などを教えてください。')
    await user.type(bodyField, 'テスト本文')

    const titleField = screen.getByPlaceholderText('接客が丁寧でした など')
    await user.type(titleField, '投稿テスト')

    const nicknameField = screen.getByPlaceholderText('匿名希望でもOK')
    await user.type(nicknameField, 'tester')

    const dateField = screen.getByLabelText('来店日')
    fireEvent.change(dateField, { target: { value: '2024-10-01' } })

    const aspectSelect = screen.getAllByRole('combobox')[1]
    fireEvent.change(aspectSelect, { target: { value: '5' } })

    const aspectNote = screen.getAllByPlaceholderText('気になった点など（任意）')[0]
    await user.type(aspectNote, '最高でした')

    const submitButton = screen.getByRole('button', { name: '口コミを投稿する' })
    await user.click(submitButton)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/shops/22222222-2222-2222-2222-222222222222/reviews',
      expect.objectContaining({
        method: 'POST',
      }),
    )

    expect(await screen.findByText('投稿テスト')).toBeInTheDocument()
    expect(screen.getByText('テスト本文')).toBeInTheDocument()
    expect(screen.getByText('店舗での確認後に掲載されます。反映まで少し時間がかかる場合があります。')).toBeInTheDocument()
  })

  it('shows an error toast when submission fails', async () => {
    const fetchMock = vi.fn()

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        total: 0,
        items: [],
        aspect_averages: {},
        aspect_counts: {},
      }),
    )

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: '入力内容を確認してください。' }, { status: 422 }),
    )

    global.fetch = fetchMock as unknown as typeof global.fetch
    const user = userEvent.setup()

    render(<ShopReviews shopId="33333333-3333-3333-3333-333333333333" summary={null} />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const bodyField = await screen.findByPlaceholderText('利用したコースや接客の印象などを教えてください。')
    await user.type(bodyField, '失敗テスト本文')

    const submitButton = screen.getByRole('button', { name: '口コミを投稿する' })
    await user.click(submitButton)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    expect(await screen.findByText('入力内容を確認してください。')).toBeInTheDocument()
  })
})
