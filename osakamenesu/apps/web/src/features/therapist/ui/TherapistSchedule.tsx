'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { toLocalDateISO } from '@/lib/date'
import { formatSlotJp, getNextAvailableSlot, type ScheduleSlot } from '@/lib/schedule'

const dayFormatter = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })
const timeFormatter = new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })

type SlotStatus = 'open' | 'tentative' | 'blocked'

type RawSlot = {
  start_at: string
  end_at: string
  status: SlotStatus
}

type TherapistScheduleDay = {
  date: string
  is_today?: boolean
  slots: RawSlot[]
}

export type TherapistScheduleSlot = {
  date: string
  start: string
  end: string
  status: SlotStatus
}

type TimelineSlot = TherapistScheduleSlot

type TherapistScheduleSlotWithSchedule = TherapistScheduleSlot & ScheduleSlot

type TherapistScheduleProps = {
  days: TherapistScheduleDay[]
  fullDays?: TherapistScheduleDay[]
  initialSlotIso?: string
  scrollTargetId?: string
}

const statusMeta: Record<SlotStatus, { label: string; symbol: string; color: string }> = {
  open: { label: '◎ 空きあり', symbol: '◎', color: 'text-state-successText' },
  tentative: { label: '△ 要確認', symbol: '△', color: 'text-brand-primaryDark' },
  blocked: { label: '× 満席', symbol: '×', color: 'text-neutral-textMuted' },
}

function formatDayLabel(date: string, todayIso: string, tomorrowIso: string) {
  if (date === todayIso) return '今日'
  if (date === tomorrowIso) return '明日'
  return dayFormatter.format(new Date(date))
}

function formatTimeLabel(iso: string) {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso.slice(11, 16)
  return timeFormatter.format(parsed).replace(/^24:/, '00:')
}

function computeAvailabilityLevel(slots: TherapistScheduleSlot[]) {
  const openOrTentative = slots.filter((slot) => slot.status === 'open' || slot.status === 'tentative').length
  if (slots.length === 0 || openOrTentative === 0) return 'none'
  if (openOrTentative >= 2) return 'full'
  return 'low'
}

function flattenScheduleDays(days: TherapistScheduleDay[]): TherapistScheduleSlotWithSchedule[] {
  return days
    .flatMap((day) =>
      day.slots.map((slot) => ({
        date: day.date,
        start: slot.start_at,
        end: slot.end_at,
        status: slot.status,
        start_at: slot.start_at,
        end_at: slot.end_at,
      })),
    )
    .sort((a, b) => a.start.localeCompare(b.start))
}

