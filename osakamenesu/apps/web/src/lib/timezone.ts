import dayjsLib, { type ConfigType } from 'dayjs'
import type { Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjsLib.extend(utc)
dayjsLib.extend(timezone)

export const TOKYO_TZ = 'Asia/Tokyo'
dayjsLib.tz.setDefault(TOKYO_TZ)

export type DayjsInput = ConfigType

export function toZonedDayjs(value?: DayjsInput, tz: string = TOKYO_TZ): Dayjs {
  if (value == null) {
    return dayjsLib().tz(tz)
  }
  const parsed = dayjsLib(value)
  if (!parsed.isValid()) {
    return parsed
  }
  return parsed.tz(tz)
}

export function formatDatetimeLocal(value?: DayjsInput, tz: string = TOKYO_TZ): string {
  const zoned = toZonedDayjs(value, tz)
  if (!zoned.isValid()) return ''
  return zoned.format('YYYY-MM-DDTHH:mm')
}

export function formatZonedIso(
  value?: DayjsInput,
  tz: string = TOKYO_TZ,
  format: string = 'YYYY-MM-DDTHH:mm:ss.SSSZZ',
): string {
  const zoned = toZonedDayjs(value, tz)
  if (!zoned.isValid()) return ''
  return zoned.format(format)
}

export function nowIso(tz: string = TOKYO_TZ): string {
  return formatZonedIso(undefined, tz)
}

export function addMinutes(value: DayjsInput, minutes: number, tz: string = TOKYO_TZ): Dayjs {
  return toZonedDayjs(value, tz).add(minutes, 'minute')
}

export function toZonedDate(value?: DayjsInput, tz: string = TOKYO_TZ): Date {
  return toZonedDayjs(value, tz).toDate()
}

export { dayjsLib as dayjs }
export type { Dayjs }
