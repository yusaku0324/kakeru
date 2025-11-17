'use client'

import clsx from 'clsx'
import { Dispatch, SetStateAction, useMemo } from 'react'

import {
  AvailabilityPickerDesktop,
  type SelectedSlot,
} from '@/components/calendar/AvailabilityPickerDesktop'
import { AvailabilityPickerMobile } from '@/components/calendar/AvailabilityPickerMobile'
import {
  AVAILABILITY_STATUS_META,
  type AvailabilityStatus,
  type CalendarTime,
} from '@/components/calendar/types'

type NormalizedSlot = {
  start_at: string
  end_at: string
  status: AvailabilityStatus
  timeKey: string
}

type NormalizedDay = {
  date: string
  label: string
  isToday: boolean
  slots: NormalizedSlot[]
}

type ReservationBookingSectionProps = {
  variant?: 'inline' | 'form'
  className?: string
  currentScheduleDays: NormalizedDay[]
  timeline: CalendarTime[]
  selectedSlots: SelectedSlot[]
  dayFormatter: Intl.DateTimeFormat
  timeFormatter: Intl.DateTimeFormat
  statusBadgeClasses: Record<AvailabilityStatus, string>
  scheduleRangeLabel: string
  schedulePage: number
  schedulePageCount: number
  hasAvailability: boolean
  formTab?: 'schedule' | 'info'
  setFormTab?: Dispatch<SetStateAction<'schedule' | 'info'>>
  setSchedulePage: Dispatch<SetStateAction<number>>
  onToggleSlot: (day: NormalizedDay, slot: NormalizedSlot) => void
  onRemoveSlot: (startAt: string) => void
  onEnsureSelection: () => void
  onMobileAdvance?: () => void
}

