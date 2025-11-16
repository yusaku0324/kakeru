import clsx from 'clsx'

import type { DashboardReservationItem } from '@/lib/dashboard-reservations'
import {
  getReservationStatusDisplay,
  RESERVATION_STATUS_BADGES,
  RESERVATION_STATUS_ICONS,
} from '@/components/reservations/status'

export type ReservationListProps = {
  items: DashboardReservationItem[]
  conflictIds: Set<string>
  onSelect: (reservation: DashboardReservationItem) => void
}

export function ReservationList({ items, conflictIds, onSelect }: ReservationListProps) {
  if (!items.length) {
    return <p className="text-sm text-neutral-textMuted">予約はまだありません。</p>
  }

  return (
    <ul className="space-y-3" data-testid="reservation-list">
      {items.map(reservation => {
        const statusClass = RESERVATION_STATUS_BADGES[reservation.status] ?? 'bg-neutral-200 text-neutral-700'
        const hasConflict = conflictIds.has(reservation.id)
        return (
          <li
            key={reservation.id}
            className={clsx(
              'rounded-card border border-neutral-borderLight/70 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-brand-primary/40',
              hasConflict && 'border-amber-400 bg-amber-50/40',
            )}
            data-testid="reservation-list-item"
          >
            <button
              type="button"
              onClick={() => onSelect(reservation)}
              className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
              data-testid="reservation-list-button"
            >
              <div>
                <div className="font-semibold text-neutral-text">
                  {new Date(reservation.desired_start).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}
                </div>
                <div className="text-xs text-neutral-textMuted">
                  {new Date(reservation.desired_start).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  〜
                  {new Date(reservation.desired_end).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="text-right text-xs text-neutral-textMuted">
                <div className="font-semibold text-neutral-text">{reservation.customer_name}</div>
                {reservation.channel ? <div>経路: {reservation.channel}</div> : null}
              </div>
              <span className={clsx('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', statusClass)}>
                {RESERVATION_STATUS_ICONS[reservation.status] ?? null}
                <span className="ml-1">{getReservationStatusDisplay(reservation.status)}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
