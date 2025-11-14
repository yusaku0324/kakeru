"use client"

import type { AvailabilityDay, AvailabilitySlot, CalendarTime } from './types'
import { WeekAvailabilityGrid, type SelectedSlot } from './WeekAvailabilityGrid'

export type AvailabilityPickerMobileProps = {
  days: AvailabilityDay[]
  timeline: CalendarTime[]
  selected: SelectedSlot[]
  onToggle: (day: AvailabilityDay, slot: AvailabilitySlot) => void
  timeFormatter: Intl.DateTimeFormat
  maxSelection?: number
}

export function AvailabilityPickerMobile({
  days,
  timeline,
  selected,
  onToggle,
  timeFormatter,
  maxSelection,
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
      />
    </div>
  )
}
