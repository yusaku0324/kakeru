'use client'

import clsx from 'clsx'
import { Fragment, useMemo } from 'react'

import {
  AVAILABILITY_STATUS_META,
  type AvailabilityDay,
  type AvailabilitySlot,
  type AvailabilityStatus,
  type CalendarTime,
} from './types'

export type SelectedSlot = {
  startAt: string
  endAt: string
  date: string
  status: Exclude<AvailabilityStatus, 'blocked'>
}

type WeekAvailabilityGridProps = {
  days: AvailabilityDay[]
  timeline: CalendarTime[]
  selected: SelectedSlot[]
  onToggle: (day: AvailabilityDay, slot: AvailabilitySlot) => void
  timeFormatter: Intl.DateTimeFormat
  maxSelection?: number
  variant?: 'desktop' | 'mobile'
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  weekday: 'short',
  timeZone: 'Asia/Tokyo',
})
const MONTH_FORMATTER = new Intl.DateTimeFormat('ja-JP', { month: 'short', timeZone: 'Asia/Tokyo' })

function buildSlotKey(day: AvailabilityDay, slot: AvailabilitySlot) {
  const key = slot.timeKey ?? slot.start_at.slice(11, 16)
  return `${day.date}-${key}`
}

export function WeekAvailabilityGrid({
  days: daysInput,
  timeline: timelineInput,
  selected: selectedInput,
  onToggle,
  timeFormatter,
  maxSelection = 3,
  variant = 'desktop',
}: WeekAvailabilityGridProps) {
  const days = useMemo<AvailabilityDay[]>(
    () => (Array.isArray(daysInput) ? daysInput : []),
    [daysInput],
  )
  const timeline = useMemo<CalendarTime[]>(
    () => (Array.isArray(timelineInput) ? timelineInput : []),
    [timelineInput],
  )
  const selected = useMemo<SelectedSlot[]>(
    () => (Array.isArray(selectedInput) ? selectedInput : []),
    [selectedInput],
  )

  const selectedMap = useMemo(() => new Set(selected.map((item) => item.startAt)), [selected])

  const slotMap = useMemo(() => {
    const map = new Map<string, AvailabilitySlot>()
    for (const day of days) {
      for (const slot of day.slots) {
        map.set(buildSlotKey(day, slot), slot)
      }
    }
    return map
  }, [days])

  if (!timeline.length || !days.length) {
    return (
      <div className="rounded-[28px] border border-dashed border-white/65 bg-white/80 px-5 py-8 text-center text-sm text-neutral-textMuted">
        公開されている空き枠がありません。
      </div>
    )
  }

  const columnTemplate = `minmax(84px,auto) repeat(${days.length}, minmax(0,1fr))`
  const containerClass = variant === 'desktop' ? 'grid' : 'grid min-w-[640px] sm:min-w-[720px]'

  const timeCellClass =
    variant === 'desktop'
      ? 'flex h-14 items-center justify-center border-r border-b border-white/65 bg-white/80 text-[13px] font-semibold text-neutral-text'
      : 'flex h-14 items-center justify-center border-r border-b border-white/65 bg-white/80 text-[13px] font-semibold text-neutral-text'

  const dayHeaderClass =
    'flex h-20 flex-col items-center justify-center gap-1 border-b border-white/65 bg-white/90 px-2 text-center'

  const cellButtonClass =
    'group relative flex h-14 w-full items-center justify-center rounded-2xl text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/40'

  const buildIconClass = (status: AvailabilityStatus, selectedNow: boolean) =>
    clsx(
      'flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-semibold transition',
      status === 'open' &&
        (selectedNow
          ? 'border-brand-primary bg-brand-primary text-white shadow-[0_12px_28px_rgba(37,99,235,0.25)]'
          : 'border-emerald-400 bg-emerald-100 text-emerald-600'),
      status === 'tentative' &&
        (selectedNow
          ? 'border-brand-secondary bg-brand-secondary text-white shadow-[0_12px_28px_rgba(37,99,235,0.25)]'
          : 'border-amber-300 bg-amber-100 text-amber-600'),
      status === 'blocked' && 'border-white/70 bg-white text-neutral-textMuted',
    )

  const buildUnavailableClass = (selectedNow: boolean) =>
    clsx(
      'flex h-9 w-9 items-center justify-center rounded-full border border-white/70 text-xs font-semibold text-neutral-textMuted',
      selectedNow && 'border-brand-primary text-brand-primary',
    )

  return (
    <div className="overflow-hidden rounded-[32px] border border-white/65 bg-white/92 shadow-[0_35px_110px_rgba(21,93,252,0.18)]">
      <div className={clsx(containerClass)} style={{ gridTemplateColumns: columnTemplate }}>
        <div className="flex items-center justify-center border-b border-white/65 bg-white/90 text-xs font-semibold uppercase tracking-wide text-neutral-textMuted">
          時間
        </div>
        {days.map((day) => {
          const date = new Date(`${day.date}T00:00:00`)
          const monthLabel = MONTH_FORMATTER.format(date)
          const dayNumber = date.getDate()
          const weekday = WEEKDAY_FORMATTER.format(date)
          return (
            <div
              key={day.date}
              className={clsx(
                dayHeaderClass,
                day.isToday
                  ? 'bg-gradient-to-b from-brand-primary/15 to-transparent text-brand-primary'
                  : undefined,
              )}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-textMuted">
                {monthLabel}
              </span>
              <span className="text-lg font-semibold text-neutral-text">{dayNumber}</span>
              <span
                className={clsx(
                  'text-[11px] font-medium',
                  day.isToday ? 'text-brand-primary' : 'text-neutral-textMuted',
                )}
              >
                {weekday}
                {day.isToday ? '・今日' : ''}
              </span>
            </div>
          )
        })}

        {timeline.map((time) => (
          <Fragment key={time.key}>
            <div className={timeCellClass}>{time.label}</div>
            {days.map((day) => {
              const slot = slotMap.get(`${day.date}-${time.key}`)
              const selectedNow = slot ? selectedMap.has(slot.start_at) : false
              if (!slot || slot.status === 'blocked') {
                return (
                  <div
                    key={`${day.date}-${time.key}`}
                    className="flex h-14 items-center justify-center border-b border-white/65 bg-white/70"
                  >
                    <span className={buildUnavailableClass(selectedNow)} aria-hidden>
                      ×
                    </span>
                    <span className="sr-only">{`${day.label} ${time.label} は予約不可です`}</span>
                  </div>
                )
              }

              const statusMeta = AVAILABILITY_STATUS_META[slot.status]
              const disabled = !selectedNow && selected.length >= maxSelection
              const iconClass = buildIconClass(slot.status, selectedNow)

              return (
                <button
                  key={`${day.date}-${time.key}`}
                  type="button"
                  onClick={() => {
                    if (disabled) return
                    onToggle(day, slot)
                  }}
                  disabled={disabled}
                  className={clsx(
                    cellButtonClass,
                    'border-b border-white/65 bg-white/70',
                    disabled && !selectedNow && 'cursor-not-allowed opacity-60',
                  )}
                  aria-pressed={selectedNow}
                  aria-label={`${day.label} ${timeFormatter.format(new Date(slot.start_at))} ${statusMeta.icon} ${statusMeta.label}`}
                >
                  <span className={iconClass} aria-hidden>
                    {slot.status === 'open' ? '●' : statusMeta.icon}
                  </span>
                </button>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
