import { randomUUID } from 'crypto'
import { appendFile } from 'node:fs/promises'
import { NextRequest, NextResponse } from 'next/server'

import { ADMIN_KEY, adminBases, buildAdminHeaders } from '@/app/api/admin/client'

async function proxy(method: 'GET' | 'PATCH', request: NextRequest, params: { id: string }) {
  const requestLabel = `[admin-shops-bff:${method}:${params.id}:${randomUUID()}]`
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
  const targetPath = method === 'PATCH'
    ? `/api/admin/shops/${params.id}/content`
    : `/api/admin/shops/${params.id}`
  const requestStart = Date.now()
  const forwardPayload = {
    targetPath,
    body: method === 'PATCH' ? safelyLogBody(body) : undefined,
  }
  console.log(`${requestLabel} forwarding`, forwardPayload)
  // temporary instrumentation removed

  for (const base of adminBases()) {
    const hopStart = Date.now()
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
      const hopDuration = Date.now() - hopStart
      const responseInfo = {
        base,
        status: resp.status,
        durationMs: hopDuration,
      }
      console.log(`${requestLabel} response`, responseInfo)
      if (resp.ok) {
        const totalDuration = Date.now() - requestStart
        const successInfo = { durationMs: totalDuration }
        console.log(`${requestLabel} success`, successInfo)
        return NextResponse.json(json)
      }
      lastError = { status: resp.status, body: json }
    } catch (err) {
      console.error(`${requestLabel} fetch failed`, { base, error: String(err) })
      lastError = err
    }
  }
  const totalDuration = Date.now() - requestStart
  console.error(`${requestLabel} exhausted`, { durationMs: totalDuration, lastError })
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

function safelyLogBody(body?: string) {
  if (!body) return undefined
  try {
    const parsed = JSON.parse(body)
    return { ...parsed }
  } catch {
    return body
  }
}
