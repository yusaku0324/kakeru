import { test } from '@playwright/test'

test.describe('手動でシフト時刻を確認', () => {
  test('ブラウザを開いて手動確認用', async ({ page }) => {
    console.log('=== シフト時刻表示の手動確認 ===')
    console.log('このテストはブラウザを開いたままにします。')
    console.log('手動でログインしてシフト管理画面を確認してください。')

    // ダッシュボードログインページを開く
    await page.goto('http://localhost:3000/dashboard/login')

    // ログイン前のスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/manual-check-login.png',
      fullPage: true
    })

    console.log('\n手動確認手順:')
    console.log('1. メールアドレスを入力してログイン')
    console.log('2. 店舗を選択')
    console.log('3. シフト管理へ移動')
    console.log('4. 既存のシフトの時刻表示を確認')
    console.log('5. 新規シフトを11:00-13:00で作成')
    console.log('6. 作成後の表示を確認')
    console.log('7. 編集ボタンをクリックして時刻を確認')

    // 60秒間ブラウザを開いたままにする
    console.log('\n60秒間待機中...')
    await page.waitForTimeout(60000)

    // 最終スクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/manual-check-final.png',
      fullPage: true
    })

    console.log('\n確認完了')
  })
})
