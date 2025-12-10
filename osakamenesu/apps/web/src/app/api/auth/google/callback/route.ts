import { NextRequest, NextResponse } from 'next/server'

import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf.server'
import { withErrorReporting } from '@/lib/monitoring'

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

    // バックエンドからSet-Cookieヘッダーを取得
    // バックエンドがセッションクッキーを設定している場合は、そのまま転送
    const setCookieHeader = response.headers.get('set-cookie')

    // 成功時はセラピスト設定ページにリダイレクト
    // デフォルトリダイレクト先
    const redirectPath = '/therapist/settings'
    const redirectUrl = new URL(redirectPath, request.url)

    const redirectResponse = NextResponse.redirect(redirectUrl)

    // バックエンドからのセッショントークンがあればクッキーに設定
    // (バックエンドのレスポンスボディにセッション情報がある場合)
    if (setCookieHeader) {
      // バックエンドからのSet-Cookieをそのまま転送
      redirectResponse.headers.append('Set-Cookie', setCookieHeader)
    }

    // CSRFトークンを生成
    const csrfToken = generateCsrfToken()
    setCsrfCookie(redirectResponse, csrfToken)

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
