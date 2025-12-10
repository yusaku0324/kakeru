import { NextRequest, NextResponse } from 'next/server'

import { withErrorReporting } from '@/lib/monitoring'

const API_BASE = process.env.OSAKAMENESU_API_BASE || 'http://localhost:8000'

/**
 * LINE OAuth Login URL API
 *
 * バックエンドAPIからLINE認可URLを取得してフロントエンドに返す。
 * CORSを避けるためのプロキシエンドポイント。
 */
async function postHandler(request: NextRequest) {
  try {
    const body = await request.json()

    const response = await fetch(`${API_BASE}/api/auth/line/login-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { detail: errorData.detail || 'Failed to get LINE login URL' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('LINE login-url error:', err)
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const POST = withErrorReporting(postHandler, {
  route: 'api/auth/line/login-url',
  method: 'POST',
})
