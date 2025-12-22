import { NextRequest, NextResponse } from 'next/server'

import { resolveInternalApiBase } from '@/lib/server-config'

// Enable ISR caching for this API route (60 seconds)
export const revalidate = 60

const API_BASE = resolveInternalApiBase()

type Context = {
  params: Promise<{ therapistId: string }>
}

export async function GET(request: NextRequest, context: Context) {
  const { therapistId } = await context.params
  const searchParams = request.nextUrl.searchParams
  const queryString = searchParams.toString()
  const url = `${API_BASE}/api/v1/therapists/${therapistId}${queryString ? `?${queryString}` : ''}`

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 60 },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching therapist detail:', error)
    return NextResponse.json(
      { message: 'Failed to fetch therapist detail', reason_code: 'internal_error' },
      { status: 500 }
    )
  }
}
