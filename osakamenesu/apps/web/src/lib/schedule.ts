import { TOKYO_TZ, toZonedDayjs, type DayjsInput, type Dayjs } from '@/lib/timezone'
import { getJaFormatter } from '@/utils/date'

const DEFAULT_TZ = TOKYO_TZ

const dayLabelFormatter = getJaFormatter('day')
const timeLabelFormatter = getJaFormatter('time')

export type ScheduleSlotStatus = 'open' | 'tentative' | 'blocked'

export type ScheduleSlot = {
  start_at: string
  end_at: string
  status: ScheduleSlotStatus
}

type NormalizedSlot<T extends ScheduleSlot> = {
  raw: T
  start: Dayjs
  end: Dayjs
}

function toTimezone(value?: DayjsInput, timezone: string = DEFAULT_TZ): Dayjs {
  return toZonedDayjs(value, timezone)
}

function normalizeSlot<T extends ScheduleSlot>(
  slot: T,
  timezone: string,
): NormalizedSlot<T> | null {
  const start = toTimezone(slot.start_at, timezone)
  const end = toTimezone(slot.end_at || slot.start_at, timezone)
  if (!start.isValid() || !end.isValid()) return null
  return { raw: slot, start, end }
}

function slotIsAvailable(status: ScheduleSlotStatus | string | undefined): boolean {
  return status === 'open' || status === 'tentative'
}

export function getNextAvailableSlot<T extends ScheduleSlot>(
  slots: T[],
  options: { now?: DayjsInput; timezone?: string } = {},
): T | null {
  const timezone = options.timezone ?? DEFAULT_TZ
  const now = toTimezone(options.now, timezone)
  const candidates = slots
    .filter((slot) => slotIsAvailable(slot.status))
    .map((slot) => normalizeSlot(slot, timezone))
    .filter((slot): slot is NormalizedSlot<T> => Boolean(slot))
    .filter(({ end }) => end.isAfter(now))
    .sort((a, b) => a.start.valueOf() - b.start.valueOf())

  return candidates[0]?.raw ?? null
}

export type SlotAvailabilitySummary<T extends ScheduleSlot> = {
  nextSlot: T | null
  nextLabel: string | null
  hasTodayAvailability: boolean
  hasFutureAvailability: boolean
}

export function summarizeSlotAvailability<T extends ScheduleSlot>(
  slots: T[],
  options: { now?: DayjsInput; timezone?: string; fallbackLabel?: string | null } = {},
): SlotAvailabilitySummary<T> {
  const timezone = options.timezone ?? DEFAULT_TZ
  const now = toTimezone(options.now, timezone)
  const fallbackLabel = options.fallbackLabel ?? null
  const normalized = slots
    .filter((slot) => slotIsAvailable(slot.status))
    .map((slot) => normalizeSlot(slot, timezone))
    .filter((slot): slot is NormalizedSlot<T> => Boolean(slot))
    .filter(({ end }) => end.isAfter(now))

  const hasFutureAvailability = normalized.length > 0
  const hasTodayAvailability = normalized.some(({ start }) => start.isSame(now, 'day'))
  const sorted = normalized.sort((a, b) => a.start.valueOf() - b.start.valueOf())
  const nextSlot = sorted[0]?.raw ?? null
  const nextLabel = nextSlot
    ? formatSlotJp(nextSlot, { now: now.toDate(), timezone })
    : fallbackLabel

  return {
    nextSlot,
    nextLabel,
    hasTodayAvailability,
    hasFutureAvailability,
  }
}

export function formatSlotJp<T extends ScheduleSlot>(
  slot: T | null | undefined,
  options: { now?: DayjsInput; timezone?: string; fallbackLabel?: string | null } = {},
): string | null {
  if (!slot) return options.fallbackLabel ?? null
  const timezone = options.timezone ?? DEFAULT_TZ
  const start = toTimezone(slot.start_at, timezone)
  if (!start.isValid()) return options.fallbackLabel ?? null
  const now = toTimezone(options.now, timezone)
  const dayDiff = start.startOf('day').diff(now.startOf('day'), 'day')
  const prefix =
    dayDiff === 0 ? '本日' : dayDiff === 1 ? '明日' : dayLabelFormatter.format(start.toDate())
  const timeLabel = timeLabelFormatter.format(start.toDate())
  return `${prefix} ${timeLabel}〜`
}

export function hasTodayAvailability<T extends ScheduleSlot>(
  slots: T[],
  options: { now?: DayjsInput; timezone?: string } = {},
): boolean {
  const timezone = options.timezone ?? DEFAULT_TZ
  const now = toTimezone(options.now, timezone)
  return slots
    .filter((slot) => slotIsAvailable(slot.status))
    .some((slot) => {
      const normalized = normalizeSlot(slot, timezone)
      return normalized ? normalized.start.isSame(now, 'day') && normalized.end.isAfter(now) : false
    })
}

export const TOKYO_TIMEZONE = DEFAULT_TZ
