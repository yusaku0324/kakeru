import { NextRequest, NextResponse } from 'next/server'

import { resolveInternalApiBase } from '@/lib/server-config'

const API_BASE = resolveInternalApiBase().replace(/\/+$, '')

async function proxyAvailabilitySummary(request: NextRequest, therapistId: string) {
  const search = new URL(request.url).search
  try {
    const resp = await fetch(
      `${API_BASE}/api/guest/therapists/${therapistId}/availability_summary${search}`,
      { method: 'GET', cache: 'no-store' },
    )
    const text = await resp.text()
    let json: any = null
    if (text) {
      try {
        json = JSON.parse(text)
      } catch {
        json = { detail: text }
      }
    }
    return NextResponse.json(json, { status: resp.status })
  } catch (err) {
    return NextResponse.json({ detail: 'availability summary unavailable' }, { status: 503 })
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ therapistId: string }> }) {
  const { therapistId } = await context.params
  return proxyAvailabilitySummary(request, therapistId)
}
