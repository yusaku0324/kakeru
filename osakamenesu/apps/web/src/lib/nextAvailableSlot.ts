export type NextAvailableSlotPayload = {
  start_at: string
  status: 'ok' | 'maybe'
}

const dayLabelFormatter = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
})

const timeLabelFormatter = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function normalizeDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function formatNextAvailableSlotLabel(
  slot: NextAvailableSlotPayload | null | undefined,
  options: { fallbackLabel?: string; now?: Date } = {},
): string | null {
  if (!slot?.start_at) return options.fallbackLabel ?? null
  const start = new Date(slot.start_at)
  if (Number.isNaN(start.getTime())) return options.fallbackLabel ?? null
  const now = options.now ?? new Date()
  const dayDiff = Math.round((normalizeDay(start) - normalizeDay(now)) / (24 * 60 * 60 * 1000))
  const prefix = dayDiff === 0 ? '本日' : dayDiff === 1 ? '明日' : dayLabelFormatter.format(start)
  const timeLabel = timeLabelFormatter.format(start)
  return `最短の空き枠: ${prefix} ${timeLabel}〜`
}

export function toNextAvailableSlotPayload(value: string | null | undefined): NextAvailableSlotPayload | null {
  if (!value) return null
  return { start_at: value, status: 'ok' }
}
