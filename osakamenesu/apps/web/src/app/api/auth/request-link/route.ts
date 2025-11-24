import { NextRequest, NextResponse } from 'next/server'

import { resolveInternalApiBase } from '@/lib/server-config'

function ensureApiBase(): string {
  return resolveInternalApiBase().replace(/\/+$/, '')
}

function buildBackendUrl(path: string): string {
  const base = ensureApiBase()
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}

function stripAdminHeaders(headers: Headers): Headers {
  const sanitized = new Headers(headers)
  sanitized.delete('authorization')
  sanitized.delete('Authorization')
  sanitized.delete('x-admin-key')
  sanitized.delete('X-Admin-Key')
  return sanitized
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text()
  const incomingHeaders = stripAdminHeaders(request.headers)
  const headers = new Headers()

  if (incomingHeaders.get('content-type')) {
    headers.set('content-type', incomingHeaders.get('content-type') as string)
  }
  if (incomingHeaders.get('cookie')) {
    headers.set('cookie', incomingHeaders.get('cookie') as string)
  }
  headers.set('accept', incomingHeaders.get('accept') ?? 'application/json')

  const backendResponse = await fetch(buildBackendUrl('/api/auth/request-link'), {
    method: 'POST',
    body,
    headers,
    cache: 'no-store',
    redirect: 'manual',
  })

  const responseHeaders = new Headers(backendResponse.headers)
  const buffer = await backendResponse.arrayBuffer()

  return new NextResponse(buffer, {
    status: backendResponse.status,
    headers: responseHeaders,
  })
}
