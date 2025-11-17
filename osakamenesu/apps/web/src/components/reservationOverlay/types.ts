import type { AvailabilityStatus } from '@/components/calendar/types'
import type { SelectedSlot } from '@/components/calendar/AvailabilityPickerDesktop'

export type NormalizedSlot = {
  start_at: string
  end_at: string
  status: AvailabilityStatus
  timeKey: string
}

export type NormalizedDay = {
  date: string
  label: string
  isToday: boolean
  slots: NormalizedSlot[]
}

export type TimelineEntry = { key: string; label: string }

export type SelectedSlotListItem = SelectedSlot
