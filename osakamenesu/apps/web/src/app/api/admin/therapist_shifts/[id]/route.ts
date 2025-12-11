import { NextRequest, NextResponse } from 'next/server'

import { ADMIN_KEY, adminBases, buildAdminHeaders } from '@/app/api/admin/client'

type RouteContext = { params: Promise<{ id: string }> }

async function proxyDelete(shiftId: string) {
  if (!ADMIN_KEY) {
    return NextResponse.json({ detail: 'admin key not configured' }, { status: 500 })
  }

  const targetPath = `/api/admin/therapist_shifts/${shiftId}`
  const headers = buildAdminHeaders()

  for (const base of adminBases()) {
    try {
      const resp = await fetch(`${base}${targetPath}`, {
        method: 'DELETE',
        headers,
        cache: 'no-store',
      })
      if (resp.ok || resp.status === 204) {
        return new NextResponse(null, { status: 204 })
      }
      const text = await resp.text()
      let json: unknown = null
      if (text) {
        try {
          json = JSON.parse(text)
        } catch {
          json = { detail: text }
        }
      }
      if (resp.status !== 502 && resp.status !== 503) {
        return NextResponse.json(json, { status: resp.status })
      }
    } catch {
      // try next base
    }
  }
  return NextResponse.json({ detail: 'therapist shift unavailable' }, { status: 503 })
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  return proxyDelete(id)
}
