import { NextRequest } from 'next/server'

import { resolveInternalApiBase } from '@/lib/server-config'

// Force Node.js runtime instead of Edge
export const runtime = 'nodejs'

const normalizeBase = (base: string) => base.replace(/\/+$/, '')

type RouteContext = { params: Promise<{ proxy?: string[] }> }

async function forward(request: NextRequest, context: RouteContext) {
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

  // Read body as text for JSON responses, or arrayBuffer for binary
  const contentType = response.headers.get('content-type') || ''
  let responseBody: BodyInit

  if (contentType.includes('application/json')) {
    const text = await response.text()
    console.log('[Dashboard API proxy] JSON body length:', text.length)
    responseBody = text
  } else {
    const buffer = await response.arrayBuffer()
    console.log('[Dashboard API proxy] binary body size:', buffer.byteLength)
    responseBody = buffer
  }

  // Use native Response instead of NextResponse to avoid potential issues
  return new Response(responseBody, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
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
