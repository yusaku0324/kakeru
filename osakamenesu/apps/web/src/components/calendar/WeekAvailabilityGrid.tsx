'use client'

import clsx from 'clsx'
import { Fragment, useMemo } from 'react'

import { getJaFormatter } from '@/utils/date'
import { normalizeTimeToMinutes } from '@/lib/time-normalize'
import { extractTime } from '@/lib/jst'
import {
  AVAILABILITY_STATUS_META,
  type AvailabilityDay,
  type AvailabilitySlot,
  type AvailabilityStatus,
  type CalendarTime,
} from './types'

export enum CellState {
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export type SelectedSlot = {
  startAt: string
  endAt: string
  date: string
  status: Exclude<AvailabilityStatus, 'blocked'>
}

// 空き状況のソースタイプ（useReservationOverlayState と一致）
export type AvailabilitySourceType = 'api' | 'fallback' | 'none'

type WeekAvailabilityGridProps = {
  days: AvailabilityDay[]
  timeline: CalendarTime[]
  selected: SelectedSlot[]
  onToggle: (day: AvailabilityDay, slot: AvailabilitySlot) => void
  timeFormatter: Intl.DateTimeFormat
  maxSelection?: number
  variant?: 'desktop' | 'mobile'
  slotDurationMinutes?: number
  availabilitySourceType?: AvailabilitySourceType
  onRequestReservation?: () => void
}

type AvailabilityEmptyStateProps = {
  onRequestReservation?: () => void
}

function AvailabilityEmptyState({ onRequestReservation }: AvailabilityEmptyStateProps) {
  return (
    <div className="rounded-[28px] border border-dashed border-white/65 bg-white/80 px-5 py-8 text-center">
      <div className="mb-3 text-base font-semibold text-neutral-text">
        空き状況未登録
      </div>
      <p className="mb-4 text-sm text-neutral-textMuted">
        現在、出勤情報が未登録です。
        <br />
        予約リクエストで調整できます。
      </p>
      {onRequestReservation && (
        <button
          type="button"
          onClick={onRequestReservation}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl active:scale-[0.98]"
        >
          予約リクエストを送る
        </button>
      )}
    </div>
  )
}

type DemoBadgeProps = {
  className?: string
}

function DemoBadge({ className }: DemoBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800',
        className
      )}
    >
      デモ表示
    </span>
  )
}

const WEEKDAY_FORMATTER = getJaFormatter('weekday')
const MONTH_FORMATTER = getJaFormatter('monthShort')

function buildSlotKey(day: AvailabilityDay, slot: AvailabilitySlot) {
  const key = slot.timeKey ?? extractTime(slot.start_at)
  return `${day.date}-${key}`
}

function getCellState(
  timeKey: string,
  slot: AvailabilitySlot | undefined,
  _slotDurationMinutes: number
): CellState {
  // スロットが存在しない場合は NOT_APPLICABLE
  if (!slot) {
    return CellState.NOT_APPLICABLE
  }

  // blocked ステータスの場合は UNAVAILABLE
  if (slot.status === 'blocked') {
    return CellState.UNAVAILABLE
  }

  // スロットが存在し、open または tentative なら AVAILABLE
  return CellState.AVAILABLE
}

