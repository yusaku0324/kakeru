import type { SelectedSlot } from '@/components/calendar/AvailabilityPickerDesktop'

// lib/availability.ts の統一型を再エクスポート
export type {
  DisplayAvailabilityDay as NormalizedDay,
  DisplaySlot as NormalizedSlot,
} from '@/lib/availability'

export type TimelineEntry = { key: string; label: string }

export type SelectedSlotListItem = SelectedSlot

export type ReservationContactItem = {
  key: string
  label: string
  value: string
  helper: string
  href?: string
}
