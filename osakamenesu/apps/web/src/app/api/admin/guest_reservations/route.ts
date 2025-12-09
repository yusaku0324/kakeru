import { NextResponse } from 'next/server'

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

export async function GET(req: Request) {
  const client = getAdminClient()
  if (!client) {
    return NextResponse.json({ detail: 'admin key not configured' }, { status: 500 })
  }

  const url = new URL(req.url)
  const queryString = url.search ? url.search.slice(1) : ''
  const path = queryString ? `guest_reservations?${queryString}` : 'guest_reservations'

  const result = await client.get<unknown>(path)

  if (result.ok) {
    return NextResponse.json(result.data)
  }

  if (result.status === 0) {
    return NextResponse.json({ detail: 'admin guest reservations unavailable' }, { status: 503 })
  }

  const err = result as ApiErrorResult
  return NextResponse.json(
    err.detail ?? { detail: err.error },
    { status: err.status }
  )
}
