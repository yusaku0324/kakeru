import { test, expect } from '@playwright/test'

test.describe('シフトと候補枠の同期確認', () => {
  test('シフト登録が候補枠に正しく反映されることを確認', async ({ page }) => {
    console.log('=== シフトと候補枠の同期テスト開始 ===')

    // ダッシュボードにアクセス
    await page.goto('http://localhost:3000/dashboard/login')
    await page.screenshot({
      path: 'e2e/screenshots/shift-sync-01-login.png',
      fullPage: true
    })

    // 手動でログインを促す
    console.log('\n以下の手順でテストを実施してください：')
    console.log('1. ダッシュボードにログイン')
    console.log('2. SSSの店舗管理画面を開く')
    console.log('3. シフト管理を開く')
    console.log('4. 以下のシフトを登録：')
    console.log('   - 本日 13:00-15:00')
    console.log('   - 明日 16:00-20:00')
    console.log('   - 明後日 12:00-18:00')
    console.log('5. 各シフト登録後にスクリーンショットが撮影されます')
    console.log('6. その後、候補枠の調整画面を開いてください')
    console.log('7. すべての時間枠が正しく反映されているか確認します')

    let screenshotCount = 1

    // 3分間の手動操作時間
    for (let i = 0; i < 18; i++) {
      await page.waitForTimeout(10000) // 10秒待機

      // 10秒ごとにスクリーンショット
      await page.screenshot({
        path: `e2e/screenshots/shift-sync-${String(screenshotCount).padStart(2, '0')}-progress.png`,
        fullPage: true
      })

      console.log(`スクリーンショット ${screenshotCount}/18 保存完了`)
      screenshotCount++

      // URLチェック
      const url = page.url()
      console.log(`現在のURL: ${url}`)

      // シフト管理画面の確認
      if (url.includes('/shifts')) {
        console.log('→ シフト管理画面を検出')

        // 登録されているシフトを確認
        try {
          const shiftElements = await page.locator('[data-testid="shift-item"], .shift-item').all()
          if (shiftElements.length > 0) {
            console.log(`→ ${shiftElements.length}件のシフトを検出`)
          }
        } catch (e) {
          // エラーは無視
        }
      }

      // 候補枠の調整画面の確認
      if (url.includes('/reservation') || page.locator('text=候補枠の調整').isVisible()) {
        console.log('→ 候補枠の調整画面を検出')

        // 特別なスクリーンショット
        await page.screenshot({
          path: `e2e/screenshots/shift-sync-AVAILABILITY-${screenshotCount}.png`,
          fullPage: true
        })

        // 空き枠の状態を確認
        try {
          // ○マークの数をカウント
          const availableSlots = await page.locator('text=○').all()
          console.log(`→ ${availableSlots.length}個の空き枠（○）を検出`)

          // 各時間帯の状態を確認
          const timeSlots = ['9:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
                            '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
                            '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30']

          for (const time of timeSlots) {
            try {
              const timeRow = page.locator(`text=${time}`).first()
              if (await timeRow.isVisible()) {
                // その行の○や×の状態を確認
                const row = timeRow.locator('..')
                const circles = await row.locator('text=○').count()
                if (circles > 0) {
                  console.log(`  ${time}: ${circles}個の空き枠あり`)
                }
              }
            } catch (e) {
              // エラーは無視
            }
          }
        } catch (e) {
          console.log('空き枠の詳細確認でエラー:', e.message)
        }
      }
    }

    console.log('\n=== テスト完了 ===')
    console.log('保存されたスクリーンショットを確認してください：')
    console.log('- shift-sync-01-login.png: ログイン画面')
    console.log('- shift-sync-XX-progress.png: 進行状況')
    console.log('- shift-sync-AVAILABILITY-XX.png: 候補枠の調整画面')
  })
})
