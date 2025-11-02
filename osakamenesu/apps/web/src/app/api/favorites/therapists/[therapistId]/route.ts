import { NextRequest, NextResponse } from 'next/server'

const API_BASE =
  process.env.OSAKAMENESU_API_INTERNAL_BASE ||
  process.env.API_INTERNAL_BASE ||
  process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE

function ensureApiBase(): string {
  if (!API_BASE) {
    throw new Error('API base URL is not configured for favorites proxy')
  }
  return API_BASE.replace(/\/+$/, '')
}

function buildBackendUrl(path: string): string {
  const base = ensureApiBase()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalizedPath}`
}

async function forwardDelete(
  req: NextRequest,
  therapistId: string,
): Promise<NextResponse> {
  const url = buildBackendUrl(`/api/favorites/therapists/${encodeURIComponent(therapistId)}`)
  const headers = new Headers()

  if (req.headers.get('cookie')) {
    headers.set('cookie', req.headers.get('cookie') as string)
  }

  const response = await fetch(url, {
    method: 'DELETE',
    headers,
    redirect: 'manual',
    cache: 'no-store',
  })

  const responseHeaders = new Headers(response.headers)
  const body =
    response.status === 204 ? new Uint8Array() : await response.arrayBuffer()

  const nextResponse = new NextResponse(body, {
    status: response.status,
    headers: responseHeaders,
  })

  const setCookie = responseHeaders.get('set-cookie')
  if (setCookie) {
    nextResponse.headers.set('set-cookie', setCookie)
  }

  return nextResponse
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { therapistId: string } },
): Promise<NextResponse> {
  return forwardDelete(req, params.therapistId)
}
