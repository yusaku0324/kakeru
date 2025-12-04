import { NextRequest, NextResponse } from 'next/server'

import { resolveInternalApiBase } from '@/lib/server-config'

const API_BASE = resolveInternalApiBase()

type Context = {
  params: Promise<{ therapistId: string }>
}

export async function GET(request: NextRequest, context: Context) {
  const { therapistId } = await context.params
  const searchParams = request.nextUrl.searchParams
  const queryString = searchParams.toString()
  const url = `${API_BASE}/api/v1/therapists/${therapistId}/similar${queryString ? `?${queryString}` : ''}`

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching similar therapists:', error)
    return NextResponse.json(
      { message: 'Failed to fetch similar therapists', reason_code: 'internal_error' },
      { status: 500 }
    )
  }
}
