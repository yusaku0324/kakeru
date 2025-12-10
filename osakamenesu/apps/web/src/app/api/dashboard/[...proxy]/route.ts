import { NextRequest } from 'next/server'

import { resolveInternalApiBase } from '@/lib/server-config'

// Force Node.js runtime instead of Edge
export const runtime = 'nodejs'

const normalizeBase = (base: string) => base.replace(/\/+$/, '')

type RouteContext = { params: Promise<{ proxy?: string[] }> }

async function forward(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params
    const proxySegments = params.proxy ?? []
    const targetPath = proxySegments.join('/')
    const base = normalizeBase(resolveInternalApiBase())
    const targetUrl = `${base}/api/dashboard/${targetPath}${request.nextUrl.search}`

    const headers = new Headers(request.headers)
    const cookieHeader = request.headers.get('cookie') ?? ''
    headers.set('cookie', cookieHeader)
    // Avoid zstd encoding
    headers.set('accept-encoding', 'gzip, deflate, br')
    console.log('[Dashboard API proxy] forwarding', request.method, targetUrl, {
      hasCookie: Boolean(cookieHeader),
      base,
    })
    headers.set('x-forwarded-host', request.headers.get('host') ?? '')
    headers.set(
      'x-forwarded-proto',
      request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', ''),
    )

    const hasBody = !(request.method === 'GET' || request.method === 'HEAD')
    const body = hasBody ? await request.blob() : undefined

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    })
    console.log('[Dashboard API proxy] response', response.status, targetUrl)

    const responseHeaders = new Headers()
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase()
      if (lowerKey === 'set-cookie') {
        responseHeaders.append('set-cookie', value)
      } else if (lowerKey !== 'content-encoding' && lowerKey !== 'content-length' && lowerKey !== 'transfer-encoding') {
        // Skip encoding headers as we're reading the body fully
        responseHeaders.set(key, value)
      }
    })

    // Always read as text first, then convert if needed
    const text = await response.text()
    console.log('[Dashboard API proxy] body length:', text.length, 'chars')

    // Set content-length explicitly
    responseHeaders.set('content-length', String(Buffer.byteLength(text, 'utf-8')))

    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('[Dashboard API proxy] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: 'Proxy error', detail: errorMessage }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return forward(request, context)
}

export async function POST(request: NextRequest, context: RouteContext) {
  return forward(request, context)
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return forward(request, context)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return forward(request, context)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return forward(request, context)
}

export const dynamic = 'force-dynamic'
