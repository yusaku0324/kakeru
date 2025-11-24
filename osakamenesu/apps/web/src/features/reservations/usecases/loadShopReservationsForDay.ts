import type { DashboardReservationItem } from '@/lib/dashboard-reservations'
import { fetchDashboardReservations } from '@/lib/dashboard-reservations'

export const RESERVATION_DAY_MODES = ['today', 'tomorrow'] as const
export type ReservationDayMode = (typeof RESERVATION_DAY_MODES)[number]

type LoadOptions = {
  signal?: AbortSignal
}

export async function loadShopReservationsForDay(
  profileId: string,
  mode: ReservationDayMode,
  options: LoadOptions = {},
) {
  const data = await fetchDashboardReservations(profileId, {
    limit: 100,
    sort: 'date',
    direction: 'asc',
    mode,
    signal: options.signal,
  })
  return data.reservations as DashboardReservationItem[]
}

export function loadShopReservationsForToday(profileId: string, options: LoadOptions = {}) {
  return loadShopReservationsForDay(profileId, 'today', options)
}

export function loadShopReservationsForTomorrow(profileId: string, options: LoadOptions = {}) {
  return loadShopReservationsForDay(profileId, 'tomorrow', options)
}