export function ReservationBookingSection({
  variant = 'form',
  className,
  currentScheduleDays,
  timeline,
  selectedSlots,
  dayFormatter,
  timeFormatter,
  statusBadgeClasses,
  scheduleRangeLabel,
  schedulePage,
  schedulePageCount,
  hasAvailability,
  formTab = 'schedule',
  setFormTab,
  setSchedulePage,
  onToggleSlot,
  onRemoveSlot,
  onEnsureSelection,
  onMobileAdvance,
}: ReservationBookingSectionProps) {
  const selectedSlotList = useMemo(
    () =>
      selectedSlots.map((slot, index) => {
        const badgeClass = statusBadgeClasses[slot.status]
        const meta = AVAILABILITY_STATUS_META[slot.status]
        return (
          <li
            key={slot.startAt}
            className="rounded-[24px] bg-gradient-to-br from-brand-primary/12 via-white to-white px-5 py-4 shadow-[0_14px_38px_rgba(37,99,235,0.18)] ring-1 ring-white/60"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-text">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-brand-primary">
                  第{index + 1}候補
                </span>
                <div className="font-semibold">
                  {dayFormatter.format(new Date(slot.date))}{' '}
                  {timeFormatter.format(new Date(slot.startAt))}〜
                  {timeFormatter.format(new Date(slot.endAt))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={clsx(
                    'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold',
                    badgeClass,
                  )}
                >
                  <span aria-hidden>{meta.icon}</span>
                  {meta.label}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveSlot(slot.startAt)}
                  className="text-xs font-semibold text-brand-primary underline-offset-2 hover:underline"
                >
                  削除
                </button>
              </div>
            </div>
          </li>
        )
      }),
    [selectedSlots, statusBadgeClasses, dayFormatter, timeFormatter, onRemoveSlot],
  )

  const containerClass = clsx(
    variant === 'form' && formTab === 'info' ? 'hidden lg:flex lg:flex-col' : 'flex flex-col',
    'gap-6',
    className,
  )

  const monthLabel = currentScheduleDays[0]
    ? (() => {
        const date = new Date(`${currentScheduleDays[0].date}T00:00:00`)
        if (Number.isNaN(date.getTime())) return ''
        return `${date.getFullYear()}年${date.getMonth() + 1}月`
      })()
    : ''

  const safeTimeline = Array.isArray(timeline) ? timeline : []

  const handleMobileAdvance = () => {
    onEnsureSelection()
    if (onMobileAdvance) {
      onMobileAdvance()
    } else {
      setFormTab?.('info')
    }
  }

  return (
    <div className={containerClass}>
      <div className="rounded-[32px] bg-gradient-to-br from-[#eef4ff] via-white to-white p-6 text-neutral-text shadow-[0_24px_80px_rgba(37,99,235,0.18)] ring-1 ring-white/60">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">希望日時を選択</h3>
            <p className="text-xs text-neutral-textMuted">
              最大3枠まで候補を追加できます。◯をタップしてください。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-1 text-xs font-semibold text-brand-primary shadow-sm shadow-brand-primary/10">
              {scheduleRangeLabel}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-1 text-[11px] font-semibold text-brand-primary">
              ⭐️ {hasAvailability ? '公開枠あり' : 'お問い合わせで調整'}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/60 bg-white/75 px-4 py-2 text-[11px] font-semibold text-neutral-text">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSchedulePage((prev) => Math.max(prev - 1, 0))}
              disabled={schedulePage === 0}
              className={clsx(
                'inline-flex h-9 w-9 items-center justify-center rounded-full border transition',
                schedulePage === 0
                  ? 'cursor-not-allowed border-white/60 text-neutral-textMuted'
                  : 'border-brand-primary/20 bg-white text-brand-primary hover:border-brand-primary/40',
              )}
              aria-label="前の週を表示"
            >
              ←
            </button>
            <div className="text-sm text-neutral-text">{monthLabel}</div>
            <button
              type="button"
              onClick={() => setSchedulePage((prev) => Math.min(prev + 1, schedulePageCount - 1))}
              disabled={schedulePage >= schedulePageCount - 1}
              className={clsx(
                'inline-flex h-9 w-9 items-center justify-center rounded-full border transition',
                schedulePage >= schedulePageCount - 1
                  ? 'cursor-not-allowed border-white/60 text-neutral-textMuted'
                  : 'border-brand-primary/20 bg-white text-brand-primary hover:border-brand-primary/40',
              )}
              aria-label="次の週を表示"
            >
              →
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-neutral-textMuted">
              {schedulePage + 1} / {schedulePageCount}
            </span>
            <button
              type="button"
              onClick={() => setSchedulePage(0)}
              disabled={schedulePage === 0}
              className={clsx(
                'rounded-full px-3 py-1 text-xs transition',
                schedulePage === 0
                  ? 'cursor-not-allowed border border-white/60 text-neutral-textMuted'
                  : 'border border-brand-primary/30 bg-white text-brand-primary hover:border-brand-primary/40',
              )}
            >
              今週へ戻る
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-3 text-[11px] font-semibold text-neutral-textMuted">
          <LegendItem tone="available">{AVAILABILITY_STATUS_META.open.label}</LegendItem>
          <LegendItem tone="tentative">{AVAILABILITY_STATUS_META.tentative.label}</LegendItem>
          <LegendItem tone="blocked">{AVAILABILITY_STATUS_META.blocked.label}</LegendItem>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/70 bg-white/95 p-5 text-neutral-text shadow-[0_18px_60px_rgba(21,93,252,0.14)]">
        <h3 className="text-sm font-semibold">候補枠の調整</h3>
        <p className="mt-1 text-[11px] text-neutral-textMuted">
          希望時間をタップして候補に追加してください。最大3枠まで登録できます。
        </p>
        <div className="mt-4 hidden md:block">
          <AvailabilityPickerDesktop
            days={currentScheduleDays}
            timeline={safeTimeline}
            selected={selectedSlots}
            onToggle={(day, slot) =>
              onToggleSlot(day as NormalizedDay, {
                start_at: slot.start_at,
                end_at: slot.end_at,
                status: slot.status,
                timeKey: slot.timeKey ?? slot.start_at.slice(11, 16),
              })
            }
            timeFormatter={timeFormatter}
          />
        </div>
        <div className="md:hidden">
          <AvailabilityPickerMobile
            days={currentScheduleDays}
            timeline={safeTimeline}
            selected={selectedSlots}
            onToggle={(day, slot) =>
              onToggleSlot(day as NormalizedDay, {
                start_at: slot.start_at,
                end_at: slot.end_at,
                status: slot.status,
                timeKey: slot.timeKey ?? slot.start_at.slice(11, 16),
              })
            }
            timeFormatter={timeFormatter}
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-white/70 bg-white/95 p-5 text-neutral-text shadow-[0_18px_60px_rgba(21,93,252,0.14)]">
        <h3 className="text-sm font-semibold">選択済み候補</h3>
        {selectedSlots.length ? (
          <ul className="mt-3 space-y-3">{selectedSlotList}</ul>
        ) : (
          <div className="mt-3 rounded-[24px] border border-dashed border-brand-primary/30 bg-brand-primary/5 px-4 py-6 text-center text-xs text-brand-primary">
            候補枠が未選択です。空き時間を追加してください。
          </div>
        )}
        {variant === 'form' ? (
          <button
            type="button"
            onClick={handleMobileAdvance}
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(37,99,235,0.22)] transition hover:from-brand-primary/90 hover:to-brand-secondary/90 lg:hidden"
          >
            入力フォームへ進む
          </button>
        ) : null}
      </div>
    </div>
  )
}

function LegendItem({
  tone,
  children,
}: {
  tone: 'available' | 'tentative' | 'blocked'
  children: string
}) {
  const icon =
    tone === 'available'
      ? '●'
      : tone === 'tentative'
        ? AVAILABILITY_STATUS_META.tentative.icon
        : AVAILABILITY_STATUS_META.blocked.icon
  const classes =
    tone === 'available'
      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600'
      : tone === 'tentative'
        ? 'border-amber-500/40 bg-amber-500/15 text-amber-600'
        : 'border-neutral-borderLight/70 bg-neutral-borderLight/30 text-neutral-textMuted'
  return (
    <div className="flex items-center gap-3">
      <span
        className={clsx(
          'inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold',
          classes,
        )}
      >
        {icon}
      </span>
      <span className="text-xs text-neutral-text">{children}</span>
    </div>
  )
}
