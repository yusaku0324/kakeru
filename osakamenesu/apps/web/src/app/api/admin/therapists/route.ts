import { NextRequest, NextResponse } from 'next/server'

import { ADMIN_KEY, adminBases, buildAdminHeaders } from '@/app/api/admin/client'

async function proxyGet(request: NextRequest) {
  if (!ADMIN_KEY) {
    return NextResponse.json({ detail: 'admin key not configured' }, { status: 500 })
  }

  const url = new URL(request.url)
  const shopId = url.searchParams.get('shop_id')
  const page = url.searchParams.get('page')
  const pageSize = url.searchParams.get('page_size')

  const params = new URLSearchParams()
  if (shopId) params.set('shop_id', shopId)
  if (page) params.set('page', page)
  if (pageSize) params.set('page_size', pageSize)

  const queryString = params.toString()
  const targetPath = `/api/admin/therapists${queryString ? `?${queryString}` : ''}`
  const headers = buildAdminHeaders()

  for (const base of adminBases()) {
    try {
      const resp = await fetch(`${base}${targetPath}`, {
        method: 'GET',
        headers,
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
  return NextResponse.json({ detail: 'therapists unavailable' }, { status: 503 })
}

export async function GET(request: NextRequest) {
  return proxyGet(request)
}
