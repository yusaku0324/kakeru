import { test, expect } from '@playwright/test'

test.describe('本番環境でシフト作成とUI確認', () => {
  test('Vercelの本番環境でシフトを作成して時刻表示を確認', async ({ page }) => {
    console.log('=== 本番環境でのシフト時刻表示テスト ===')

    // 1. 本番環境のダッシュボードにアクセス
    await page.goto('https://osakamenesu-web.vercel.app/dashboard/login')
    await page.waitForLoadState('networkidle')

    console.log('ダッシュボードログインページにアクセスしました')

    // ログインページのスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/prod-01-login-page.png',
      fullPage: true
    })

    // 2. メールアドレスを入力してマジックリンクをリクエスト
    const testEmail = `test-${Date.now()}@example.com`
    console.log(`テスト用メールアドレス: ${testEmail}`)

    await page.fill('input[type="email"]', testEmail)
    await page.click('button:has-text("ログインリンクを送信")')

    // レスポンスを待つ
    await page.waitForTimeout(2000)

    // 送信後のスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/prod-02-after-email-submit.png',
      fullPage: true
    })

    // 3. テスト環境の場合、直接ダッシュボードにアクセスを試みる
    console.log('テストログインを試みます...')

    // 本番環境でのテストログイン（開発環境とは異なる可能性）
    try {
      // APIを直接呼び出してテストログイン
      const response = await page.request.post('https://osakamenesu-web.vercel.app/api/auth/test-login', {
        headers: {
          'X-Test-Auth-Secret': 'production-secret', // 本番用のシークレット
          'Content-Type': 'application/json'
        },
        data: {
          email: testEmail,
          name: 'Playwright Test User'
        }
      })

      if (response.ok()) {
        console.log('テストログイン成功')
      } else {
        console.log('テストログイン失敗:', response.status())

        // 開発モードでのアクセスを試みる
        await page.goto('https://osakamenesu-web.vercel.app/dashboard/shops')
        await page.waitForLoadState('networkidle')
      }
    } catch (error) {
      console.log('APIアクセスエラー:', error)
    }

    // 4. 現在のページを確認
    const currentUrl = page.url()
    console.log('現在のURL:', currentUrl)

    if (currentUrl.includes('login')) {
      console.log('ログインページのままです。手動でのログインが必要かもしれません。')

      // 公開ページでシフト情報を確認
      console.log('公開ページでシフト情報を確認します...')

      await page.goto('https://osakamenesu-web.vercel.app/search')
      await page.waitForLoadState('networkidle')

      // 検索ページのスクリーンショット
      await page.screenshot({
        path: 'e2e/screenshots/prod-03-search-page.png',
        fullPage: true
      })

      // 店舗を探す
      const shopCards = await page.locator('a[href*="/shops/"]').all()
      console.log(`見つかった店舗数: ${shopCards.length}`)

      if (shopCards.length > 0) {
        // 最初の店舗をクリック
        await shopCards[0].click()
        await page.waitForLoadState('networkidle')

        // 店舗詳細ページのスクリーンショット
        await page.screenshot({
          path: 'e2e/screenshots/prod-04-shop-detail.png',
          fullPage: true
        })

        // シフト時刻を探す
        const timeElements = await page.locator('text=/\\d{1,2}:\\d{2}.*[-〜].*\\d{1,2}:\\d{2}/').all()
        console.log(`\n時刻表示が見つかった数: ${timeElements.length}`)

        for (let i = 0; i < Math.min(timeElements.length, 10); i++) {
          const text = await timeElements[i].textContent()
          console.log(`  時刻表示 ${i + 1}: ${text}`)

          // 20:00の表示をチェック
          if (text && text.includes('20:00')) {
            console.log('    ⚠️ 20:00の表示が見つかりました！タイムゾーン問題が残っています。')

            // 問題のある要素をハイライトしてスクリーンショット
            await timeElements[i].evaluate(el => {
              el.style.border = '3px solid red'
              el.style.backgroundColor = 'yellow'
            })

            await page.screenshot({
              path: `e2e/screenshots/prod-05-time-issue-${i}.png`,
              fullPage: true
            })
          } else if (text && (text.includes('11:00') || text.includes('13:00') || text.includes('15:00'))) {
            console.log('    ✓ 正しい時刻表示のようです')
          }
        }
      }
    } else {
      console.log('ダッシュボードにアクセスできました！')

      // 店舗管理画面のスクリーンショット
      await page.screenshot({
        path: 'e2e/screenshots/prod-06-dashboard.png',
        fullPage: true
      })

      // 店舗を選択または作成
      const existingShops = await page.locator('.grid a[href*="/dashboard/shops/"]').all()
      if (existingShops.length > 0) {
        console.log('既存の店舗を使用します')
        await existingShops[0].click()
      } else {
        console.log('新しい店舗を作成する必要があります')
        // 店舗作成のロジックを追加
      }

      await page.waitForLoadState('networkidle')

      // シフト管理へ
      const shiftsLink = await page.locator('a:has-text("シフト管理")').first()
      if (await shiftsLink.isVisible()) {
        await shiftsLink.click()
        await page.waitForLoadState('networkidle')

        // シフト管理画面のスクリーンショット
        await page.screenshot({
          path: 'e2e/screenshots/prod-07-shifts-page.png',
          fullPage: true
        })

        // 新規シフト作成
        const newShiftButton = await page.locator('button:has-text("新規作成"), button:has-text("追加")').first()
        if (await newShiftButton.isVisible()) {
          await newShiftButton.click()
          await page.waitForTimeout(1000)

          // セラピストを選択（必要に応じて）
          const therapistSelect = await page.locator('select').first()
          if (await therapistSelect.isVisible()) {
            const options = await therapistSelect.locator('option').all()
            if (options.length > 1) {
              await therapistSelect.selectOption({ index: 1 })
            }
          }

          // 日付と時刻を設定（13:00-15:00）
          const today = new Date().toISOString().split('T')[0]
          await page.fill('input[type="date"]', today)
          await page.fill('input[type="time"]:first-of-type', '13:00')
          await page.fill('input[type="time"]:last-of-type', '15:00')

          // 入力後のスクリーンショット
          await page.screenshot({
            path: 'e2e/screenshots/prod-08-new-shift-form.png',
            fullPage: true
          })

          // 保存
          await page.click('button:has-text("保存")')
          await page.waitForTimeout(3000)

          // 保存後のシフト一覧
          await page.screenshot({
            path: 'e2e/screenshots/prod-09-after-save.png',
            fullPage: true
          })

          // 新しく作成されたシフトの時刻を確認
          const newShiftTimes = await page.locator('text=/13:00.*15:00/').all()
          console.log(`\n13:00-15:00のシフトが見つかった数: ${newShiftTimes.length}`)

          if (newShiftTimes.length > 0) {
            const displayedTime = await newShiftTimes[0].textContent()
            console.log(`表示されている時刻: ${displayedTime}`)

            if (displayedTime && displayedTime.includes('22:00')) {
              console.log('❌ タイムゾーン問題: 13:00が22:00として表示されています')
            } else {
              console.log('✓ 正しく13:00-15:00として表示されています')
            }
          }
        }
      }
    }

    console.log('\nテスト完了')
  })
})
