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

function formatDateParts(date: Date) {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
  return { month, day, weekday }
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function isToday(date: Date) {
  const today = new Date()
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

function isTomorrow(date: Date) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return (
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate()
  )
}

export function ReservationList({ items, conflictIds, onSelect }: ReservationListProps) {
  if (!items.length) {
    return <p className="text-sm text-neutral-textMuted">予約はまだありません。</p>
  }

  return (
    <ul className="space-y-3" data-testid="reservation-list">
      {items.map((reservation) => {
        const statusClass =
          RESERVATION_STATUS_BADGES[reservation.status] ?? 'bg-neutral-200 text-neutral-700'
        const hasConflict = conflictIds.has(reservation.id)
        const startDate = new Date(reservation.desired_start)
        const endDate = new Date(reservation.desired_end)
        const { month, day, weekday } = formatDateParts(startDate)
        const startTime = formatTime(startDate)
        const endTime = formatTime(endDate)
        const isTodayReservation = isToday(startDate)
        const isTomorrowReservation = isTomorrow(startDate)
        const isPending = reservation.status === 'pending'

        return (
          <li
            key={reservation.id}
            className={clsx(
              'group relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200',
              hasConflict
                ? 'border-amber-300 bg-amber-50/50 shadow-amber-100'
                : isPending
                  ? 'border-brand-primary/30 hover:border-brand-primary/50 hover:shadow-md hover:shadow-brand-primary/10'
                  : 'border-neutral-200/80 hover:border-neutral-300 hover:shadow-md',
            )}
            data-testid="reservation-list-item"
          >
            {/* Accent stripe for pending items */}
            {isPending && (
              <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-brand-primary to-brand-secondary" />
            )}

            <button
              type="button"
              onClick={() => onSelect(reservation)}
              className="flex w-full items-stretch gap-4 p-4 text-left"
              data-testid="reservation-list-button"
            >
              {/* Date block */}
              <div className={clsx(
                'flex flex-col items-center justify-center rounded-xl px-3 py-2 min-w-[60px]',
                isTodayReservation
                  ? 'bg-brand-primary/10 text-brand-primary'
                  : isTomorrowReservation
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-neutral-100 text-neutral-600',
              )}>
                <span className="text-[10px] font-medium uppercase tracking-wide">
                  {isTodayReservation ? '今日' : isTomorrowReservation ? '明日' : `${month}月`}
                </span>
                <span className="text-2xl font-bold leading-none">{day}</span>
                <span className="text-[10px] font-medium">({weekday})</span>
              </div>

              {/* Main content */}
              <div className="flex flex-1 flex-col justify-center gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-neutral-900">
                    {reservation.customer_name}
                  </span>
                  {hasConflict && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      重複あり
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
                  <span className="inline-flex items-center gap-1">
                    <svg className="h-3.5 w-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {startTime}〜{endTime}
                  </span>
                  {reservation.channel && (
                    <span className="inline-flex items-center gap-1 text-neutral-600">
                      <svg className="h-3.5 w-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      {reservation.channel}
                    </span>
                  )}
                  {reservation.customer_phone && (
                    <span className="inline-flex items-center gap-1 text-neutral-600">
                      <svg className="h-3.5 w-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {reservation.customer_phone}
                    </span>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <div className="flex items-center">
                <span
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm',
                    statusClass,
                  )}
                >
                  {RESERVATION_STATUS_ICONS[reservation.status] ?? null}
                  <span>{getReservationStatusDisplay(reservation.status)}</span>
                </span>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
