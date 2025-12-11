import { NextRequest, NextResponse } from 'next/server'

import { ADMIN_KEY, adminBases, buildAdminHeaders } from '@/app/api/admin/client'

async function proxyGet(request: NextRequest) {
  if (!ADMIN_KEY) {
    return NextResponse.json({ detail: 'admin key not configured' }, { status: 500 })
  }

  const url = new URL(request.url)
  const therapistId = url.searchParams.get('therapist_id')
  const date = url.searchParams.get('date')

  if (!therapistId) {
    return NextResponse.json({ detail: 'therapist_id is required' }, { status: 400 })
  }

  const params = new URLSearchParams()
  params.set('therapist_id', therapistId)
  if (date) params.set('date', date)

  const targetPath = `/api/admin/therapist_shifts?${params.toString()}`
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
  return NextResponse.json({ detail: 'therapist shifts unavailable' }, { status: 503 })
}

async function proxyPost(request: NextRequest) {
  if (!ADMIN_KEY) {
    return NextResponse.json({ detail: 'admin key not configured' }, { status: 500 })
  }

  let body: string
  try {
    body = JSON.stringify(await request.json())
  } catch {
    return NextResponse.json({ detail: 'invalid JSON body' }, { status: 400 })
  }

  const targetPath = '/api/admin/therapist_shifts'
  const headers = buildAdminHeaders({ 'Content-Type': 'application/json' })

  for (const base of adminBases()) {
    try {
      const resp = await fetch(`${base}${targetPath}`, {
        method: 'POST',
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
        return NextResponse.json(json, { status: resp.status })
      }
      if (resp.status !== 502 && resp.status !== 503) {
        return NextResponse.json(json, { status: resp.status })
      }
    } catch {
      // try next base
    }
  }
  return NextResponse.json({ detail: 'therapist shifts unavailable' }, { status: 503 })
}

export async function GET(request: NextRequest) {
  return proxyGet(request)
}

export async function POST(request: NextRequest) {
  return proxyPost(request)
}
