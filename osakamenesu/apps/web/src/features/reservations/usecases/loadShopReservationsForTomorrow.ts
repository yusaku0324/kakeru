import type { DashboardReservationItem } from '@/lib/dashboard-reservations'
import { fetchDashboardReservations } from '@/lib/dashboard-reservations'

export async function loadShopReservationsForTomorrow(profileId: string, options: { signal?: AbortSignal } = {}) {
  const data = await fetchDashboardReservations(profileId, {
    limit: 100,
    sort: 'date',
    direction: 'asc',
    mode: 'tomorrow',
    signal: options.signal,
  })
  return data.reservations as DashboardReservationItem[]
}
