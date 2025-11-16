import { apiFetch } from '@/lib/http'

export type DashboardReservationPreferredSlot = {
  desired_start: string
  desired_end: string
  status: 'open' | 'tentative' | 'blocked'
}

export type DashboardReservationItem = {
  id: string
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'expired'
  channel?: string | null
  desired_start: string
  desired_end: string
  customer_name: string
  customer_phone: string
  customer_email?: string | null
  notes?: string | null
  marketing_opt_in?: boolean | null
  staff_id?: string | null
  created_at: string
  updated_at: string
  approval_decision?: string | null
  approval_decided_at?: string | null
  approval_decided_by?: string | null
  reminder_scheduled_at?: string | null
  preferred_slots: DashboardReservationPreferredSlot[]
}

export type DashboardReservationListResponse = {
  profile_id: string
  total: number
  reservations: DashboardReservationItem[]
  next_cursor?: string | null
  prev_cursor?: string | null
}

export async function fetchDashboardReservations(
  profileId: string,
  {
    status,
    limit = 10,
    signal,
    sort = 'latest',
    direction = 'desc',
    q,
    start,
    end,
    cursor,
    cursorDirection,
    mode,
  }: {
    status?: string
    limit?: number
    signal?: AbortSignal
    sort?: 'latest' | 'date'
    direction?: 'asc' | 'desc'
    q?: string
    start?: string
    end?: string
    cursor?: string
    cursorDirection?: 'forward' | 'backward'
    mode?: 'today' | 'tomorrow'
  } = {},
): Promise<DashboardReservationListResponse> {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  if (status) {
    params.set('status', status)
  }
  if (sort) {
    params.set('sort', sort)
  }
  if (direction) {
    params.set('direction', direction)
  }
  if (q) {
    params.set('q', q)
  }
  if (start) {
    params.set('start', start)
  }
  if (end) {
    params.set('end', end)
  }
  if (cursor) {
    params.set('cursor', cursor)
  }
  if (cursorDirection) {
    params.set('cursor_direction', cursorDirection)
  }
  if (mode) {
    params.set('mode', mode)
  }
  const res = await apiFetch(`/api/dashboard/shops/${profileId}/reservations?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  if (!res.ok) {
    throw new Error(`予約リストの取得に失敗しました (status=${res.status})`)
  }
  return res.json() as Promise<DashboardReservationListResponse>
}

export async function updateDashboardReservation(
  profileId: string,
  reservationId: string,
  payload: { status: 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'expired'; note?: string },
): Promise<{ reservation: DashboardReservationItem & { async_job?: { status: string; error?: string } }; conflict: boolean }> {
  const res = await apiFetch(`/api/dashboard/shops/${profileId}/reservations/${reservationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })

  const conflict = res.headers.get('x-reservation-conflict') === '1'

  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    const message =
      (detail && (detail.message || detail.detail)) || '予約の更新に失敗しました。時間をおいて再度お試しください。'
    throw new Error(typeof message === 'string' ? message : '予約の更新に失敗しました。')
  }

  const data = (await res.json()) as DashboardReservationItem
  return { reservation: data, conflict }
}
