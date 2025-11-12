import { NextResponse, type NextRequest } from 'next/server'

const ADMIN_KEY = process.env.ADMIN_API_KEY || process.env.OSAKAMENESU_ADMIN_API_KEY
const PUBLIC_BASE = process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE || process.env.NEXT_PUBLIC_API_BASE || '/api'
const INTERNAL_BASE = process.env.OSAKAMENESU_API_INTERNAL_BASE || process.env.API_INTERNAL_BASE || 'http://osakamenesu-api:8000'

function bases() {
  return [INTERNAL_BASE, PUBLIC_BASE]
}

async function proxyAdminRequest(input: Request, params: { id: string }, init: RequestInit & { method: string }) {
  if (!ADMIN_KEY) {
    return NextResponse.json({ detail: 'admin key not configured' }, { status: 500 })
  }

  const headers = new Headers(init.headers || {})
  headers.set('X-Admin-Key', ADMIN_KEY)

  const url = new URL(input.url)
  const search = url.search ? url.search : ''

  let lastError: any = null
  for (const base of bases()) {
    try {
      const resp = await fetch(`${base}/api/admin/shops/${params.id}/availability${search}`, {
        ...init,
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

  return NextResponse.json({ detail: 'admin availability request failed' }, { status: 503 })
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return proxyAdminRequest(request, { id }, { method: 'GET' })
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  let body: string
  try {
    body = JSON.stringify(await request.json())
  } catch {
    return NextResponse.json({ detail: 'invalid JSON body' }, { status: 400 })
  }
  return proxyAdminRequest(request, { id }, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}
