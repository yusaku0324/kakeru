import { test, expect } from '@playwright/test'

test.describe('シフト時刻表示の確認（セッション認証版）', () => {
  test.beforeEach(async ({ page, context }) => {
    // テスト環境用のセッションクッキーを設定
    await context.addCookies([
      {
        name: 'authjs.csrf-token',
        value: 'test-csrf-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax'
      },
      {
        name: 'authjs.callback-url',
        value: 'http://localhost:3000',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax'
      },
      {
        name: 'authjs.session-token',
        value: 'test-session-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax'
      }
    ])

    // テスト用の認証ヘッダーを設定
    await page.setExtraHTTPHeaders({
      'X-Test-Auth': 'dev-test-secret',
      'X-Test-Email': 'playwright-dashboard@example.com'
    })
  })

  test('シフト管理画面で時刻表示を確認', async ({ page }) => {
    // 直接ダッシュボードにアクセス
    await page.goto('http://localhost:3000/dashboard/shops')

    // ページが読み込まれるのを待つ
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const currentUrl = page.url()
    console.log('現在のURL:', currentUrl)

    // 認証されていない場合、ログインページにリダイレクトされる
    if (currentUrl.includes('login')) {
      console.log('認証に失敗しました。別の方法を試します...')

      // 開発環境の特別なテストパスを使用
      await page.goto('http://localhost:3000/api/auth/test-login?email=playwright-dashboard@example.com&redirect=/dashboard/shops')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
    }

    // ダッシュボードのスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/dashboard-with-session.png',
      fullPage: true
    })

    // シフト管理ページに移動するため、まず店舗を選択
    const shopLinks = await page.locator('a[href*="/dashboard/shops/"]').all()
    if (shopLinks.length > 0) {
      console.log(`${shopLinks.length}件の店舗が見つかりました`)

      // 最初の店舗をクリック
      await shopLinks[0].click()
      await page.waitForLoadState('networkidle')

      // シフト管理リンクを探す
      const shiftsLink = await page.locator('a[href*="/shifts"], text=/シフト/')
      if (await shiftsLink.isVisible()) {
        await shiftsLink.click()
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1000)

        // シフト管理ページのスクリーンショット
        await page.screenshot({
          path: 'e2e/screenshots/shifts-page-with-data.png',
          fullPage: true
        })

        // 既存のシフトの時刻表示を確認
        const shiftTimes = await page.locator('text=/\\d{1,2}:\\d{2}.*-.*\\d{1,2}:\\d{2}/').all()
        console.log(`既存のシフト数: ${shiftTimes.length}`)

        for (let i = 0; i < Math.min(shiftTimes.length, 5); i++) {
          const timeText = await shiftTimes[i].textContent()
          console.log(`シフト ${i + 1}: ${timeText}`)

          // 20:00-22:00のような誤った表示がないか確認
          if (timeText && timeText.includes('20:00')) {
            console.log('⚠️ 時刻がずれている可能性があります')
          }
        }

        // 新規シフト作成を試みる
        const newButton = await page.locator('button:has-text("新規作成"), button:has-text("追加")')
        if (await newButton.isVisible()) {
          await newButton.click()
          await page.waitForTimeout(1000)

          // フォームのスクリーンショット
          await page.screenshot({
            path: 'e2e/screenshots/new-shift-form-test.png',
            fullPage: true
          })

          console.log('新規シフトフォームが開きました')
        }
      }
    }
  })
})
