import { expect, test } from '@playwright/test'

const SHOP_ID = 'sample-namba-resort'
const REVIEWS_ENDPOINT = new RegExp(`/api/v1/shops/${SHOP_ID}/reviews`)

test.describe('Shop reviews', () => {
  test('fetches remote reviews and allows posting with mock API', async ({ page, baseURL }) => {
    const createdAt = new Date().toISOString()
    const reviewItems = [
      {
        id: 'rev-existing-1',
        profile_id: SHOP_ID,
        status: 'published',
        score: 5,
        title: 'とても丁寧な対応',
        body: 'モックレビューテキスト',
        author_alias: 'E2E ユーザー',
        visited_at: '2024-09-01',
        created_at: createdAt,
        updated_at: createdAt,
        aspects: {
          therapist_service: { score: 5, note: '丁寧' },
          staff_response: { score: 4 },
        },
      },
      {
        id: 'rev-existing-2',
        profile_id: SHOP_ID,
        status: 'published',
        score: 4,
        title: 'また利用したい',
        body: '落ち着いた空間でした。',
        author_alias: 'Repeat',
        visited_at: '2024-08-12',
        created_at: createdAt,
        updated_at: createdAt,
        aspects: {
          therapist_service: { score: 4 },
          room_cleanliness: { score: 5 },
        },
      },
    ]

    await page.route(REVIEWS_ENDPOINT, async (route) => {
      const request = route.request()
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            total: reviewItems.length,
            items: reviewItems,
            aspect_averages: {
              therapist_service: 4.5,
              staff_response: 4.0,
              room_cleanliness: 5.0,
            },
            aspect_counts: {
              therapist_service: 2,
              staff_response: 1,
              room_cleanliness: 1,
            },
          }),
        })
        return
      }

      if (request.method() === 'POST') {
        const payload = JSON.parse(request.postData() ?? '{}')
        const response = {
          id: 'rev-new',
          profile_id: SHOP_ID,
          status: 'pending',
          score: payload.score ?? 5,
          title: payload.title ?? 'E2E 投稿テスト',
          body: payload.body ?? '',
          author_alias: payload.author_alias ?? null,
          visited_at: payload.visited_at ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          aspects: payload.aspects ?? {},
        }
        await route.fulfill({
          status: 201,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(response),
        })
        return
      }

      await route.fallback()
    })

    await page.goto(`${baseURL}/profiles/${SHOP_ID}?force_reviews=1`)

    await expect(page.getByRole('heading', { name: '口コミ' })).toBeVisible()
    await expect(page.getByText('モックレビューテキスト')).toBeVisible()
    await expect(page.locator('[data-testid="review-aspect-card"]').first().getByText('セラピストの接客')).toBeVisible()

    await page.getByLabel('口コミ本文 *').fill('E2E Playwright 投稿本文')
    await page.getByRole('button', { name: '口コミを投稿する' }).click()

    await expect(page.getByText('口コミを送信しました。掲載までしばらくお待ちください。')).toBeVisible()
    await expect(page.getByText('E2E Playwright 投稿本文')).toBeVisible()
  })
})
