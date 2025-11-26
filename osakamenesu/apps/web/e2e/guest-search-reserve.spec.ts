import { expect, test } from '@playwright/test'

test('guest can search, see results, and complete reservation (mocked APIs)', async ({ page }) => {
  const therapistId = '11111111-1111-1111-8888-111111111111'
  const shopId = 'playwright-shop'

  // Mock matching search
  await page.route('**/api/guest/matching/search**', async (route) => {
    const json = {
      items: [
        {
          id: therapistId,
          therapist_id: therapistId,
          therapist_name: 'プレイライト葵',
          shop_id: shopId,
          shop_name: 'プレイライトサロン',
          score: 0.82,
          availability: { is_available: true, rejected_reasons: [] },
        },
      ],
      total: 1,
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) })
  })

  // Mock reservation success
  await page.route('**/api/guest/reservations**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'confirmed', id: 'resv-mock', debug: { rejected_reasons: [] } }),
    })
  })

  await page.goto('/guest/search')

  await page.getByLabel('エリア').fill('osaka')
  await page.getByLabel('日付').fill('2025-01-01')
  await page.getByLabel('開始').fill('10:00')
  await page.getByLabel('終了').fill('12:00')
  await page.getByRole('button', { name: 'この条件で検索' }).click()

  await expect(page.getByText('プレイライト葵')).toBeVisible()
  await expect(page.getByText('スコア')).toBeVisible()
  await expect(page.getByText('空きあり')).toBeVisible()

  await page.getByRole('link', { name: 'この人で予約' }).click()
  await expect(page).toHaveURL(new RegExp(`/guest/therapists/${therapistId}/reserve`))

  // フォームが描画されるのを待ち、入力した値が反映されることを確認してから送信する
  await expect(page.getByRole('heading', { name: '予約フォーム' })).toBeVisible()
  const dateInput = page.getByLabel('日付')
  const startInput = page.getByLabel('開始')
  const endInput = page.getByLabel('終了')
  await dateInput.fill('2025-01-02')
  await expect(dateInput).toHaveValue('2025-01-02')
  await startInput.fill('15:00')
  await expect(startInput).toHaveValue('15:00')
  await endInput.fill('16:00')
  await expect(endInput).toHaveValue('16:00')
  await page.getByLabel('電話番号').fill('09000000000')
  await page.getByLabel('LINE ID').fill('playwright_line')
  await page.getByRole('button', { name: '予約する' }).click()

  await expect(page.getByText(/予約が完了/)).toBeVisible()
})
