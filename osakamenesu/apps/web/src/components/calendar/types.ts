"use client"

export type AvailabilityStatus = 'open' | 'tentative' | 'blocked'

export type AvailabilitySlot = {
  start_at: string
  end_at: string
  status: AvailabilityStatus
  timeKey?: string
}

export type AvailabilityDay = {
  date: string
  label: string
  isToday?: boolean
  slots: AvailabilitySlot[]
}

export type CalendarTime = {
  key: string
  label: string
}

export type AvailabilityStatusMeta = {
  label: string
  icon: string
}

export const AVAILABILITY_STATUS_META: Record<AvailabilityStatus, AvailabilityStatusMeta> = {
  open: { label: '予約可', icon: '◎' },
  tentative: { label: '要確認', icon: '△' },
  blocked: { label: '予約不可', icon: '×' },
}
