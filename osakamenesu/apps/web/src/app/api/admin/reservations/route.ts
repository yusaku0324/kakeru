import { NextResponse } from 'next/server'

const ADMIN_KEY = process.env.ADMIN_API_KEY || process.env.OSAKAMENESU_ADMIN_API_KEY
const PUBLIC_BASE = process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE || process.env.NEXT_PUBLIC_API_BASE || '/api'
const INTERNAL_BASE = process.env.OSAKAMENESU_API_INTERNAL_BASE || process.env.API_INTERNAL_BASE || 'http://osakamenesu-api:8000'

if (!ADMIN_KEY) {
  console.warn('[api/admin/reservations] ADMIN_API_KEY (or OSAKAMENESU_ADMIN_API_KEY) is not set; admin proxy requests will fail')
}

function bases() {
  return [INTERNAL_BASE, PUBLIC_BASE]
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const query = url.search
  const headers: Record<string, string> = {
    'X-Admin-Key': ADMIN_KEY || '',
  }

  let lastError: any = null
  for (const base of bases()) {
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
