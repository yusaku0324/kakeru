import { NextRequest, NextResponse } from 'next/server'

import { ADMIN_KEY, adminBases, buildAdminHeaders } from '@/app/api/admin/client'

type RouteContext = { params: Promise<{ id: string }> }

async function proxyPatch(shopId: string, request: NextRequest) {
  if (!ADMIN_KEY) {
    return NextResponse.json({ detail: 'admin key not configured' }, { status: 500 })
  }

  let body: string
  try {
    body = JSON.stringify(await request.json())
  } catch {
    return NextResponse.json({ detail: 'invalid JSON body' }, { status: 400 })
  }

  const targetPath = `/api/admin/shops/${shopId}/buffer`
  const headers = buildAdminHeaders({ 'Content-Type': 'application/json' })

  for (const base of adminBases()) {
    try {
      const resp = await fetch(`${base}${targetPath}`, {
        method: 'PATCH',
        headers,
        body,
        cache: 'no-store',
      })
      const text = await resp.text()
      let json: unknown = null
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
      if (resp.status !== 502 && resp.status !== 503) {
        return NextResponse.json(json, { status: resp.status })
      }
    } catch {
      // try next base
    }
  }
  return NextResponse.json({ detail: 'shop buffer unavailable' }, { status: 503 })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  return proxyPatch(id, request)
}
