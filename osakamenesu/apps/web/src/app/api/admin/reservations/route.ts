import { NextResponse } from 'next/server'

import { ADMIN_KEY, adminBases, buildAdminHeaders } from '@/app/api/admin/client'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const query = url.search
  const headers = buildAdminHeaders()

  let lastError: any = null
  for (const base of adminBases()) {
    try {
      const resp = await fetch(`${base}/api/admin/reservations${query}`, {
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
  return NextResponse.json({ detail: 'admin reservations unavailable' }, { status: 503 })
}
