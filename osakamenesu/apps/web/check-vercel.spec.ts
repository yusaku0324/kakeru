import { test, expect } from '@playwright/test'

const VERCEL_URL = 'https://web-2ojy9o4ms-yusaku0324s-projects.vercel.app'

test('検索ページにAIコンシェルジュボタンが表示される', async ({ page }) => {
  await page.goto(`${VERCEL_URL}/search`)

  // ページが読み込まれるまで待つ
  await page.waitForLoadState('networkidle')

  // スクリーンショットを保存
  await page.screenshot({ path: 'vercel-search-page.png', fullPage: true })

  // AIコンシェルジュボタンを探す
  const conciergeButton = page.locator('text=AIコンシェルジュに相談する')
  const buttonExists = await conciergeButton.count() > 0

  console.log('AIコンシェルジュボタン存在:', buttonExists)

  // タブを確認
  const therapistTab = page.locator('text=セラピスト')
  const shopTab = page.locator('text=店舗')
  const allTab = page.locator('text=総合')

  console.log('セラピストタブ:', await therapistTab.count() > 0)
  console.log('店舗タブ:', await shopTab.count() > 0)
  console.log('総合タブ:', await allTab.count() > 0)

  expect(buttonExists).toBe(true)
})

test('ホームページに総合で探すリンクがないことを確認', async ({ page }) => {
  await page.goto(`${VERCEL_URL}/`)

  await page.waitForLoadState('networkidle')

  // スクリーンショットを保存
  await page.screenshot({ path: 'vercel-home-page.png', fullPage: true })

  // 総合で探すリンクがないことを確認
  const allSearchLink = page.locator('text=総合で探す')
  const linkExists = await allSearchLink.count() > 0

  console.log('総合で探すリンク存在:', linkExists)

  expect(linkExists).toBe(false)
})
