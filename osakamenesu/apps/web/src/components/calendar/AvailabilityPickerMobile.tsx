'use client'

import type { AvailabilityDay, AvailabilitySlot, CalendarTime } from './types'
import { WeekAvailabilityGrid, type SelectedSlot, type AvailabilitySourceType } from './WeekAvailabilityGrid'

export type AvailabilityPickerMobileProps = {
  days: AvailabilityDay[]
  timeline: CalendarTime[]
  selected: SelectedSlot[]
  onToggle: (day: AvailabilityDay, slot: AvailabilitySlot) => void
  timeFormatter: Intl.DateTimeFormat
  maxSelection?: number
  slotDurationMinutes?: number
  availabilitySourceType?: AvailabilitySourceType
  onRequestReservation?: () => void
}

export function AvailabilityPickerMobile({
  days,
  timeline,
  selected,
  onToggle,
  timeFormatter,
  maxSelection,
  slotDurationMinutes,
  availabilitySourceType,
  onRequestReservation,
}: AvailabilityPickerMobileProps) {
  if (!Array.isArray(timeline)) {
    return null
  }
  return (
    <div className="overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <WeekAvailabilityGrid
        days={days}
        timeline={timeline}
        selected={selected}
        onToggle={onToggle}
        timeFormatter={timeFormatter}
        maxSelection={maxSelection}
        variant="mobile"
        slotDurationMinutes={slotDurationMinutes}
        availabilitySourceType={availabilitySourceType}
        onRequestReservation={onRequestReservation}
      />
    </div>
  )
}
