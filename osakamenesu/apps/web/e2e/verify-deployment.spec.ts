import { test } from '@playwright/test'

test.describe('デプロイ後の時刻表示確認', () => {
  test('本番環境でシフト作成時の時刻を確認', async ({ page }) => {
    console.log('=== デプロイ後の時刻表示確認 ===')

    // 1. 本番環境のダッシュボードログインページにアクセス
    await page.goto('https://osakamenesu-web.vercel.app/dashboard/login')
    await page.waitForLoadState('networkidle')

    // ログインページのスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/deploy-01-login.png',
      fullPage: true
    })

    console.log('ログインページにアクセスしました')

    // 2. テスト用メールアドレスを入力
    const testEmail = 'test@example.com'
    await page.fill('input[type="email"]', testEmail)

    // メール入力後のスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/deploy-02-email-entered.png',
      fullPage: true
    })

    // ログインリンク送信をクリック
    await page.click('button:has-text("ログインリンクを送信")')
    await page.waitForTimeout(2000)

    // 送信後のスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/deploy-03-after-submit.png',
      fullPage: true
    })

    console.log('メールアドレスを入力してログインリンクをリクエストしました')
    console.log('注: 実際のログインには、送信されたメールのリンクをクリックする必要があります')

    // 3. 公開ページで時刻表示を確認
    console.log('\n公開ページでの時刻表示を確認します...')

    await page.goto('https://osakamenesu-web.vercel.app/search')
    await page.waitForLoadState('networkidle')

    // 検索ページのスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/deploy-04-search-page.png',
      fullPage: true
    })

    // 時刻表示を探す
    const timeElements = await page.locator('text=/\\d{1,2}:\\d{2}/').all()
    console.log(`\n時刻表示が見つかった数: ${timeElements.length}`)

    let foundIssue = false
    for (let i = 0; i < Math.min(timeElements.length, 10); i++) {
      const text = await timeElements[i].textContent()
      if (text) {
        console.log(`  時刻 ${i + 1}: ${text}`)

        if (text.includes('20:00') || text.includes('21:00') || text.includes('22:00')) {
          console.log('    ⚠️ 20時台の表示が見つかりました！')
          foundIssue = true

          // 問題のある要素をハイライト
          await timeElements[i].evaluate(el => {
            el.style.border = '3px solid red'
            el.style.backgroundColor = 'yellow'
            el.style.padding = '5px'
          })
        }
      }
    }

    if (foundIssue) {
      // ハイライト付きのスクリーンショット
      await page.screenshot({
        path: 'e2e/screenshots/deploy-05-time-issue-highlighted.png',
        fullPage: true
      })
      console.log('\n❌ まだ時刻表示の問題が残っているようです')
    } else {
      console.log('\n✓ 20時台の表示は見つかりませんでした')
    }

    // 4. 手動確認のためブラウザを開いたままにする
    console.log('\n=== 手動確認用 ===')
    console.log('ブラウザを60秒間開いたままにします')
    console.log('手動でダッシュボードにログインしてシフト作成を確認してください：')
    console.log('1. メールのマジックリンクをクリック')
    console.log('2. 店舗を選択')
    console.log('3. シフト管理へ移動')
    console.log('4. 新規シフトを11:00-13:00で作成')
    console.log('5. 保存後の表示を確認')

    await page.waitForTimeout(60000)

    // 最終スクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/deploy-06-final.png',
      fullPage: true
    })

    console.log('\n確認完了')
  })
})
