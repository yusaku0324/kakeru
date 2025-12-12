export const pad = (value: number) => value.toString().padStart(2, '0')

const jstDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function formatLocalDate(date: Date) {
  // Always use JST timezone for consistent date formatting
  return jstDateFormatter.format(date)
}

const jstTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tokyo',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function toIsoWithOffset(date: Date) {
  // Always use JST timezone for consistent time formatting
  const time = jstTimeFormatter.format(date)
  return `${formatLocalDate(date)}T${time}:00+09:00`
}

const formatterOptions = {
  day: {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Tokyo',
  },
  time: {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo',
  },
  weekday: {
    weekday: 'short',
    timeZone: 'Asia/Tokyo',
  },
  monthShort: {
    month: 'short',
    timeZone: 'Asia/Tokyo',
  },
  dateTimeShort: {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Tokyo',
  },
  dateNumeric: {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  },
  monthShortDay: {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Tokyo',
  },
  dateMediumTimeShort: {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tokyo',
  },
} satisfies Record<string, Intl.DateTimeFormatOptions>

type FormatterType = keyof typeof formatterOptions

const formatterCache = new Map<FormatterType, Intl.DateTimeFormat>()

export function getJaFormatter(type: FormatterType) {
  const cached = formatterCache.get(type)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat('ja-JP', formatterOptions[type])
  formatterCache.set(type, formatter)
  return formatter
}
