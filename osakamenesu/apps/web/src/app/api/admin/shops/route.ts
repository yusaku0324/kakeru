import { NextResponse } from 'next/server'

import { ADMIN_KEY, adminBases, buildAdminHeaders } from '@/app/api/admin/client'

export async function GET() {
  if (!ADMIN_KEY) {
    return NextResponse.json({ detail: 'admin key not configured' }, { status: 500 })
  }
  const headers = buildAdminHeaders()
  let lastError: any = null
  for (const base of adminBases()) {
    try {
      const resp = await fetch(`${base}/api/admin/shops`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      })
      const text = await resp.text()
      let json: any = null
      if (text) {
        try {
          json = JSON.parse(text)
        } catch {
          json = { detail: text }
        }
      }
      if (resp.ok) {
        return NextResponse.json(json)
      }
      lastError = { status: resp.status, body: json }
    } catch (err) {
      lastError = err
    }
  }
  if (lastError?.status && lastError.body) {
    return NextResponse.json(lastError.body, { status: lastError.status })
  }
  return NextResponse.json({ detail: 'admin shops unavailable' }, { status: 503 })
}

export async function POST(request: Request) {
  if (!ADMIN_KEY) {
    return NextResponse.json({ detail: 'admin key not configured' }, { status: 500 })
  }

  let body: string
  try {
    body = JSON.stringify(await request.json())
  } catch {
    return NextResponse.json({ detail: 'invalid JSON body' }, { status: 400 })
  }

  const headers = buildAdminHeaders({ 'Content-Type': 'application/json' })

  let lastError: any = null
  for (const base of adminBases()) {
    try {
      const resp = await fetch(`${base}/api/admin/profiles?skip_index=1`, {
        method: 'POST',
        headers,
        body,
        cache: 'no-store',
      })
      const text = await resp.text()
      let json: any = null
      if (text) {
        try {
          json = JSON.parse(text)
        } catch {
          json = { detail: text }
        }
      }
      if (resp.ok) {
        return NextResponse.json(json)
      }
      lastError = { status: resp.status, body: json }
    } catch (err) {
      lastError = err
    }
  }

  if (lastError?.status && lastError.body) {
    return NextResponse.json(lastError.body, { status: lastError.status })
  }

  return NextResponse.json({ detail: 'admin shop create failed' }, { status: 503 })
}
