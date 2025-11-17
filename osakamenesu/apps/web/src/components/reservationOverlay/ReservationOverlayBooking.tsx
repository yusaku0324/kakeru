import type { ComponentProps } from 'react'

import type ReservationFormComponent from '@/components/ReservationForm'
import { AVAILABILITY_STATUS_META, type AvailabilityStatus } from '@/components/calendar/types'
import type { TherapistHit } from '@/components/staff/TherapistCard'

import type { ReservationOverlayProps } from '../ReservationOverlay'
import { ReservationBookingModal } from './ReservationBookingModal'
import {
  ReservationAvailabilitySection,
  ReservationScheduleHeader,
  ReservationContactList,
  SelectedSlotList,
  type ReservationContactItem,
} from './sections'
import type { ReservationOverlayState } from './useReservationOverlayState'

type ReservationOverlayBookingProps = {
  hit: TherapistHit
  tel?: ReservationOverlayProps['tel']
  lineId?: ReservationOverlayProps['lineId']
  defaultStart?: ReservationOverlayProps['defaultStart']
  defaultDurationMinutes?: ReservationOverlayProps['defaultDurationMinutes']
  allowDemoSubmission?: ReservationOverlayProps['allowDemoSubmission']
  contactItems: ReservationContactItem[]
  courseOptions: NonNullable<ComponentProps<typeof ReservationFormComponent>['courseOptions']>
  onOpenForm: () => void
  state: ReservationOverlayState
}

const legendItems = [
  {
    key: 'open',
    label: AVAILABILITY_STATUS_META.open.label,
    icon: '●',
    iconClass: 'border-emerald-400 bg-emerald-500 text-white',
  },
  {
    key: 'tentative',
    label: AVAILABILITY_STATUS_META.tentative.label,
    icon: AVAILABILITY_STATUS_META.tentative.icon,
    iconClass: 'border-amber-300 bg-amber-100 text-amber-600',
  },
  {
    key: 'blocked',
    label: AVAILABILITY_STATUS_META.blocked.label,
    icon: AVAILABILITY_STATUS_META.blocked.icon,
    iconClass: 'border-white/70 bg-white text-neutral-textMuted',
  },
] as const

const statusBadgeClasses: Record<AvailabilityStatus, string> = {
  open: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600',
  tentative: 'border-amber-500/40 bg-amber-500/15 text-amber-600',
  blocked: 'border-neutral-borderLight/70 bg-neutral-borderLight/30 text-neutral-textMuted',
}

const bookingSteps = [
  { key: 'schedule', label: '日程選択', description: 'ご希望の日時をタップ' },
  { key: 'course', label: 'コース選択', description: '希望コース・オプション' },
  { key: 'info', label: 'お客様情報', description: '連絡先と要望を入力' },
] as const

export default function ReservationOverlayBooking({
  hit,
  tel,
  lineId,
  defaultStart,
  defaultDurationMinutes,
  allowDemoSubmission,
  contactItems,
  courseOptions,
  onOpenForm,
  state,
}: ReservationOverlayBookingProps) {
  const {
    dayFormatter,
    timeFormatter,
    scheduleRangeLabel,
    currentMonthLabel,
    schedulePage,
    schedulePageCount,
    setSchedulePage,
    currentScheduleDays,
    timelineTimes,
    selectedSlots,
    toggleSlot,
    removeSlot,
    hasAvailability,
  } = state

  const canGoPrev = schedulePage === 0
  const canGoNext = schedulePage >= schedulePageCount - 1

  const handlePrevPage = () => setSchedulePage((prev) => Math.max(prev - 1, 0))
  const handleNextPage = () => setSchedulePage((prev) => Math.min(prev + 1, schedulePageCount - 1))
  const handleResetPage = () => setSchedulePage(0)

  return (
    <>
      <div className="space-y-6 px-4 pb-6 text-sm text-neutral-text">
        <div className="rounded-[32px] bg-gradient-to-br from-[#eef4ff] via-white to-white p-6 shadow-[0_24px_80px_rgba(37,99,235,0.18)] ring-1 ring-white/60">
          <ReservationScheduleHeader
            scheduleRangeLabel={scheduleRangeLabel}
            currentMonthLabel={currentMonthLabel}
            schedulePage={schedulePage}
            schedulePageCount={schedulePageCount}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            onPrev={handlePrevPage}
            onNext={handleNextPage}
            onReset={handleResetPage}
            hasAvailability={hasAvailability}
          />

          <ReservationAvailabilitySection
            className="mt-6"
            days={currentScheduleDays}
            timeline={timelineTimes}
            selected={selectedSlots}
            onToggle={toggleSlot}
            timeFormatter={timeFormatter}
            legendItems={legendItems}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4 rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_18px_60px_rgba(21,93,252,0.12)]">
            <h4 className="text-sm font-semibold text-neutral-text">選択中の候補</h4>
            <SelectedSlotList
              slots={selectedSlots}
              dayFormatter={dayFormatter}
              timeFormatter={timeFormatter}
              statusBadgeClasses={statusBadgeClasses}
              emptyMessage="候補枠が選択されていません。時間をタップして追加してください。"
              onRemove={removeSlot}
            />
            <p className="text-[11px] text-neutral-textMuted">
              最大3枠まで提示できます。フォーム送信後は担当者が調整して折り返します。
            </p>
          </div>
          <div className="space-y-4">
            <div className="rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_18px_60px_rgba(21,93,252,0.12)]">
              <h4 className="text-sm font-semibold text-neutral-text">お問い合わせ方法</h4>
              <ReservationContactList items={contactItems} />
            </div>
            <button
              type="button"
              onClick={onOpenForm}
              className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(37,99,235,0.25)] transition hover:from-brand-primary/90 hover:to-brand-secondary/90"
            >
              予約フォームに進む
            </button>
          </div>
        </div>
      </div>

      <ReservationBookingModal
        hit={hit}
        tel={tel}
        lineId={lineId}
        defaultStart={defaultStart}
        defaultDurationMinutes={defaultDurationMinutes}
        allowDemoSubmission={allowDemoSubmission}
        courseOptions={courseOptions}
        legendItems={legendItems}
        state={state}
        onRemoveSlot={removeSlot}
        bookingSteps={bookingSteps}
        statusBadgeClasses={statusBadgeClasses}
      />
    </>
  )
}
