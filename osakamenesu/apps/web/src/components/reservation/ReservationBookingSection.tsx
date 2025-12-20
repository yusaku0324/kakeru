'use client'

import clsx from 'clsx'
import { Dispatch, SetStateAction } from 'react'

import type { SelectedSlot } from '@/components/calendar/AvailabilityPickerDesktop'
import type { AvailabilityStatus, CalendarTime } from '@/components/calendar/types'

import { parseJstDateAtMidnight } from '@/lib/jst'
import { RESERVATION_LEGEND_ITEMS } from './constants'
import {
  ReservationAvailabilitySection,
  ReservationScheduleHeader,
  SelectedSlotList,
} from './sections'
import type { NormalizedDay, NormalizedSlot, TimelineEntry } from './types'

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
  slotDurationMinutes?: number
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
  slotDurationMinutes,
}: ReservationBookingSectionProps) {
  const containerClass = clsx(
    variant === 'form' && formTab === 'info' ? 'hidden lg:flex lg:flex-col' : 'flex flex-col',
    'gap-6',
    className,
  )

  const monthLabel = currentScheduleDays[0]
    ? (() => {
        const date = parseJstDateAtMidnight(currentScheduleDays[0].date)
        if (Number.isNaN(date.getTime())) return ''
        return `${date.getFullYear()}年${date.getMonth() + 1}月`
      })()
    : ''

  const safeTimeline = Array.isArray(timeline) ? timeline : []
  const isPrevDisabled = schedulePage === 0
  const isNextDisabled = schedulePage >= schedulePageCount - 1

  const handlePrevPage = () => setSchedulePage((prev) => Math.max(prev - 1, 0))
  const handleNextPage = () => setSchedulePage((prev) => Math.min(prev + 1, schedulePageCount - 1))
  const handleResetPage = () => setSchedulePage(0)

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
        <ReservationScheduleHeader
          scheduleRangeLabel={scheduleRangeLabel}
          currentMonthLabel={monthLabel}
          schedulePage={schedulePage}
          schedulePageCount={schedulePageCount}
          canGoPrev={isPrevDisabled}
          canGoNext={isNextDisabled}
          onPrev={handlePrevPage}
          onNext={handleNextPage}
          onReset={handleResetPage}
          hasAvailability={hasAvailability}
        />
        <div className="mt-5">
          <ReservationAvailabilitySection
            days={currentScheduleDays}
            timeline={safeTimeline as TimelineEntry[]}
            selected={selectedSlots}
            onToggle={(day, slot) => onToggleSlot(day as NormalizedDay, slot)}
            timeFormatter={timeFormatter}
            legendItems={RESERVATION_LEGEND_ITEMS}
            slotDurationMinutes={slotDurationMinutes}
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-white/70 bg-white/95 p-5 text-neutral-text shadow-[0_18px_60px_rgba(21,93,252,0.14)]">
        <h3 className="text-sm font-semibold">選択済み候補</h3>
        <div className="mt-3">
          <SelectedSlotList
            slots={selectedSlots}
            dayFormatter={dayFormatter}
            timeFormatter={timeFormatter}
            statusBadgeClasses={statusBadgeClasses}
            emptyMessage="候補枠が未選択です。空き時間を追加してください。"
            onRemove={onRemoveSlot}
          />
        </div>
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
