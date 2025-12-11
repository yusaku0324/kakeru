import clsx from 'clsx'

import {
  AvailabilityPickerDesktop,
  type SelectedSlot,
} from '@/components/calendar/AvailabilityPickerDesktop'
import { AvailabilityPickerMobile } from '@/components/calendar/AvailabilityPickerMobile'

import type { NormalizedDay, NormalizedSlot } from '../types'

type LegendItem = {
  key: string
  label: string
  icon: string
  iconClass: string
}

type ReservationAvailabilitySectionProps = {
  className?: string
  days: NormalizedDay[]
  timeline: Array<{ key: string; label: string }>
  selected: SelectedSlot[]
  onToggle: (day: NormalizedDay, slot: NormalizedSlot) => void
  timeFormatter: Intl.DateTimeFormat
  legendItems: readonly LegendItem[]
  showLegend?: boolean
  slotDurationMinutes?: number
}

export function ReservationAvailabilitySection({
  className,
  days,
  timeline,
  selected,
  onToggle,
  timeFormatter,
  legendItems,
  showLegend = true,
  slotDurationMinutes,
}: ReservationAvailabilitySectionProps) {
  return (
    <div className={clsx('space-y-6', className)}>
      <div className="hidden lg:block">
        <AvailabilityPickerDesktop
          days={days}
          timeline={timeline}
          selected={selected}
          onToggle={onToggle}
          timeFormatter={timeFormatter}
          slotDurationMinutes={slotDurationMinutes}
        />
      </div>
      <div className="lg:hidden">
        <AvailabilityPickerMobile
          days={days}
          timeline={timeline}
          selected={selected}
          onToggle={onToggle}
          timeFormatter={timeFormatter}
          slotDurationMinutes={slotDurationMinutes}
        />
      </div>
      {showLegend ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-white/60 bg-white/80 px-4 py-2 text-[11px] text-neutral-text">
          {legendItems.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white px-3 py-1">
              <span
                className={clsx(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs',
                  item.iconClass,
                )}
              >
                {item.icon}
              </span>
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
