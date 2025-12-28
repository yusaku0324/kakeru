import { parseRequestBody, proxyToBackend } from '@/lib/api/route-helpers'

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

/**
 * Transform backend response to legacy format for frontend compatibility
 */
function transformResponse(json: Record<string, unknown>): Record<string, unknown> {
  if (!json.id) return json
  const contactInfo = json.contact_info as Record<string, unknown> | undefined
  return {
    id: json.id,
    shop_id: json.shop_id,
    status: json.status,
    customer_name: contactInfo?.name,
    customer_phone: contactInfo?.phone,
    customer_email: contactInfo?.email,
    desired_start: json.start_at,
    desired_end: json.end_at,
    notes: json.notes,
    debug: json.debug,
  }
}

export async function POST(req: Request) {
  const parsed = await parseRequestBody<LegacyPayload>(req)
  if ('error' in parsed) return parsed.error

  // Transform legacy payload to GuestReservation format
  const guestPayload = transformPayload(parsed.data)

  return proxyToBackend({
    method: 'POST',
    path: '/api/guest/reservations',
    body: JSON.stringify(guestPayload),
    transformResponse,
  })
}