export function WeekAvailabilityGrid({
  days: daysInput,
  timeline: timelineInput,
  selected: selectedInput,
  onToggle,
  timeFormatter,
  maxSelection = 3,
  variant = 'desktop',
  slotDurationMinutes = 60,
  availabilitySourceType = 'api',
  onRequestReservation,
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

  // Note: selectedMap was removed - now using timestamp comparison to handle format differences

  const slotMap = useMemo(() => {
    const map = new Map<string, AvailabilitySlot>()
    for (const day of days) {
      for (const slot of day.slots) {
        map.set(buildSlotKey(day, slot), slot)
      }
    }
    return map
  }, [days])

  // 空き状況未登録の場合は Empty State を表示
  if (availabilitySourceType === 'none' || (!timeline.length && !days.length)) {
    return <AvailabilityEmptyState onRequestReservation={onRequestReservation} />
  }

  // 日付はあるがスロットが空の場合も Empty State を表示
  if (!timeline.length || !days.length) {
    return <AvailabilityEmptyState onRequestReservation={onRequestReservation} />
  }

  const isFallback = availabilitySourceType === 'fallback'

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
      'flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-300',
      status === 'open' &&
        (selectedNow
          ? 'border-brand-primary bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-[0_12px_28px_rgba(37,99,235,0.35)] scale-110 ring-4 ring-brand-primary/20'
          : 'border-emerald-400 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 hover:scale-105 hover:shadow-[0_8px_20px_rgba(16,185,129,0.25)]'),
      status === 'tentative' &&
        (selectedNow
          ? 'border-brand-secondary bg-gradient-to-br from-brand-secondary to-purple-500 text-white shadow-[0_12px_28px_rgba(147,51,234,0.35)] scale-110 ring-4 ring-brand-secondary/20'
          : 'border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 hover:scale-105 hover:shadow-[0_8px_20px_rgba(245,158,11,0.25)]'),
      status === 'blocked' && 'border-white/70 bg-white text-neutral-textMuted',
    )

  const buildUnavailableClass = (selectedNow: boolean) =>
    clsx(
      'flex h-9 w-9 items-center justify-center rounded-full border border-white/70 text-xs font-semibold text-neutral-textMuted',
      selectedNow && 'border-brand-primary text-brand-primary',
    )

  return (
    <div data-testid="availability-grid" className="relative overflow-hidden rounded-[32px] border border-white/65 bg-white/92 shadow-[0_35px_110px_rgba(21,93,252,0.18)]">
      {isFallback && (
        <div className="absolute right-3 top-3 z-10">
          <DemoBadge />
        </div>
      )}
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
              const cellState = getCellState(time.key, slot, slotDurationMinutes)

              // Compare using timestamp to handle format differences (selectedMap uses camelCase startAt, slot uses snake_case start_at)
              const selectedNow = slot && cellState === CellState.AVAILABLE
                ? selected.some((s) => {
                    const selectedTs = new Date(s.startAt).getTime()
                    const slotTs = new Date(slot.start_at).getTime()
                    return !Number.isNaN(selectedTs) && !Number.isNaN(slotTs) && selectedTs === slotTs
                  })
                : false

              if (cellState === CellState.NOT_APPLICABLE) {
                return (
                  <div
                    key={`${day.date}-${time.key}`}
                    className="h-14 border-b border-white/65 bg-white/50"
                    aria-hidden="true"
                  />
                )
              }

              if (cellState === CellState.UNAVAILABLE) {
                const blockedStartMinutes = slot ? normalizeTimeToMinutes(slot.start_at) : -1
                return (
                  <div
                    key={`${day.date}-${time.key}`}
                    data-testid="slot-blocked"
                    data-date={day.date}
                    data-start-minutes={blockedStartMinutes}
                    data-start-at={slot?.start_at}
                    className="flex h-14 cursor-not-allowed items-center justify-center border-b border-white/65 bg-white/70 opacity-60 pointer-events-none"
                    role="gridcell"
                    aria-disabled="true"
                    tabIndex={-1}
                  >
                    <span className={buildUnavailableClass(selectedNow)} aria-hidden>
                      ×
                    </span>
                    <span className="sr-only">{`${day.label} ${time.label} は予約不可です`}</span>
                  </div>
                )
              }

              const statusMeta = AVAILABILITY_STATUS_META[slot!.status]
              const disabled = !selectedNow && selected.length >= maxSelection
              const iconClass = buildIconClass(slot!.status, selectedNow)

              const slotTestId = slot!.status === 'open' ? 'slot-available' : 'slot-pending'
              const startMinutes = normalizeTimeToMinutes(slot!.start_at)
              return (
                <button
                  key={`${day.date}-${time.key}`}
                  type="button"
                  data-testid={slotTestId}
                  data-date={day.date}
                  data-start-minutes={startMinutes}
                  data-start-at={slot!.start_at}
                  onClick={() => {
                    if (disabled) return
                    onToggle(day, slot!)
                  }}
                  disabled={disabled}
                  className={clsx(
                    cellButtonClass,
                    'border-b border-white/65 bg-white/70',
                    disabled && !selectedNow && 'cursor-not-allowed opacity-60',
                  )}
                  aria-pressed={selectedNow}
                  aria-label={`${day.label} ${timeFormatter.format(new Date(slot!.start_at))} ${statusMeta.icon} ${statusMeta.label}`}
                >
                  <span className={iconClass} aria-hidden>
                    {statusMeta.icon}
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
