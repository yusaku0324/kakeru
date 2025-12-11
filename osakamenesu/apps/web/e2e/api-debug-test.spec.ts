import { test, expect } from '@playwright/test'

test.describe('API レスポンスのデバッグ', () => {
  test('検索APIのセラピスト情報を確認', async ({ page }) => {
    console.log('=== 検索APIレスポンスのデバッグ ===')

    // APIレスポンスを監視
    const apiResponses: any[] = []

    page.on('response', async (response) => {
      if (response.url().includes('/api/v1/shops')) {
        const data = await response.json().catch(() => null)
        if (data) {
          apiResponses.push({
            url: response.url(),
            status: response.status(),
            data: data
          })
        }
      }
    })

    // 検索ページにアクセス
    await page.goto('https://osakamenesu-web.vercel.app/search?q=SSS')
    await page.waitForLoadState('networkidle')

    // レスポンスを解析
    console.log(`\nAPIコール数: ${apiResponses.length}`)

    for (const response of apiResponses) {
      console.log('\n=== API Response ===')
      console.log(`URL: ${response.url}`)
      console.log(`Status: ${response.status}`)

      if (response.data.hits || response.data.results) {
        const hits = response.data.hits || response.data.results
        console.log(`\n店舗数: ${hits.length}`)

        for (const hit of hits) {
          if (hit.name === 'SSS' || hit.slug === 'SSS') {
            console.log(`\n店舗: ${hit.name}`)
            console.log(`スタッフプレビュー数: ${hit.staff_preview?.length || 0}`)

            if (hit.staff_preview && hit.staff_preview.length > 0) {
              for (let i = 0; i < hit.staff_preview.length; i++) {
                const staff = hit.staff_preview[i]
                console.log(`\n  スタッフ ${i + 1}: ${staff.name}`)
                console.log(`    avatar_url: ${staff.avatar_url || 'null/undefined'}`)
                console.log(`    photo_urls: ${JSON.stringify(staff.photo_urls) || 'null/undefined'}`)
                console.log(`    next_available_at: ${staff.next_available_at || 'null/undefined'}`)
                console.log(`    next_available_slot: ${JSON.stringify(staff.next_available_slot) || 'null/undefined'}`)

                // 桃奈さんの情報を特に詳しくログ
                if (staff.name === '桃奈' || staff.name === 'ももな') {
                  console.log('\n  *** 桃奈さんの詳細情報 ***')
                  console.log(JSON.stringify(staff, null, 2))
                }
              }
            }
          }
        }
      }
    }

    // スクリーンショット保存
    await page.screenshot({
      path: 'e2e/screenshots/api-debug-search-result.png',
      fullPage: true
    })

    // 開発者ツールのネットワークタブを開いて確認できるように30秒待機
    console.log('\n30秒間ブラウザを開いたままにします。開発者ツールで詳細を確認してください。')
    await page.waitForTimeout(30000)
  })

  test('ダッシュボードAPIのセラピスト情報を確認', async ({ page }) => {
    console.log('\n=== ダッシュボードAPIのデバッグ ===')

    // ダッシュボードにアクセス（ログインが必要）
    await page.goto('http://localhost:3000/dashboard/login')

    console.log('手動でログインして、SSSの店舗を開いてください。')
    console.log('その後、シフト管理画面に移動してください。')

    // APIレスポンスを監視
    page.on('response', async (response) => {
      if (response.url().includes('/api/dashboard/shops/') && response.url().includes('/therapists')) {
        console.log(`\n=== Dashboard Therapist API ===`)
        console.log(`URL: ${response.url()}`)

        const data = await response.json().catch(() => null)
        if (data && data.therapists) {
          console.log(`セラピスト数: ${data.therapists.length}`)

          for (const therapist of data.therapists) {
            console.log(`\n  ${therapist.name}:`)
            console.log(`    photo_urls: ${JSON.stringify(therapist.photo_urls)}`)
            console.log(`    status: ${therapist.status}`)

            if (therapist.name === '桃奈') {
              console.log('\n  *** 桃奈さんのダッシュボード詳細 ***')
              console.log(JSON.stringify(therapist, null, 2))
            }
          }
        }
      }
    })

    // 60秒待機
    await page.waitForTimeout(60000)
  })
})
