import { NextRequest, NextResponse } from 'next/server'

const INTERNAL_API_BASE =
  process.env.OSAKAMENESU_API_INTERNAL_BASE ||
  process.env.API_INTERNAL_BASE ||
  process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://osakamenesu-api:8000'

const normalizeBase = (base: string) => base.replace(/\/$/, '')

type RouteContext = { params: Promise<{ proxy?: string[] }> }

async function forward(request: NextRequest, context: RouteContext) {
  const params = await context.params
  const proxySegments = params.proxy ?? []
  const targetPath = proxySegments.join('/')
  const base = normalizeBase(INTERNAL_API_BASE)
  const targetUrl = `${base}/api/dashboard/${targetPath}${request.nextUrl.search}`

  const headers = new Headers(request.headers)
  const cookieHeader = request.headers.get('cookie') ?? ''
  headers.set('cookie', cookieHeader)
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
    if (key.toLowerCase() === 'set-cookie') {
      responseHeaders.append('set-cookie', value)
    } else {
      responseHeaders.set(key, value)
    }
  })

  const proxyResponse = new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  })

  return proxyResponse
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
