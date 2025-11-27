import { NextResponse, type NextRequest } from 'next/server'

import { adminBases, buildAdminHeaders } from '@/app/api/admin/client'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ detail: 'invalid JSON body' }, { status: 400 })
  }

  const headers = buildAdminHeaders({ 'Content-Type': 'application/json' })
  const body = JSON.stringify(payload)

  let lastError: any = null
  for (const base of adminBases()) {
    try {
      const resp = await fetch(`${base}/api/admin/guest_reservations/${id}/status`, {
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
  return NextResponse.json({ detail: 'admin guest reservation status unavailable' }, { status: 503 })
}
