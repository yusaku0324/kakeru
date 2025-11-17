export const pad = (value: number) => value.toString().padStart(2, '0')

export function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function toIsoWithOffset(date: Date) {
  return `${formatLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00+09:00`
}
