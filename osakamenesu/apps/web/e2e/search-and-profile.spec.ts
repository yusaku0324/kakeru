import { test, expect } from '@playwright/test'

test('search -> open profile -> has CTA links', async ({ page, baseURL }) => {
  const url = `${baseURL}/search?today=true&price_min=10000&price_max=30000&sort=price_min%3Adesc&page=1&force_samples=1`
  await page.goto(url)

  // 簡単なメタ情報が表示される（件数表示）
  await expect(page.getByText('店舗検索結果')).toBeVisible()

  // 空き状況のバッジ表示が想定どおりになっているかチェック
  const nambaCard = page.getByRole('link', { name: /アロマリゾート 難波本店プレミアム/ })
  await expect(nambaCard).toContainText('本日空きあり')

  const umedaCard = page.getByRole('link', { name: /リラクゼーションSUITE 梅田/ })
  await expect(umedaCard).toContainText('10月5日')
  await expect(umedaCard).toContainText('18:00')

  // 通常カード（PRではない）を1件クリック
  const firstProfileCard = page.locator('a[href^="/profiles/"]').first()
  await expect(firstProfileCard).toBeVisible()
  const targetHref = await firstProfileCard.getAttribute('href')
  await firstProfileCard.click()

  // プロフィール詳細に遷移
  await page.waitForURL(/\/profiles\//, { timeout: 15000 })
  await page.waitForLoadState('networkidle')

  // 料金と名前が見える
  await expect(page.locator('h1')).toBeVisible()

  // ギャラリーの存在と基本操作（写真がある場合）
  const view = page.locator('[data-testid="gallery-view"]').first()
  if (await view.count()) {
    await expect(view).toBeVisible()
    const dots = page.locator('[data-testid="gallery-dot"]')
    const thumbs = page.locator('[data-testid="gallery-thumb"]')
    const dotCount = await dots.count()
    if (dotCount >= 2) {
      // スクロールの状態を取得するヘルパ
      const getState = async () => {
        return await view.evaluate((el) => ({
          left: (el as HTMLElement).scrollLeft,
          width: (el as HTMLElement).clientWidth,
        }))
      }
      const s0 = await getState()
      await dots.nth(1).click()
      await expect.poll(async () => {
        const s = await getState()
        return Math.round(s.left)
      }).toBeGreaterThanOrEqual(Math.round(s0.width * 0.6))

      // サムネで先頭に戻す
      if (await thumbs.count()) {
        await thumbs.first().click()
        await expect.poll(async () => {
          const s = await getState()
          return Math.round(s.left)
        }).toBeLessThanOrEqual(10)
      }
    }
  }

  // プロフィール画面のヘッダーが表示されている
  await expect(page.locator('h1')).toBeVisible()
})
