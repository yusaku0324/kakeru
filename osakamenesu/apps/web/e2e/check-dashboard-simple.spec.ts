import { test } from '@playwright/test'

test('check dashboard shop list page', async ({ page }) => {
  // ダッシュボードのショップ一覧ページに直接アクセス
  await page.goto('http://localhost:3000/dashboard/shops')

  // ページが読み込まれるのを待つ
  await page.waitForTimeout(3000)

  // スクリーンショットを撮る
  await page.screenshot({ path: 'dashboard-shops-local.png', fullPage: true })

  // ページのタイトルまたはコンテンツを確認
  const pageContent = await page.textContent('body')
  console.log('Page content preview:', pageContent?.substring(0, 200))

  // 画像を探す
  const images = await page.locator('img').all()
  console.log(`Found ${images.length} images`)

  if (images.length > 0) {
    for (let i = 0; i < Math.min(images.length, 3); i++) {
      const img = images[i]
      const src = await img.getAttribute('src')
      console.log(`Image ${i} src:`, src)
    }
  }
})
