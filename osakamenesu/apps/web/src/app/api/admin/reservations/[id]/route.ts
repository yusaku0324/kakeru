import { NextResponse, type NextRequest } from 'next/server'

import { ADMIN_KEY, adminBases, buildAdminHeaders } from '@/app/api/admin/client'

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!ADMIN_KEY) {
    return NextResponse.json({ detail: 'admin key not configured' }, { status: 500 })
  }
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ detail: 'invalid JSON body' }, { status: 400 })
  }

  const body = JSON.stringify(payload)
  const headers = buildAdminHeaders({ 'Content-Type': 'application/json' })

  let lastError: any = null
  for (const base of adminBases()) {
    try {
      const resp = await fetch(`${base}/api/admin/reservations/${id}`, {
        method: 'PATCH',
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

  return NextResponse.json({ detail: 'admin reservations unavailable' }, { status: 503 })
}
