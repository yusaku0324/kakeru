import { test } from '@playwright/test'

test.describe('手動でシフトと空き枠を確認', () => {
  test('ブラウザを開いて手動確認', async ({ page }) => {
    console.log('=== 手動でシフトと空き枠を確認 ===')
    console.log('')
    console.log('このテストはブラウザを180秒間開いたままにします。')
    console.log('以下の手順で確認してください：')
    console.log('')
    console.log('1. メールアドレスでログイン（または既存のマジックリンクを使用）')
    console.log('2. 店舗を選択')
    console.log('3. 店舗詳細ページで「希望日時を選択」の空き枠プレビューを確認')
    console.log('4. 「シフト管理」に移動')
    console.log('5. 新しいシフトを追加（例: 11:00-13:00）')
    console.log('6. 保存後、店舗詳細ページに戻って空き枠プレビューが更新されているか確認')
    console.log('')

    // ダッシュボードログインページを開く
    await page.goto('http://localhost:3000/dashboard/login')
    await page.waitForLoadState('networkidle')

    // 初期スクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/manual-shift-01-login.png',
      fullPage: true
    })

    // 10秒ごとにスクリーンショットを撮る
    let counter = 1
    const interval = setInterval(async () => {
      counter++
      try {
        const currentUrl = page.url()
        console.log(`\n[${new Date().toLocaleTimeString()}] 現在のURL: ${currentUrl}`)

        // スクリーンショット
        await page.screenshot({
          path: `e2e/screenshots/manual-shift-${counter.toString().padStart(2, '0')}-progress.png`,
          fullPage: true
        })

        // 空き枠プレビューを探す
        if (currentUrl.includes('/dashboard/shops/') && !currentUrl.includes('/shifts')) {
          const timeSlots = await page.locator('text=/\\d{1,2}:\\d{2}/').all()
          if (timeSlots.length > 0) {
            console.log(`  時間枠が ${timeSlots.length} 個見つかりました`)

            // availability_calendar のレスポンスを確認
            const hasCalendar = await page.evaluate(() => {
              const scripts = Array.from(document.querySelectorAll('script'))
              return scripts.some(s => s.textContent?.includes('availability_calendar'))
            })
            console.log(`  availability_calendar データ: ${hasCalendar ? 'あり' : 'なし'}`)
          }
        }

        // シフト管理画面の場合
        if (currentUrl.includes('/shifts')) {
          const shifts = await page.locator('text=/\\d{1,2}:\\d{2}.*-.*\\d{1,2}:\\d{2}/').all()
          console.log(`  シフトが ${shifts.length} 個表示されています`)
        }
      } catch (error) {
        console.log('  スクリーンショット取得エラー:', error)
      }
    }, 10000)

    // 180秒待機
    await page.waitForTimeout(180000)

    clearInterval(interval)

    // 最終スクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/manual-shift-final.png',
      fullPage: true
    })

    console.log('\n確認完了')
    console.log('スクリーンショットは e2e/screenshots/ フォルダに保存されています')
  })
})
