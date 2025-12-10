#!/usr/bin/env node
/**
 * Google OAuth Debug Script
 *
 * Playwrightを使ってGoogle OAuthフローをデバッグします。
 * redirect_uriが正しく設定されているかを確認します。
 */

import { chromium } from 'playwright'

const BASE_URL = process.env.E2E_BASE_URL || 'https://osakamenesu-web.vercel.app'

async function main() {
  console.log('=== Google OAuth Debug Script ===')
  console.log('Base URL:', BASE_URL)
  console.log('')

  // 1. API直接テスト
  console.log('--- Test 1: Direct API Call ---')
  try {
    const response = await fetch(`${BASE_URL}/api/auth/google/login-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redirect_path: '/dashboard' }),
    })

    if (response.status === 429) {
      console.log('Rate limited - waiting 60 seconds...')
      await new Promise(resolve => setTimeout(resolve, 60000))
      // Retry
      const retryResponse = await fetch(`${BASE_URL}/api/auth/google/login-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirect_path: '/dashboard' }),
      })
      const data = await retryResponse.json()
      analyzeResponse(data)
    } else {
      const data = await response.json()
      analyzeResponse(data)
    }
  } catch (error) {
    console.error('API Error:', error.message)
  }

  // 2. ブラウザテスト
  console.log('')
  console.log('--- Test 2: Browser Click Test ---')

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  // コンソールログをキャプチャ
  page.on('console', msg => {
    console.log(`[Browser Console ${msg.type()}]:`, msg.text())
  })

  // ネットワークリクエストをキャプチャ
  page.on('request', request => {
    if (request.url().includes('google') || request.url().includes('login-url')) {
      console.log(`[Request]: ${request.method()} ${request.url()}`)
    }
  })

  page.on('response', response => {
    if (response.url().includes('google') || response.url().includes('login-url')) {
      console.log(`[Response]: ${response.status()} ${response.url()}`)
    }
  })

  // エラーをキャプチャ
  page.on('pageerror', error => {
    console.log(`[Page Error]:`, error.message)
  })

  try {
    // ログインページに移動
    console.log(`Navigating to ${BASE_URL}/dashboard/login`)
    await page.goto(`${BASE_URL}/dashboard/login`)
    await page.waitForLoadState('networkidle')

    console.log('Current URL:', page.url())

    // Googleボタンを探す
    const googleButton = page.locator('button:has-text("Google"), a:has-text("Google"), [data-provider="google"]')
    const buttonCount = await googleButton.count()
    console.log('Google button count:', buttonCount)

    if (buttonCount === 0) {
      console.log('Google button not found!')
      console.log('Looking for any buttons...')
      const allButtons = await page.locator('button').allTextContents()
      console.log('All buttons:', allButtons)

      // ページのスクリーンショットを保存
      await page.screenshot({ path: 'login-page.png', fullPage: true })
      console.log('Screenshot saved to login-page.png')
    } else {
      // ボタンをクリック
      console.log('Clicking Google button...')
      await googleButton.first().click()

      // API呼び出しとリダイレクトを待つ
      console.log('Waiting for API call and redirect...')
      await page.waitForTimeout(5000)  // 5秒待つ

      // Googleページに遷移するまで待つ
      await page.waitForURL(/accounts\.google\.com/, { timeout: 15000 }).catch((e) => {
        console.log('waitForURL catch:', e.message)
      })

      const currentUrl = page.url()
      console.log('')
      console.log('=== After Click ===')
      console.log('Current URL:', currentUrl)

      if (currentUrl.includes('accounts.google.com')) {
        const url = new URL(currentUrl)
        console.log('')
        console.log('=== Google OAuth Parameters ===')
        console.log('redirect_uri:', url.searchParams.get('redirect_uri'))
        console.log('client_id:', url.searchParams.get('client_id'))
        console.log('state:', url.searchParams.get('state'))
        console.log('scope:', url.searchParams.get('scope'))

        const redirectUri = url.searchParams.get('redirect_uri')
        if (redirectUri) {
          console.log('')
          if (redirectUri === 'https://osakamenesu-web.vercel.app/api/auth/google/callback') {
            console.log('✅ redirect_uri is CORRECT!')
          } else {
            console.log('❌ redirect_uri MISMATCH!')
            console.log('Expected: https://osakamenesu-web.vercel.app/api/auth/google/callback')
            console.log('Got:', redirectUri)
          }
        }

        // エラーページかどうか確認
        const pageContent = await page.content()
        if (pageContent.includes('redirect_uri_mismatch') || pageContent.includes('Error 400')) {
          console.log('')
          console.log('=== ERROR DETECTED ===')
          await page.screenshot({ path: 'google-oauth-error.png', fullPage: true })
          console.log('Error screenshot saved to google-oauth-error.png')

          // エラーメッセージを探す
          const errorText = await page.locator('body').textContent()
          if (errorText.includes('redirect_uri')) {
            const match = errorText.match(/redirect_uri[^}]*/i)
            if (match) {
              console.log('Error context:', match[0].slice(0, 200))
            }
          }
        }
      }
    }

    // ユーザーが確認できるように少し待つ
    console.log('')
    console.log('Waiting 10 seconds for manual inspection...')
    await new Promise(resolve => setTimeout(resolve, 10000))

  } catch (error) {
    console.error('Browser test error:', error.message)
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true })
    console.log('Error screenshot saved to error-screenshot.png')
  } finally {
    await browser.close()
  }
}

function analyzeResponse(data) {
  console.log('Response:', JSON.stringify(data, null, 2))

  if (data.login_url) {
    const url = new URL(data.login_url)
    const redirectUri = url.searchParams.get('redirect_uri')

    console.log('')
    console.log('=== OAuth URL Analysis ===')
    console.log('redirect_uri:', redirectUri)
    console.log('client_id:', url.searchParams.get('client_id'))

    if (redirectUri === 'https://osakamenesu-web.vercel.app/api/auth/google/callback') {
      console.log('')
      console.log('✅ redirect_uri is CORRECT!')
    } else {
      console.log('')
      console.log('❌ redirect_uri MISMATCH!')
      console.log('Expected: https://osakamenesu-web.vercel.app/api/auth/google/callback')
    }
  }
}

main().catch(console.error)
