import { NextResponse, type NextRequest } from 'next/server'

import { createAdminClient, type ApiErrorResult } from '@/lib/http-clients'
import { ADMIN_KEY } from '@/app/api/admin/client'

const ADMIN_BASIC_USER = process.env.ADMIN_BASIC_USER || ''
const ADMIN_BASIC_PASS = process.env.ADMIN_BASIC_PASS || ''

function getAdminClient() {
  if (!ADMIN_KEY) return null
  return createAdminClient({
    adminKey: ADMIN_KEY,
    basicAuth: ADMIN_BASIC_USER && ADMIN_BASIC_PASS
      ? { user: ADMIN_BASIC_USER, pass: ADMIN_BASIC_PASS }
      : undefined,
  })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const client = getAdminClient()
  if (!client) {
    return NextResponse.json({ detail: 'admin key not configured' }, { status: 500 })
  }

  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ detail: 'invalid JSON body' }, { status: 400 })
  }

  const result = await client.patch<unknown>(`reservations/${id}`, body)

  if (result.ok) {
    return NextResponse.json(result.data)
  }

  if (result.status === 0) {
    return NextResponse.json({ detail: 'admin reservations unavailable' }, { status: 503 })
  }

  const err = result as ApiErrorResult
  return NextResponse.json(
    err.detail ?? { detail: err.error },
    { status: err.status }
  )
}
