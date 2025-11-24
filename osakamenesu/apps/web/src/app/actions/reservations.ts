'use server'

import { revalidateTag } from 'next/cache'

import { buildApiUrl } from '@/lib/api'
import { resolveInternalApiBase } from '@/lib/server-config'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { enqueueAsyncJobServer } from '@/lib/server/async-jobs'
import type { ReservationNotificationJob } from '@/lib/async-jobs'

type ReservationApiResponse = any

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

type AsyncJobStatus = {
  status: 'queued' | 'failed' | 'skipped'
  error?: string
}

export type CreateReservationResult =
  | {
      success: true
      reservation: ReservationApiResponse
      asyncJob: AsyncJobStatus
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

function buildNotificationJobPayload(
  reservation: any,
  fallback: { shopId: string; desiredStart: string; desiredEnd: string },
): ReservationNotificationJob | null {
  if (!reservation || typeof reservation !== 'object') return null
  const reservationId = reservation.id
  const shopId = reservation.shop_id || fallback.shopId
  if (!reservationId || !shopId) return null
  const customer = reservation.customer || {}
  return {
    type: 'reservation_notification',
    notification: {
      reservation_id: reservationId,
      shop_id: shopId,
      shop_name: reservation.shop_name || reservation.shop?.name || String(shopId),
      customer_name: customer.name || reservation.customer_name || 'お客様',
      customer_phone: customer.phone || reservation.customer_phone || '',
      customer_email: customer.email || reservation.customer_email || undefined,
      desired_start: reservation.desired_start || fallback.desiredStart,
      desired_end: reservation.desired_end || fallback.desiredEnd,
      status: reservation.status || 'pending',
      notes: reservation.notes || undefined,
    },
  }
}

type RevalidateFn = (tag: string) => void
const callRevalidateTag: RevalidateFn = revalidateTag as unknown as RevalidateFn

export async function createReservationAction(
  payload: CreateReservationPayload,
): Promise<CreateReservationResult> {
  const body = JSON.stringify(payload)
  let lastError: { status?: number; body?: any } | null = null

  const targets = ['/api', resolveInternalApiBase()]
  for (const base of targets) {
    try {
      const resp = await fetch(buildApiUrl(base, '/api/v1/reservations'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        cache: 'no-store',
      })
      const text = await resp.text()
      let json: any = null
      if (text) {
        try {
          json = JSON.parse(text)
        } catch {
          json = { detail: text }
        }
      }
      if (resp.ok) {
        const reservationRecord = json?.reservation ?? json

        if (payload.shop_id) {
          callRevalidateTag(CACHE_TAGS.store(payload.shop_id))
          callRevalidateTag(CACHE_TAGS.stores)
          const dayKey = formatDateKey(payload.desired_start)
          callRevalidateTag(CACHE_TAGS.slots(payload.shop_id, dayKey))
        }

        let asyncJob: AsyncJobStatus = { status: 'skipped' }
        const jobPayload = buildNotificationJobPayload(reservationRecord, {
          shopId: payload.shop_id,
          desiredStart: payload.desired_start,
          desiredEnd: payload.desired_end,
        })
        if (jobPayload) {
          try {
            await enqueueAsyncJobServer(jobPayload)
            asyncJob = { status: 'queued' }
          } catch (error) {
            asyncJob = {
              status: 'failed',
              error: error instanceof Error ? error.message : 'async job failed',
            }
          }
        }

        return {
          success: true,
          reservation: reservationRecord,
          asyncJob,
        }
      }
      lastError = { status: resp.status, body: json }
    } catch (error) {
      lastError = { body: error }
    }
  }

  const message = (() => {
    if (typeof lastError?.body?.detail === 'string') return lastError.body.detail
    if (Array.isArray(lastError?.body?.detail)) {
      return lastError.body.detail
        .map((item: any) => item?.msg)
        .filter(Boolean)
        .join('\n')
    }
    if (typeof lastError?.body === 'string') return lastError.body
    if (lastError?.body instanceof Error) return lastError.body.message
    return '予約の送信に失敗しました。しばらくしてから再度お試しください。'
  })()

  return { success: false, error: message }
}
