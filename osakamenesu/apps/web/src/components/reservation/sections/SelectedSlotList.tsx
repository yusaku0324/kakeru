import clsx from 'clsx'

import { AVAILABILITY_STATUS_META, type AvailabilityStatus } from '@/components/calendar/types'
import type { SelectedSlot } from '@/components/calendar/WeekAvailabilityGrid'

type SelectedSlotListProps = {
  slots: SelectedSlot[]
  dayFormatter: Intl.DateTimeFormat
  timeFormatter: Intl.DateTimeFormat
  statusBadgeClasses: Record<AvailabilityStatus, string>
  emptyMessage: string
  onRemove: (startAt: string) => void
}

export function SelectedSlotList({
  slots,
  dayFormatter,
  timeFormatter,
  statusBadgeClasses,
  emptyMessage,
  onRemove,
}: SelectedSlotListProps) {
  if (!slots.length) {
    return (
      <div className="rounded-[24px] border border-dashed border-brand-primary/30 bg-brand-primary/5 px-4 py-6 text-center text-xs text-brand-primary">
        {emptyMessage}
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {slots.map((slot, index) => {
        const badgeClass = statusBadgeClasses[slot.status]
        const meta = AVAILABILITY_STATUS_META[slot.status]
        return (
          <li
            key={slot.startAt}
            className="rounded-[24px] bg-gradient-to-br from-brand-primary/12 via-white to-white px-5 py-4 shadow-[0_14px_38px_rgba(37,99,235,0.18)] ring-1 ring-white/60"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-text">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-brand-primary">
                  第{index + 1}候補
                </span>
                <div className="font-semibold">
                  {dayFormatter.format(new Date(slot.date))}{' '}
                  {timeFormatter.format(new Date(slot.startAt))}〜
                  {timeFormatter.format(new Date(slot.endAt))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={clsx(
                    'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold',
                    badgeClass,
                  )}
                >
                  <span aria-hidden>{meta.icon}</span>
                  {meta.label}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(slot.startAt)}
                  className="text-xs font-semibold text-brand-primary underline-offset-2 hover:underline"
                >
                  削除
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
