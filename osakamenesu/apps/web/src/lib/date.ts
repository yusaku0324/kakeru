export function toLocalDateISO(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : new Date(input.getTime())
  if (Number.isNaN(date.getTime())) {
    return typeof input === 'string' ? input : ''
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatParts(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return { year, month, day, hour, minute }
}

export function formatReservationRange(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return `${start}〜${end}`
  }

  const startParts = formatParts(startDate)
  const endParts = formatParts(endDate)
  const startDateLabel = `${startParts.year}/${startParts.month}/${startParts.day}`
  const startTimeLabel = `${startParts.hour}:${startParts.minute}`
  const endTimeLabel = `${endParts.hour}:${endParts.minute}`
  const sameDay =
    startParts.year === endParts.year &&
    startParts.month === endParts.month &&
    startParts.day === endParts.day

  if (sameDay) {
    return `${startDateLabel} ${startTimeLabel}〜${endTimeLabel}`
  }
  const endDateLabel = `${endParts.year}/${endParts.month}/${endParts.day}`
  return `${startDateLabel} ${startTimeLabel}〜${endDateLabel} ${endTimeLabel}`
}
