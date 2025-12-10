import { NextRequest, NextResponse } from 'next/server'

import { withErrorReporting } from '@/lib/monitoring'

const API_BASE = process.env.OSAKAMENESU_API_BASE || 'http://localhost:8000'

/**
 * Google OAuth Login URL API
 *
 * バックエンドAPIからGoogle認可URLを取得してフロントエンドに返す。
 * CORSを避けるためのプロキシエンドポイント。
 *
 * 現在のホストからcallback_urlを動的に生成し、バックエンドに渡す。
 * これにより、どのVercelデプロイメントからでも正しいコールバックURLが使用される。
 */
async function postHandler(request: NextRequest) {
  try {
    const body = await request.json()

    // 現在のリクエストのホストからcallback_urlを生成
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    const callbackUrl = `${protocol}://${host}/api/auth/google/callback`

    const response = await fetch(`${API_BASE}/api/auth/google/login-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        callback_url: callbackUrl,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { detail: errorData.detail || 'Failed to get Google login URL' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Google login-url error:', err)
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const POST = withErrorReporting(postHandler, {
  route: 'api/auth/google/login-url',
  method: 'POST',
})
