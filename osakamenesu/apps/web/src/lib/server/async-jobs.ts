'use server'

import { buildApiUrl, resolveApiBases } from '@/lib/api'
import type { ReservationNotificationJob } from '@/lib/async-jobs'

export async function enqueueAsyncJobServer(payload: ReservationNotificationJob) {
  const body = JSON.stringify(payload)
  let lastError: { status?: number; detail?: unknown } | null = null

  for (const base of resolveApiBases()) {
    try {
      const target = buildApiUrl(base, '/api/async/jobs')
      const resp = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        cache: 'no-store',
      })
      if (resp.ok) {
        return await resp.json().catch(() => ({}))
      }
      let detail: unknown = null
      try {
        detail = await resp.json()
      } catch {
        detail = await resp.text()
      }
      lastError = { status: resp.status, detail }
    } catch (error) {
      lastError = { detail: error }
    }
  }

  const message =
    typeof lastError?.detail === 'string'
      ? lastError.detail
      : lastError?.detail && typeof lastError.detail === 'object'
        ? JSON.stringify(lastError.detail)
        : 'async job enqueue failed'

  throw new Error(message)
}
