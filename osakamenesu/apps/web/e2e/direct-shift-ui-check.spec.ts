import { test } from '@playwright/test'

test.describe('シフトUIの直接確認', () => {
  test('開発環境のUIで時刻表示を確認', async ({ browser }) => {
    // コンテキストを作成
    const context = await browser.newContext()
    const page = await context.newPage()

    console.log('テスト開始：開発環境のシフト時刻表示を確認します')

    // Step 1: ダッシュボードログインページへアクセス
    await page.goto('http://localhost:3000/dashboard/login')
    await page.waitForLoadState('networkidle')

    // メールアドレスを入力してマジックリンクをリクエスト
    await page.fill('input[type="email"]', 'test@example.com')

    // ログイン前のスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/ui-check-login-form.png',
      fullPage: true
    })

    await page.click('button:has-text("ログインリンクを送信")')

    // レスポンスを待つ
    await page.waitForTimeout(1000)

    // メッセージが表示された後のスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/ui-check-after-submit.png',
      fullPage: true
    })

    // Step 2: 開発環境の場合、直接的なアクセスを試みる
    // APIを介してセッションを作成する別の方法を試す
    const apiContext = await context.request

    // テスト用APIエンドポイントにリクエスト
    try {
      const response = await apiContext.post('http://localhost:8000/api/auth/test-login', {
        headers: {
          'X-Test-Auth-Secret': 'dev-fallback',
          'Content-Type': 'application/json'
        },
        data: {
          email: 'playwright-dashboard@example.com',
          name: 'Playwright Test User'
        }
      })

      if (response.ok()) {
        const data = await response.json()
        console.log('テストログイン成功:', data)

        // セッションクッキーを取得して設定
        const cookies = await response.headers()
        console.log('Response headers:', cookies)
      } else {
        console.log('テストログイン失敗:', response.status(), await response.text())
      }
    } catch (error) {
      console.log('API接続エラー:', error)
    }

    // Step 3: 公開ページでシフト情報が表示されているか確認
    await page.goto('http://localhost:3000/search')
    await page.waitForLoadState('networkidle')

    // 検索ページのスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/ui-check-search-page.png',
      fullPage: true
    })

    // 店舗詳細ページを探す
    const shopLinks = await page.locator('a[href*="/shops/"]').all()
    console.log(`見つかった店舗リンク数: ${shopLinks.length}`)

    if (shopLinks.length > 0) {
      // 最初の店舗をクリック
      await shopLinks[0].click()
      await page.waitForLoadState('networkidle')

      // 店舗詳細ページのスクリーンショット
      await page.screenshot({
        path: 'e2e/screenshots/ui-check-shop-detail.png',
        fullPage: true
      })

      // セラピストのシフト時刻を探す
      const timeElements = await page.locator('text=/\\d{1,2}:\\d{2}.*\\d{1,2}:\\d{2}/').all()
      console.log(`時刻表示が見つかった数: ${timeElements.length}`)

      for (let i = 0; i < Math.min(timeElements.length, 10); i++) {
        const text = await timeElements[i].textContent()
        console.log(`  時刻表示 ${i + 1}: ${text}`)

        // 問題のある表示をチェック
        if (text && text.includes('20:00')) {
          console.log('    ⚠️ 20:00の表示が見つかりました！')

          // 問題のある要素の周辺をスクリーンショット
          const box = await timeElements[i].boundingBox()
          if (box) {
            await page.screenshot({
              path: `e2e/screenshots/ui-check-time-issue-${i}.png`,
              clip: {
                x: Math.max(0, box.x - 50),
                y: Math.max(0, box.y - 50),
                width: box.width + 100,
                height: box.height + 100
              }
            })
          }
        }
      }
    }

    console.log('テスト完了')
    await context.close()
  })
})
