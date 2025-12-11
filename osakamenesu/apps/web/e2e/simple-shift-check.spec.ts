import { test, expect } from '@playwright/test'

test('シフト管理ページのスクリーンショット', async ({ page }) => {
  // テスト用のCookieを設定（実際のセッション）
  await page.context().addCookies([
    {
      name: 'authjs.session-token',
      value: 'dummy-session-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax'
    }
  ])

  try {
    // シフト管理ページへ直接アクセス
    await page.goto('http://localhost:3000/dashboard/shops')

    // ページが読み込まれるのを待つ
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // 現在のURLとページタイトルを確認
    const currentUrl = page.url()
    console.log('現在のURL:', currentUrl)

    // スクリーンショットを撮る
    await page.screenshot({
      path: 'e2e/screenshots/dashboard-page.png',
      fullPage: true
    })

    // ログインページにリダイレクトされた場合
    if (currentUrl.includes('login')) {
      console.log('ログインページが表示されています')

      // ログインフォームのスクリーンショット
      await page.screenshot({
        path: 'e2e/screenshots/login-page.png',
        fullPage: true
      })
    }

    // シフト管理に関連する要素を探す
    const shiftsLink = await page.locator('text=/シフト/').first()
    if (await shiftsLink.isVisible()) {
      console.log('シフト管理リンクが見つかりました')
      await shiftsLink.click()

      await page.waitForTimeout(2000)

      // シフト管理ページのスクリーンショット
      await page.screenshot({
        path: 'e2e/screenshots/shifts-page.png',
        fullPage: true
      })

      // シフトの時刻表示を探す
      const timeElements = await page.locator('text=/\\d{1,2}:\\d{2}.*\\d{1,2}:\\d{2}/').all()
      console.log(`見つかった時刻表示: ${timeElements.length}件`)

      for (let i = 0; i < Math.min(timeElements.length, 3); i++) {
        const text = await timeElements[i].textContent()
        console.log(`  時刻 ${i + 1}: ${text}`)
      }
    }

  } catch (error) {
    console.error('エラーが発生しました:', error)

    // エラー時のスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/error-state.png',
      fullPage: true
    })
  }
})
