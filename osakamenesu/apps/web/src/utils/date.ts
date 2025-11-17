export const pad = (value: number) => value.toString().padStart(2, '0')

export function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function toIsoWithOffset(date: Date) {
  return `${formatLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00+09:00`
}

type FormatterType = 'day' | 'time'

const formatterCache = new Map<FormatterType, Intl.DateTimeFormat>()

export function getJaFormatter(type: FormatterType) {
  if (formatterCache.has(type)) return formatterCache.get(type) as Intl.DateTimeFormat

  const formatter =
    type === 'day'
      ? new Intl.DateTimeFormat('ja-JP', {
          month: 'numeric',
          day: 'numeric',
          weekday: 'short',
          timeZone: 'Asia/Tokyo',
        })
      : new Intl.DateTimeFormat('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Asia/Tokyo',
        })

  formatterCache.set(type, formatter)
  return formatter
}
