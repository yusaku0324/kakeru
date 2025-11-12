import { NextResponse, type NextRequest } from 'next/server'

const ADMIN_KEY = process.env.ADMIN_API_KEY || process.env.OSAKAMENESU_ADMIN_API_KEY
const PUBLIC_BASE = process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE || process.env.NEXT_PUBLIC_API_BASE || '/api'
const INTERNAL_BASE = process.env.OSAKAMENESU_API_INTERNAL_BASE || process.env.API_INTERNAL_BASE || 'http://osakamenesu-api:8000'

function bases() {
  return [INTERNAL_BASE, PUBLIC_BASE]
}

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
  const headers = {
    'Content-Type': 'application/json',
    'X-Admin-Key': ADMIN_KEY,
  }

  let lastError: any = null
  for (const base of bases()) {
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
