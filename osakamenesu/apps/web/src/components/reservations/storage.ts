'use client'

export type LatestReservationSnapshot = {
  reservationId: string | null
  status: string | null
  submittedAt: string | null
}

const LATEST_RESERVATION_STORAGE_PREFIX = 'reservation.latest.'

export function buildLatestReservationKey(shopId: string) {
  return `${LATEST_RESERVATION_STORAGE_PREFIX}${shopId}`
}

export function loadLatestReservation(shopId: string): LatestReservationSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(buildLatestReservationKey(shopId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      reservationId: typeof parsed.reservationId === 'string' ? parsed.reservationId : null,
      status: typeof parsed.status === 'string' ? parsed.status : null,
      submittedAt: typeof parsed.submittedAt === 'string' ? parsed.submittedAt : null,
    }
  } catch {
    return null
  }
}

export function saveLatestReservation(shopId: string, snapshot: LatestReservationSnapshot) {
  if (typeof window === 'undefined') return
  try {
    const payload = JSON.stringify(snapshot)
    window.localStorage.setItem(buildLatestReservationKey(shopId), payload)
    window.dispatchEvent(
      new CustomEvent('reservation:updated', {
        detail: {
          shopId,
          reservationId: snapshot.reservationId,
          status: snapshot.status,
          submittedAt: snapshot.submittedAt,
        },
      }),
    )
  } catch {
    // ignore localStorage failures
  }
}
