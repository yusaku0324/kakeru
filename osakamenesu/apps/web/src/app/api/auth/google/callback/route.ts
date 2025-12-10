import { NextRequest, NextResponse } from 'next/server'

import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf.server'
import { withErrorReporting } from '@/lib/monitoring'
import {
  DASHBOARD_SESSION_COOKIE_NAME,
  SITE_SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '@/lib/session'

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

  // リダイレクト先をクッキーから取得（デフォルトは/dashboard）
  const redirectCookie = request.cookies.get('google_oauth_redirect')
  const redirectPath = redirectCookie?.value
    ? decodeURIComponent(redirectCookie.value)
    : '/dashboard'
  // エラーページのベースパスを決定（/dashboard/* なら /dashboard、それ以外は /therapist）
  const errorBasePath = redirectPath.startsWith('/dashboard') ? '/dashboard' : '/therapist'

  // エラーがあればエラーページにリダイレクト
  if (error) {
    console.error('Google OAuth error:', error, errorDescription)
    const errorUrl = new URL(`${errorBasePath}?error=google_auth_failed`, request.url)
    return NextResponse.redirect(errorUrl)
  }

  // codeとstateが必須
  if (!code || !state) {
    console.error('Missing code or state in Google callback')
    const errorUrl = new URL(`${errorBasePath}?error=missing_params`, request.url)
    return NextResponse.redirect(errorUrl)
  }

  try {
    // 現在のリクエストのホストからcallback_urlを生成
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    const callbackUrl = `${protocol}://${host}/api/auth/google/callback`

    // redirect_pathからscopeを決定（/dashboard* はdashboard、それ以外はsite）
    const scope = redirectPath.startsWith('/dashboard') ? 'dashboard' : 'site'

    // バックエンドAPIにcodeとstateとcallback_urlとscopeを送信
    const response = await fetch(`${API_BASE}/api/auth/google/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, state, callback_url: callbackUrl, scope }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Backend Google callback failed:', response.status, errorData)
      const errorUrl = new URL(`${errorBasePath}?error=auth_failed`, request.url)
      return NextResponse.redirect(errorUrl)
    }

    const data = await response.json()

    // 成功時のリダイレクト先（上で取得済みのredirectPathを使用）
    const redirectUrl = new URL(redirectPath, request.url)

    const redirectResponse = NextResponse.redirect(redirectUrl)

    // バックエンドからのセッショントークンをクッキーに設定（scopeに基づいて適切なクッキー名を使用）
    if (data.session_token) {
      const cookieOptions = sessionCookieOptions()
      const cookieName =
        scope === 'dashboard' ? DASHBOARD_SESSION_COOKIE_NAME : SITE_SESSION_COOKIE_NAME
      redirectResponse.cookies.set(cookieName, data.session_token, cookieOptions)
    }

    // CSRFトークンを生成
    const csrfToken = generateCsrfToken()
    setCsrfCookie(redirectResponse, csrfToken)

    // リダイレクトクッキーを削除
    redirectResponse.cookies.delete('google_oauth_redirect')

    return redirectResponse
  } catch (err) {
    console.error('Google callback error:', err)
    const errorUrl = new URL(`${errorBasePath}?error=callback_error`, request.url)
    return NextResponse.redirect(errorUrl)
  }
}

export const GET = withErrorReporting(getHandler, {
  route: 'api/auth/google/callback',
  method: 'GET',
})
