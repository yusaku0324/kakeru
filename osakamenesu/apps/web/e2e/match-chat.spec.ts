import { test, expect } from '@playwright/test'

test.describe('guest match-chat search', () => {
  test('shows empty state without crashing when search returns no items', async ({ page }) => {
    await page.route('**/api/guest/matching/search**', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: [], total: 0 }),
      }),
    )

    await page.goto('/guest/match-chat')
    await page.getByRole('heading', { name: 'コンシェルジュに相談して探す' }).waitFor()
    await page.getByPlaceholder('例）大阪市内 / 梅田 / 心斎橋').fill('大阪')
    await page.locator('input[type="date"]').fill('2025-01-01')
    await page.getByRole('button', { name: 'この条件でおすすめをみる' }).click()

    await expect(page.getByText('おすすめ取得に失敗しました')).toHaveCount(0)
  })

  test('shows gentle error message when search fails', async ({ page }) => {
    await page.route('**/api/guest/matching/search**', (route) =>
      route.fulfill({ status: 500, body: 'server error' }),
    )

    await page.goto('/guest/match-chat')
    await page.getByRole('heading', { name: 'コンシェルジュに相談して探す' }).waitFor()
    await page.getByPlaceholder('例）大阪市内 / 梅田 / 心斎橋').fill('大阪')
    await page.locator('input[type="date"]').fill('2025-01-01')
    await page.getByRole('button', { name: 'この条件でおすすめをみる' }).click()

    await expect(page.getByText('おすすめ取得に失敗しました')).toBeVisible()
  })
})
