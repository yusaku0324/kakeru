import { test, expect } from '@playwright/test'

test.describe('現在のシフト時刻表示を確認', () => {
  test('ローカル環境で時刻表示のスクリーンショットを撮影', async ({ page }) => {
    // 開発環境に直接アクセス
    await page.goto('http://localhost:3000')

    // リダイレクト先を確認
    await page.waitForLoadState('networkidle')
    console.log('現在のURL:', page.url())

    // トップページのスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/current-homepage.png',
      fullPage: true
    })

    // ダッシュボードログインページへ
    await page.goto('http://localhost:3000/dashboard/login')
    await page.waitForLoadState('networkidle')

    // ログインページのスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/current-login-page.png',
      fullPage: true
    })

    // 実際に存在するシフト管理ページのパスを推測してアクセス
    // 例: /dashboard/shops/[id]/shifts の形式
    const possiblePaths = [
      '/dashboard/shops/1/shifts',
      '/dashboard/shops/test/shifts',
      '/dashboard/shops/example/shifts'
    ]

    for (const path of possiblePaths) {
      try {
        await page.goto(`http://localhost:3000${path}`, { timeout: 5000 })
        await page.waitForLoadState('networkidle', { timeout: 5000 })

        const currentUrl = page.url()
        if (!currentUrl.includes('login')) {
          console.log(`アクセス成功: ${path}`)

          // シフト管理ページのスクリーンショット
          await page.screenshot({
            path: `e2e/screenshots/shifts-page-${path.split('/').pop()}.png`,
            fullPage: true
          })

          // 時刻表示を探す
          const timeElements = await page.locator('text=/\\d{1,2}:\\d{2}.*\\d{1,2}:\\d{2}/').all()
          console.log(`時刻表示が見つかった数: ${timeElements.length}`)

          for (let i = 0; i < Math.min(timeElements.length, 5); i++) {
            const text = await timeElements[i].textContent()
            console.log(`  時刻表示 ${i + 1}: ${text}`)
          }

          break
        }
      } catch (error) {
        console.log(`${path} へのアクセスに失敗しました`)
      }
    }

    // 検索ページを確認（通常はログイン不要）
    await page.goto('http://localhost:3000/search')
    await page.waitForLoadState('networkidle')

    // 検索ページのスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/current-search-page.png',
      fullPage: true
    })
  })
})
