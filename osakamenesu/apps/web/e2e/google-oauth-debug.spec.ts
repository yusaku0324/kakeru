import { test, expect } from '@playwright/test'

/**
 * Google OAuth Debug Test
 *
 * このテストはGoogle OAuthフローをデバッグするために使用します。
 * 実際のGoogleログインは行わず、redirect_uriの検証と
 * OAuthフローの初期段階を確認します。
 */

const BASE_URL = process.env.E2E_BASE_URL || 'https://osakamenesu-web.vercel.app'

test.describe('Google OAuth Debug', () => {
  test('login-url APIが正しいredirect_uriを返す', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/google/login-url`, {
      data: {
        redirect_path: '/dashboard',
      },
    })

    console.log('Response status:', response.status())

    if (response.status() === 429) {
      console.log('Rate limited - skipping test')
      test.skip()
      return
    }

    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    console.log('Response data:', JSON.stringify(data, null, 2))

    expect(data.login_url).toBeDefined()
    expect(data.state).toBeDefined()

    // URLをパースしてredirect_uriを抽出
    const loginUrl = new URL(data.login_url)
    const redirectUri = loginUrl.searchParams.get('redirect_uri')

    console.log('=== OAuth URL Analysis ===')
    console.log('Login URL host:', loginUrl.host)
    console.log('redirect_uri:', redirectUri)
    console.log('client_id:', loginUrl.searchParams.get('client_id'))
    console.log('state:', loginUrl.searchParams.get('state'))
    console.log('scope:', loginUrl.searchParams.get('scope'))

    // redirect_uriがosakamenesu-web.vercel.appを使用していることを確認
    expect(redirectUri).toContain('osakamenesu-web.vercel.app')
    expect(redirectUri).toBe('https://osakamenesu-web.vercel.app/api/auth/google/callback')
  })

  test('Googleログインボタンをクリックして遷移先URLを確認', async ({ page }) => {
    // dashboard/loginページに移動
    await page.goto(`${BASE_URL}/dashboard/login`)

    // ページが読み込まれるまで待つ
    await page.waitForLoadState('networkidle')

    console.log('=== Page loaded ===')
    console.log('Current URL:', page.url())

    // Googleログインボタンを探す
    const googleButton = page.locator('button:has-text("Google"), a:has-text("Google")')
    const buttonCount = await googleButton.count()
    console.log('Google button count:', buttonCount)

    if (buttonCount === 0) {
      console.log('Page HTML (first 2000 chars):')
      const html = await page.content()
      console.log(html.slice(0, 2000))
      test.skip()
      return
    }

    // ナビゲーションをキャプチャ
    const navigationPromise = page.waitForEvent('request', (request) => {
      return request.url().includes('accounts.google.com')
    })

    // ボタンをクリック
    await googleButton.first().click()

    // Googleへのリクエストをキャプチャ
    const googleRequest = await navigationPromise

    const googleUrl = new URL(googleRequest.url())
    const redirectUri = googleUrl.searchParams.get('redirect_uri')

    console.log('=== Google OAuth Request ===')
    console.log('Full URL:', googleRequest.url())
    console.log('redirect_uri:', redirectUri)
    console.log('client_id:', googleUrl.searchParams.get('client_id'))

    // redirect_uriを検証
    expect(redirectUri).toBe('https://osakamenesu-web.vercel.app/api/auth/google/callback')
  })

  test('redirect_uri_mismatchエラーの詳細をキャプチャ', async ({ page }) => {
    // dashboard/loginページに移動
    await page.goto(`${BASE_URL}/dashboard/login`)
    await page.waitForLoadState('networkidle')

    // Googleログインボタンを探す
    const googleButton = page.locator('button:has-text("Google"), a:has-text("Google")')
    const buttonCount = await googleButton.count()

    if (buttonCount === 0) {
      console.log('Google button not found - skipping')
      test.skip()
      return
    }

    // ボタンをクリックしてGoogleに遷移
    await googleButton.first().click()

    // Googleページに遷移するまで待つ
    await page.waitForURL(/accounts\.google\.com|error/, { timeout: 10000 }).catch(() => {})

    const currentUrl = page.url()
    console.log('=== Current URL after click ===')
    console.log(currentUrl)

    // エラーページかどうかをチェック
    if (currentUrl.includes('error') || currentUrl.includes('redirect_uri_mismatch')) {
      console.log('=== ERROR DETECTED ===')

      // ページの内容をキャプチャ
      const pageContent = await page.content()
      console.log('Page content (first 3000 chars):')
      console.log(pageContent.slice(0, 3000))

      // スクリーンショットを保存
      await page.screenshot({ path: 'google-oauth-error.png', fullPage: true })
      console.log('Screenshot saved to google-oauth-error.png')

      // URLからエラー情報を抽出
      const errorUrl = new URL(currentUrl)
      console.log('Error type:', errorUrl.searchParams.get('error'))
      console.log('Error description:', errorUrl.searchParams.get('error_description'))
    }

    // Googleの認証ページにいる場合
    if (currentUrl.includes('accounts.google.com')) {
      console.log('=== Google Auth Page ===')

      // URLをパース
      const authUrl = new URL(currentUrl)
      console.log('redirect_uri in URL:', authUrl.searchParams.get('redirect_uri'))

      // redirect_uri_mismatchエラーページの場合、ページ内のエラーメッセージを取得
      const errorText = await page.locator('text=redirect_uri').textContent().catch(() => null)
      if (errorText) {
        console.log('Error message on page:', errorText)
      }

      // エラーの詳細を探す
      const detailText = await page
        .locator('[data-error-code], .error-message, [class*="error"]')
        .allTextContents()
        .catch(() => [])
      if (detailText.length > 0) {
        console.log('Error details:', detailText)
      }
    }
  })

  test('直接login-url APIをテスト（ヘッダー情報付き）', async ({ request }) => {
    // hostヘッダーを明示的に設定してテスト
    const response = await request.post(`${BASE_URL}/api/auth/google/login-url`, {
      data: {
        redirect_path: '/dashboard',
      },
      headers: {
        Host: 'osakamenesu-web.vercel.app',
        'X-Forwarded-Proto': 'https',
      },
    })

    if (response.status() === 429) {
      console.log('Rate limited')
      test.skip()
      return
    }

    const data = await response.json()
    console.log('=== API Response with explicit headers ===')
    console.log(JSON.stringify(data, null, 2))

    if (data.login_url) {
      const url = new URL(data.login_url)
      console.log('redirect_uri:', url.searchParams.get('redirect_uri'))
    }
  })
})
