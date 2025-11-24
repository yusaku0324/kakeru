import { CSRF_HEADER_NAME, isCsrfProtectedMethod } from '@/lib/csrf'
import { getBrowserCsrfToken } from '@/lib/http'

type ReservationNotificationPayload = {
  reservation_id: string
  shop_id: string
  shop_name: string
  customer_name: string
  customer_phone: string
  desired_start: string
  desired_end: string
  status: string
  customer_email?: string | null
  notes?: string | null
  reminder_at?: string | null
  audience?: 'shop' | 'customer'
  event?: string
}

type AsyncJobPayload =
  | {
      type: 'reservation_notification'
      schedule_at?: string
      notification: ReservationNotificationPayload
    }
  | {
      type: 'reservation_reminder'
      schedule_at?: string
      notification: ReservationNotificationPayload & { reminder_at: string }
    }
  | {
      type: 'reservation_cancellation'
      schedule_at?: string
      notification: ReservationNotificationPayload
    }

export async function enqueueAsyncJob(payload: AsyncJobPayload): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (typeof window !== 'undefined' && isCsrfProtectedMethod('POST')) {
    const token = getBrowserCsrfToken()
    if (token) {
      headers[CSRF_HEADER_NAME] = token
    }
  }

  const response = await fetch('/api/async/jobs', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    credentials: 'include',
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to enqueue async job')
  }
  return response
}

export type ReservationReminderJob = Extract<AsyncJobPayload, { type: 'reservation_reminder' }>
export type ReservationNotificationJob = Extract<
  AsyncJobPayload,
  { type: 'reservation_notification' }
>
export type ReservationCancellationJob = Extract<
  AsyncJobPayload,
  { type: 'reservation_cancellation' }
>
