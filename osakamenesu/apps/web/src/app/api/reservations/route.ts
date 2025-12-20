import { NextResponse } from 'next/server'

import { getServerConfig } from '@/lib/server-config'

const SERVER_CONFIG = getServerConfig()

function resolveBases(): string[] {
  return [SERVER_CONFIG.internalApiBase, SERVER_CONFIG.publicApiBase]
}

type LegacyPayload = {
  shop_id: string
  staff_id?: string | null
  menu_id?: string | null
  channel?: string | null
  desired_start: string
  desired_end: string
  notes?: string | null
  marketing_opt_in?: boolean
  customer: {
    name: string
    phone: string
    email?: string | null
  }
  preferred_slots?: Array<{ desired_start: string; desired_end: string; status: string }>
}

type GuestReservationPayload = {
  shop_id: string
  therapist_id?: string | null
  start_at: string
  end_at: string
  duration_minutes?: number | null
  contact_info: {
    name: string
    phone: string
    email?: string | null
    channel?: string | null
  }
  notes?: string | null
}

function transformPayload(legacy: LegacyPayload): GuestReservationPayload {
  return {
    shop_id: legacy.shop_id,
    therapist_id: legacy.staff_id,
    start_at: legacy.desired_start,
    end_at: legacy.desired_end,
    contact_info: {
      name: legacy.customer.name,
      phone: legacy.customer.phone,
      email: legacy.customer.email,
      channel: legacy.channel,
    },
    notes: legacy.notes,
  }
}

export async function POST(req: Request) {
  let payload: LegacyPayload
  try {
    payload = await req.json() as LegacyPayload
  } catch {
    return NextResponse.json({ detail: 'invalid JSON body' }, { status: 400 })
  }

  // Transform legacy payload to GuestReservation format
  const guestPayload = transformPayload(payload)
  const body = JSON.stringify(guestPayload)
  let lastError: { status?: number; body?: unknown } | null = null

  for (const base of resolveBases()) {
    try {
      // Call the new GuestReservation API
      const resp = await fetch(`${base}/api/guest/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        cache: 'no-store',
      })
      const text = await resp.text()
      let json: Record<string, unknown> | null = null
      if (text) {
        try {
          json = JSON.parse(text) as Record<string, unknown>
        } catch {
          json = { detail: text }
        }
      }
      if (resp.ok) {
        // Transform response back to legacy format for frontend compatibility
        if (json && json.id) {
          const legacyResponse = {
            id: json.id,
            shop_id: json.shop_id,
            status: json.status,
            customer_name: (json.contact_info as Record<string, unknown>)?.name,
            customer_phone: (json.contact_info as Record<string, unknown>)?.phone,
            customer_email: (json.contact_info as Record<string, unknown>)?.email,
            desired_start: json.start_at,
            desired_end: json.end_at,
            notes: json.notes,
          }
          return NextResponse.json(legacyResponse, { status: resp.status })
        }
        return NextResponse.json(json, { status: resp.status })
      }
      lastError = { status: resp.status, body: json }
    } catch (err) {
      lastError = { body: err }
    }
  }

  if (lastError?.status && lastError.body) {
    return NextResponse.json(lastError.body, { status: lastError.status })
  }

  return NextResponse.json({ detail: 'reservation service unavailable' }, { status: 503 })
}
