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
