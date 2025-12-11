import { NextRequest, NextResponse } from 'next/server'

import { ADMIN_KEY, adminBases, buildAdminHeaders } from '@/app/api/admin/client'

async function proxy(method: 'GET' | 'PATCH', request: NextRequest, params: { id: string }) {
  if (!ADMIN_KEY) {
    return NextResponse.json({ detail: 'admin key not configured' }, { status: 500 })
  }
  const headers: Record<string, string> = buildAdminHeaders()
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
  const targetPath =
    method === 'PATCH' ? `/api/admin/shops/${params.id}/content` : `/api/admin/shops/${params.id}`

  for (const base of adminBases()) {
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
  if (lastError?.status && lastError.body) {
    return NextResponse.json(lastError.body, { status: lastError.status })
  }
  return NextResponse.json({ detail: 'admin shop unavailable' }, { status: 503 })
}

type RouteContext = { params: Promise<{ id: string }> }

async function resolveParams(context: RouteContext) {
  const params = await context.params
  if (!params || !params.id) {
    throw new Error('missing shop id in route params')
  }
  return params
}

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await resolveParams(context)
  return proxy('GET', request, params)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const params = await resolveParams(context)
  return proxy('PATCH', request, params)
}
