'use client'

import type { AvailabilityDay, AvailabilitySlot, CalendarTime } from './types'
import { WeekAvailabilityGrid, type SelectedSlot } from './WeekAvailabilityGrid'

export type AvailabilityPickerDesktopProps = {
  days: AvailabilityDay[]
  timeline: CalendarTime[]
  selected: SelectedSlot[]
  onToggle: (day: AvailabilityDay, slot: AvailabilitySlot) => void
  timeFormatter: Intl.DateTimeFormat
  maxSelection?: number
}

export function AvailabilityPickerDesktop({
  days,
  timeline,
  selected,
  onToggle,
  timeFormatter,
  maxSelection,
}: AvailabilityPickerDesktopProps) {
  if (!Array.isArray(timeline)) {
    return null
  }
  return (
    <WeekAvailabilityGrid
      days={days}
      timeline={timeline}
      selected={selected}
      onToggle={onToggle}
      timeFormatter={timeFormatter}
      maxSelection={maxSelection}
      variant="desktop"
    />
  )
}

export type { SelectedSlot } from './WeekAvailabilityGrid'
