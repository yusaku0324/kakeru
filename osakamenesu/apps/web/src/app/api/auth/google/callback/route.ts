import { NextRequest, NextResponse } from 'next/server'

import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf.server'
import { withErrorReporting } from '@/lib/monitoring'
import { SITE_SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/session'

const API_BASE = process.env.OSAKAMENESU_API_BASE || 'http://localhost:8000'

/**
 * Google OAuth Callback Handler
 *
 * GoogleからのOAuthコールバックを処理し、バックエンドAPIにcode/stateを転送。
 * バックエンドがセッショントークンを返したら、クッキーに設定してリダイレクト。
 */
async function getHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // エラーがあればエラーページにリダイレクト
  if (error) {
    console.error('Google OAuth error:', error, errorDescription)
    const errorUrl = new URL('/therapist?error=google_auth_failed', request.url)
    return NextResponse.redirect(errorUrl)
  }

  // codeとstateが必須
  if (!code || !state) {
    console.error('Missing code or state in Google callback')
    const errorUrl = new URL('/therapist?error=missing_params', request.url)
    return NextResponse.redirect(errorUrl)
  }

  try {
    // バックエンドAPIにcodeとstateを送信
    const response = await fetch(`${API_BASE}/api/auth/google/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, state }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Backend Google callback failed:', response.status, errorData)
      const errorUrl = new URL('/therapist?error=auth_failed', request.url)
      return NextResponse.redirect(errorUrl)
    }

    const data = await response.json()

    // クッキーからリダイレクト先を取得（デフォルトは/therapist/settings）
    const redirectCookie = request.cookies.get('google_oauth_redirect')
    const redirectPath = redirectCookie?.value
      ? decodeURIComponent(redirectCookie.value)
      : '/therapist/settings'
    const redirectUrl = new URL(redirectPath, request.url)

    const redirectResponse = NextResponse.redirect(redirectUrl)

    // バックエンドからのセッショントークンをクッキーに設定
    if (data.session_token) {
      const cookieOptions = sessionCookieOptions()
      redirectResponse.cookies.set(SITE_SESSION_COOKIE_NAME, data.session_token, cookieOptions)
    }

    // CSRFトークンを生成
    const csrfToken = generateCsrfToken()
    setCsrfCookie(redirectResponse, csrfToken)

    // リダイレクトクッキーを削除
    redirectResponse.cookies.delete('google_oauth_redirect')

    return redirectResponse
  } catch (err) {
    console.error('Google callback error:', err)
    const errorUrl = new URL('/therapist?error=callback_error', request.url)
    return NextResponse.redirect(errorUrl)
  }
}

export const GET = withErrorReporting(getHandler, {
  route: 'api/auth/google/callback',
  method: 'GET',
})
