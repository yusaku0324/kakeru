import { NextResponse } from 'next/server'

const ADMIN_KEY = process.env.ADMIN_API_KEY || process.env.OSAKAMENESU_ADMIN_API_KEY
const PUBLIC_BASE = process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE || process.env.NEXT_PUBLIC_API_BASE || '/api'
const INTERNAL_BASE = process.env.OSAKAMENESU_API_INTERNAL_BASE || process.env.API_INTERNAL_BASE || 'http://osakamenesu-api:8000'

function bases() {
  return [INTERNAL_BASE, PUBLIC_BASE]
}

async function proxy(method: 'GET' | 'PATCH', request: Request, params: { id: string }) {
  if (!ADMIN_KEY) {
    return NextResponse.json({ detail: 'admin key not configured' }, { status: 500 })
  }
  const headers: Record<string, string> = {
    'X-Admin-Key': ADMIN_KEY,
  }
  let body: string | undefined
  if (method === 'PATCH') {
    try {
      body = JSON.stringify(await request.json())
    } catch {
      return NextResponse.json({ detail: 'invalid JSON body' }, { status: 400 })
    }
    headers['Content-Type'] = 'application/json'
  }

  let lastError: any = null
  const targetPaths =
    method === 'PATCH'
      ? [`/api/admin/shops/${params.id}`, `/api/admin/shops/${params.id}/content`]
      : [`/api/admin/shops/${params.id}`]

  for (const targetPath of targetPaths) {
    for (const base of bases()) {
      try {
        const resp = await fetch(`${base}${targetPath}`, {
          method,
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
  }
  if (lastError?.status && lastError.body) {
    return NextResponse.json(lastError.body, { status: lastError.status })
  }
  return NextResponse.json({ detail: 'admin shop unavailable' }, { status: 503 })
}

export async function GET(request: Request, context: { params: { id: string } }) {
  return proxy('GET', request, context.params)
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  return proxy('PATCH', request, context.params)
}
