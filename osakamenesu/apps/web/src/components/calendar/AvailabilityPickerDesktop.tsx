'use client'

import type { AvailabilityDay, AvailabilitySlot, CalendarTime } from './types'
import { WeekAvailabilityGrid, type SelectedSlot, type AvailabilitySourceType } from './WeekAvailabilityGrid'

export type AvailabilityPickerDesktopProps = {
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

export function AvailabilityPickerDesktop({
  days,
  timeline,
  selected,
  onToggle,
  timeFormatter,
  maxSelection,
  slotDurationMinutes,
  availabilitySourceType,
  onRequestReservation,
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
      slotDurationMinutes={slotDurationMinutes}
      availabilitySourceType={availabilitySourceType}
      onRequestReservation={onRequestReservation}
    />
  )
}

export type { SelectedSlot, AvailabilitySourceType } from './WeekAvailabilityGrid'
