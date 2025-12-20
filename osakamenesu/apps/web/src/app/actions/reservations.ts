'use server'

import { revalidateTag } from 'next/cache'

import { buildApiUrl } from '@/lib/api'
import { resolveInternalApiBase } from '@/lib/server-config'
import { CACHE_TAGS } from '@/lib/cache-tags'

type ReservationApiResponse = {
  id: string
  shop_id: string
  shop_name?: string
  shop?: { name?: string }
  status: string
  customer_name?: string
  customer_phone?: string
  customer_email?: string
  customer?: {
    name?: string
    phone?: string
    email?: string
  }
  desired_start?: string
  desired_end?: string
  start_at?: string
  end_at?: string
  notes?: string
  contact_info?: {
    name?: string
    phone?: string
    email?: string
  }
}

type CreateReservationPayload = {
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
  contact_info: {
    name: string
    phone: string
    email?: string | null
    channel?: string | null
  }
  notes?: string | null
}

export type CreateReservationResult =
  | {
      success: true
      reservation: ReservationApiResponse
    }
  | {
      success: false
      error: string
    }

function formatDateKey(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return iso.slice(0, 10)
  }
}

function transformPayload(legacy: CreateReservationPayload): GuestReservationPayload {
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

type RevalidateFn = (tag: string) => void
const callRevalidateTag: RevalidateFn = revalidateTag as unknown as RevalidateFn

export async function createReservationAction(
  payload: CreateReservationPayload,
): Promise<CreateReservationResult> {
  // Transform to GuestReservation format
  const guestPayload = transformPayload(payload)
  const body = JSON.stringify(guestPayload)
  let lastError: { status?: number; body?: unknown } | null = null

  const targets = ['/api', resolveInternalApiBase()]
  for (const base of targets) {
    try {
      // Use the new GuestReservation API
      const resp = await fetch(buildApiUrl(base, '/api/guest/reservations'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        cache: 'no-store',
      })
      const text = await resp.text()
      let json: { id?: string; shop_id?: string; status?: string; contact_info?: Record<string, string>; start_at?: string; end_at?: string; notes?: string; detail?: string | Array<{ msg?: string }> } | null = null
      if (text) {
        try {
          json = JSON.parse(text) as typeof json
        } catch {
          json = { detail: text }
        }
      }
      if (resp.ok && json?.id) {
        // Transform response to legacy format
        const reservationRecord: ReservationApiResponse = {
          id: json.id,
          shop_id: json.shop_id || payload.shop_id,
          status: json.status || 'pending',
          customer_name: json.contact_info?.name,
          customer_phone: json.contact_info?.phone,
          customer_email: json.contact_info?.email,
          desired_start: json.start_at,
          desired_end: json.end_at,
          notes: json.notes,
        }

        if (payload.shop_id) {
          callRevalidateTag(CACHE_TAGS.store(payload.shop_id))
          callRevalidateTag(CACHE_TAGS.stores)
          const dayKey = formatDateKey(payload.desired_start)
          callRevalidateTag(CACHE_TAGS.slots(payload.shop_id, dayKey))
        }

        return {
          success: true,
          reservation: reservationRecord,
        }
      }
      lastError = { status: resp.status, body: json }
    } catch (error) {
      lastError = { body: error }
    }
  }

  const message = (() => {
    const body = lastError?.body
    if (body && typeof body === 'object' && 'detail' in body) {
      const detail = (body as { detail?: unknown }).detail
      if (typeof detail === 'string') return detail
      if (Array.isArray(detail)) {
        return detail
          .map((item: { msg?: string }) => item?.msg)
          .filter(Boolean)
          .join('\n')
      }
    }
    if (typeof body === 'string') return body
    if (body instanceof Error) return body.message
    return '予約の送信に失敗しました。しばらくしてから再度お試しください。'
  })()

  return { success: false, error: message }
}
