import { NextResponse, type NextRequest } from 'next/server'

import { resolveInternalApiBase } from '@/lib/server-config'

// Enable ISR caching for this API route (60 seconds)
export const revalidate = 60

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: Params) {
  const { id: identifier } = await context.params
  const internalBase = resolveInternalApiBase()
  const targetUrl = `${internalBase}/api/v1/shops/${encodeURIComponent(identifier)}`

  // Cache headers for edge caching
  const cacheHeaders = {
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 60 },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ detail: 'shop not found' }, { status: 404 })
      }
      return NextResponse.json(
        { detail: 'Failed to fetch shop' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data, { headers: cacheHeaders })
  } catch (error) {
    console.error('Failed to proxy shop request:', error)
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    )
  }
}
