import { formatSlotJp, type ScheduleSlot } from './schedule'

export type NextAvailableSlotPayload = {
  start_at: string
  end_at?: string | null
  status: 'ok' | 'maybe'
}

export function formatNextAvailableSlotLabel(
  slot: NextAvailableSlotPayload | null | undefined,
  options: { fallbackLabel?: string; now?: Date } = {},
): string | null {
  const scheduleSlot = nextSlotPayloadToScheduleSlot(slot)
  const formatted = scheduleSlot
    ? formatSlotJp(scheduleSlot, { now: options.now, fallbackLabel: options.fallbackLabel })
    : null
  return formatted ? `最短の空き枠: ${formatted}` : (options.fallbackLabel ?? null)
}

export function toNextAvailableSlotPayload(
  value: string | null | undefined,
  status: NextAvailableSlotPayload['status'] = 'ok',
): NextAvailableSlotPayload | null {
  if (!value) return null
  return { start_at: value, end_at: null, status }
}

export function nextSlotPayloadToScheduleSlot(
  slot: NextAvailableSlotPayload | null | undefined,
): ScheduleSlot | null {
  if (!slot?.start_at) return null
  return {
    start_at: slot.start_at,
    end_at: slot.end_at ?? slot.start_at,
    status: slot.status === 'maybe' ? 'tentative' : 'open',
  }
}
