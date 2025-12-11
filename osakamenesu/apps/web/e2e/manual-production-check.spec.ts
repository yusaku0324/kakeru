import { test } from '@playwright/test'

test.describe('本番環境の手動確認', () => {
  test('ブラウザを開いて手動で確認', async ({ page }) => {
    console.log('=== 本番環境での手動確認 ===')
    console.log('このテストはブラウザを120秒間開いたままにします。')
    console.log('手動で以下を確認してください：')
    console.log('')
    console.log('1. 検索ページから店舗を選択')
    console.log('2. セラピストのシフト時刻を確認')
    console.log('3. 20:00-22:00のような表示があるかチェック')
    console.log('4. ダッシュボードにログインして新規シフトを作成')
    console.log('5. 13:00-15:00で作成して、表示を確認')

    // 検索ページを開く
    await page.goto('https://osakamenesu-web.vercel.app/search')
    await page.waitForLoadState('networkidle')

    // 初期スクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/manual-01-initial.png',
      fullPage: true
    })

    // 定期的にスクリーンショットを撮る
    let counter = 1
    const interval = setInterval(async () => {
      counter++
      try {
        await page.screenshot({
          path: `e2e/screenshots/manual-${counter.toString().padStart(2, '0')}-progress.png`,
          fullPage: true
        })
        console.log(`スクリーンショット ${counter} を保存しました`)

        // 現在のURLを記録
        const currentUrl = page.url()
        console.log(`現在のURL: ${currentUrl}`)

        // 時刻表示を探す
        const timeElements = await page.locator('text=/\\d{1,2}:\\d{2}.*\\d{1,2}:\\d{2}/').all()
        if (timeElements.length > 0) {
          console.log(`時刻表示が ${timeElements.length} 個見つかりました：`)
          for (let i = 0; i < Math.min(timeElements.length, 5); i++) {
            const text = await timeElements[i].textContent()
            console.log(`  - ${text}`)
          }
        }
      } catch (error) {
        console.log('スクリーンショット取得エラー:', error)
      }
    }, 10000) // 10秒ごと

    // 120秒待機
    await page.waitForTimeout(120000)

    clearInterval(interval)

    // 最終スクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/manual-final.png',
      fullPage: true
    })

    console.log('\n確認完了')
    console.log('スクリーンショットは e2e/screenshots/ フォルダに保存されています')
  })
})