export function TherapistSchedule({ days, fullDays, initialSlotIso, scrollTargetId = 'reserve' }: TherapistScheduleProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const sourceDays = useMemo(() => (fullDays?.length ? fullDays : days), [days, fullDays])
  const previewDays = useMemo(() => (days.length ? days : sourceDays), [days, sourceDays])
  const now = useMemo(() => new Date(), [])
  const allSlots = useMemo(() => flattenScheduleDays(sourceDays), [sourceDays])
  const todayIso = toLocalDateISO(now)
  const tomorrowIso = toLocalDateISO(new Date(now.getTime() + 24 * 60 * 60 * 1000))
  const todayDisplayLabel = dayFormatter.format(now)

  const normalizedDays = useMemo(() => {
    return previewDays.map((day) => {
      const dateObj = new Date(day.date)
      const isWeekend = [0, 6].includes(dateObj.getDay())
      const isToday = Boolean(day.is_today) || day.date === todayIso
      const slots = [...day.slots]
        .map((slot) => ({ date: day.date, start: slot.start_at, end: slot.end_at, status: slot.status }))
        .sort((a, b) => a.start.localeCompare(b.start))
      const availabilityLevel = computeAvailabilityLevel(slots)
      const availabilityLabel = isToday
        ? availabilityLevel === 'none'
          ? '本日 空きなし'
          : '本日 空きあり'
        : availabilityLevel === 'none'
        ? '空きなし'
        : availabilityLevel === 'full'
        ? '余裕あり'
        : '残りわずか'
      return {
        date: day.date,
        isToday,
        isWeekend,
        label: formatDayLabel(day.date, todayIso, tomorrowIso),
        availabilityLevel,
        availabilityLabel,
        slots,
      }
    })
  }, [previewDays, todayIso, tomorrowIso])

  const fallbackNextSlot = useMemo(() => getNextAvailableSlot(allSlots, { now }), [allSlots, now])
  const hasGlobalSlots = allSlots.length > 0
  const initialDayFromSlot = useMemo(() => {
    if (initialSlotIso) {
      const match = normalizedDays.find((day) => day.slots.some((slot) => slot.start === initialSlotIso))
      if (match) return match.date
    }
    return fallbackNextSlot?.date ?? normalizedDays[0]?.date ?? ''
  }, [fallbackNextSlot?.date, initialSlotIso, normalizedDays])

  const [activeDay, setActiveDay] = useState(initialDayFromSlot)
  const [highlightedSlot, setHighlightedSlot] = useState(initialSlotIso ?? fallbackNextSlot?.start ?? null)

  useEffect(() => {
    setActiveDay(initialDayFromSlot)
    setHighlightedSlot(initialSlotIso ?? fallbackNextSlot?.start ?? null)
  }, [initialDayFromSlot, initialSlotIso, fallbackNextSlot?.start])

  const activeDayData = normalizedDays.find((day) => day.date === activeDay) ?? normalizedDays[0]
  const timelineSlots: TimelineSlot[] = useMemo(() => (activeDayData ? activeDayData.slots : []), [activeDayData])

  const highlightedSlotInfo = useMemo(() => {
    if (!highlightedSlot) return null
    return allSlots.find((slot) => slot.start === highlightedSlot) ?? null
  }, [allSlots, highlightedSlot])

  const summarySlot: TherapistScheduleSlotWithSchedule | null = highlightedSlotInfo ?? fallbackNextSlot

  const summaryBaseLabel = summarySlot ? formatSlotJp(summarySlot, { now }) : null
  const summaryLabel = summarySlot
    ? `${summaryBaseLabel ?? `${formatDayLabel(summarySlot.date, todayIso, tomorrowIso)} ${formatTimeLabel(
        summarySlot.start,
      )}〜`} ${statusMeta[summarySlot.status].symbol}`.trim()
    : '公開された枠はまだ掲載されていません'

  const handleSlotClick = useCallback(
    (slot: TimelineSlot) => {
      if (slot.status === 'blocked') return
      setActiveDay(slot.date)
      setHighlightedSlot(slot.start)
      if (pathname) {
        const params = new URLSearchParams(searchParams?.toString() ?? '')
        params.set('slot', slot.start)
        const qs = params.toString()
        const url = qs ? `${pathname}?${qs}` : pathname
        router.replace(`${url}#${scrollTargetId}`, { scroll: false })
      }
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          const target = document.getElementById(scrollTargetId)
          target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    },
    [pathname, router, scrollTargetId, searchParams],
  )

  if (!normalizedDays.length) return null

  return (
    <section className="rounded-section border border-neutral-borderLight/70 bg-white/90 p-6 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">空き枠サマリー</p>
        <p className="text-sm font-semibold text-neutral-text">次に入れる時間: {summaryLabel}</p>
        <p className="text-[11px] text-neutral-textMuted">本日: {todayDisplayLabel}</p>
      </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-neutral-textMuted">タップで予約フォームへ移動します</p>
          {summarySlot && summarySlot.status !== 'blocked' ? (
            <button
              type="button"
              onClick={() => handleSlotClick(summarySlot)}
              className="inline-flex items-center gap-1 rounded-full border border-brand-primary/40 px-3 py-1 text-[11px] font-semibold text-brand-primary transition hover:border-brand-primary hover:text-brand-primaryDark"
            >
              この枠で予約フォームへ
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-4 overflow-x-auto pb-2">
        <div className="flex min-w-full gap-2">
          {normalizedDays.map((day) => {
            const level = day.availabilityLevel
            const chipClass = clsx(
              'flex min-w-[96px] flex-col gap-1 rounded-2xl border px-3 py-2 text-left text-xs transition',
              activeDay === day.date
                ? 'border-brand-primary bg-brand-primary/10 text-brand-primaryDark shadow-lg'
                : 'border-neutral-borderLight bg-white text-neutral-text',
            )
            const indicatorClass = clsx('inline-flex h-1.5 w-full rounded-full', {
              'bg-state-successBg': level === 'full',
              'bg-brand-primary/50': level === 'low',
              'bg-neutral-borderLight': level === 'none',
            })
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setActiveDay(day.date)}
                className={chipClass}
                aria-pressed={activeDay === day.date}
              >
                <span className="text-sm font-semibold text-neutral-text">{day.label}</span>
                <span className="text-[11px] text-neutral-textMuted">{day.availabilityLabel}</span>
                <span className={indicatorClass} aria-hidden />
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between text-xs text-neutral-textMuted">
          <span>{formatDayLabel(activeDayData?.date || normalizedDays[0].date, todayIso, tomorrowIso)}</span>
          <span>空き枠をタップして予約へ</span>
        </div>
        <div className="relative space-y-3 border-l border-dashed border-neutral-borderLight/70 pl-6">
          {timelineSlots.length ? (
            timelineSlots.map((slot) => {
              const meta = statusMeta[slot.status]
              const isDisabled = slot.status === 'blocked'
              const isHighlighted = highlightedSlot === slot.start
              const baseClass = clsx(
                'flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
                isDisabled
                  ? 'cursor-not-allowed border-neutral-borderLight/60 bg-neutral-surfaceAlt/60 text-neutral-textMuted'
                  : 'cursor-pointer border-neutral-borderLight bg-white text-neutral-text hover:border-brand-primary hover:bg-brand-primary/5',
                isHighlighted && !isDisabled && 'border-brand-primary bg-brand-primary/10 shadow-[0_15px_35px_rgba(59,130,246,0.18)]',
              )
              const content = (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-neutral-text">{formatTimeLabel(slot.start)}〜{formatTimeLabel(slot.end)}</div>
                    <div className="text-[11px] text-neutral-textMuted">{meta.label}</div>
                  </div>
                  <span className={clsx('text-base font-bold', meta.color)}>{meta.symbol}</span>
                </div>
              )
              return isDisabled ? (
                <div key={slot.start} className={baseClass}>
                  {content}
                </div>
              ) : (
                <button
                  key={slot.start}
                  type="button"
                  className={baseClass}
                  onClick={() => handleSlotClick(slot)}
                  aria-current={isHighlighted ? 'true' : undefined}
                >
                  {content}
                </button>
              )
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-borderLight/70 bg-white/70 px-4 py-6 text-center text-xs text-neutral-textMuted">
              {hasGlobalSlots ? 'この日に公開されている枠はありません。他の日を選んでください。' : '公開された枠がありません。店舗へ直接お問い合わせください。'}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
