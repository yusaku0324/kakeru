import type { ComponentProps } from 'react'
import clsx from 'clsx'

import ReservationForm from '@/components/ReservationForm'
import type { AvailabilityStatus } from '@/components/calendar/types'

import { ReservationAvailabilitySection, SelectedSlotList } from './sections'
import type { ReservationOverlayProps } from '../ReservationOverlay'
import type { ReservationOverlayState } from './useReservationOverlayState'

type LegendItem = {
  key: string
  label: string
  icon: string
  iconClass: string
}

type BookingStep = {
  key: string
  label: string
  description: string
}

type ReservationBookingModalProps = {
  hit: ReservationOverlayProps['hit']
  tel?: ReservationOverlayProps['tel']
  lineId?: ReservationOverlayProps['lineId']
  defaultStart?: ReservationOverlayProps['defaultStart']
  defaultDurationMinutes?: ReservationOverlayProps['defaultDurationMinutes']
  allowDemoSubmission?: ReservationOverlayProps['allowDemoSubmission']
  courseOptions: NonNullable<ComponentProps<typeof ReservationForm>['courseOptions']>
  legendItems: readonly LegendItem[]
  state: ReservationOverlayState
  onRemoveSlot: (startAt: string) => void
  bookingSteps: readonly BookingStep[]
  statusBadgeClasses: Record<AvailabilityStatus, string>
}

export function ReservationBookingModal({
  hit,
  tel,
  lineId,
  defaultStart,
  defaultDurationMinutes,
  allowDemoSubmission,
  courseOptions,
  legendItems,
  state,
  onRemoveSlot,
  bookingSteps,
  statusBadgeClasses,
}: ReservationBookingModalProps) {
  const {
    formOpen,
    closeForm,
    handleFormBackdrop,
    formTab,
    setFormTab,
    currentScheduleDays,
    timelineTimes,
    selectedSlots,
    toggleSlot,
    dayFormatter,
    timeFormatter,
  } = state

  if (!formOpen) return null

  return (
    <div className="fixed inset-0 z-[999] overflow-y-auto bg-neutral-950/60 backdrop-blur-sm">
      <div className="relative mx-auto flex min-h-full max-w-4xl flex-col justify-center px-4 py-10 sm:px-6 sm:py-14">
        <div className="absolute inset-0" onClick={handleFormBackdrop} aria-hidden="true" />
        <div
          className="relative z-10 overflow-hidden rounded-[32px] border border-white/40 bg-white/98 shadow-[0_36px_120px_rgba(21,93,252,0.32)]"
          role="dialog"
          aria-modal="true"
          aria-label={`${hit.name}の予約フォーム`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-4 border-b border-white/60 bg-white/90 px-6 py-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-primary">
                Reservation
              </div>
              <h2 className="text-lg font-semibold text-neutral-text">{hit.name}の予約フォーム</h2>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/95 text-neutral-text shadow-sm shadow-brand-primary/10 transition hover:border-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/40"
              aria-label="予約フォームを閉じる"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6 p-6 sm:p-8">
            <div className="rounded-[28px] border border-white/70 bg-white/95 p-4">
              <ol className="flex flex-wrap items-center gap-3 text-xs font-semibold text-neutral-textMuted">
                {bookingSteps.map((step, index) => (
                  <li key={step.key} className="flex items-center gap-2">
                    <span
                      className={clsx(
                        'inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/70 bg-white text-sm',
                        (formTab === 'schedule' && step.key === 'schedule') ||
                          (formTab === 'info' && step.key !== 'schedule')
                          ? 'border-brand-primary bg-brand-primary text-white shadow-[0_8px_25px_rgba(21,93,252,0.25)]'
                          : 'text-brand-primary',
                      )}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-neutral-text">{step.label}</div>
                      <div className="text-[10px] text-neutral-textMuted">{step.description}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex flex-col gap-3 rounded-[24px] border border-white/70 bg-white/90 p-2 lg:hidden">
              <button
                type="button"
                onClick={() => setFormTab('schedule')}
                className={clsx(
                  'rounded-[20px] px-4 py-2 text-sm font-semibold',
                  formTab === 'schedule'
                    ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-[0_12px_40px_rgba(37,99,235,0.25)]'
                    : 'text-neutral-text hover:bg-white',
                )}
              >
                日程・コース
              </button>
              <button
                type="button"
                onClick={() => setFormTab('info')}
                className={clsx(
                  'rounded-[20px] px-4 py-2 text-sm font-semibold',
                  formTab === 'info'
                    ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-[0_12px_40px_rgba(37,99,235,0.25)]'
                    : 'text-neutral-text hover:bg-white',
                )}
              >
                お客様情報
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <div className={clsx('flex flex-col gap-5', formTab === 'info' ? 'hidden lg:flex' : 'flex')}>
                <div className="rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-[0_18px_60px_rgba(21,93,252,0.14)]">
                  <h3 className="text-sm font-semibold text-neutral-text">候補枠の調整</h3>
                  <p className="mt-1 text-[11px] text-neutral-textMuted">
                    希望時間をタップして候補に追加してください。最大3枠まで登録できます。
                  </p>
                  <ReservationAvailabilitySection
                    className="mt-4"
                    days={currentScheduleDays}
                    timeline={timelineTimes ?? []}
                    selected={selectedSlots}
                    onToggle={toggleSlot}
                    timeFormatter={timeFormatter}
                    legendItems={legendItems}
                  />
                </div>
                <div className="rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-[0_18px_60px_rgba(21,93,252,0.14)]">
                  <h3 className="text-sm font-semibold text-neutral-text">選択済み候補</h3>
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
                  <button
                    type="button"
                    onClick={() => setFormTab('info')}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(37,99,235,0.22)] transition hover:from-brand-primary/90 hover:to-brand-secondary/90 lg:hidden"
                  >
                    入力フォームへ進む
                  </button>
                </div>
              </div>

              <div className={clsx('flex flex-col gap-4', formTab === 'schedule' ? 'hidden lg:flex' : 'flex')}>
                <div className="rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-[0_18px_60px_rgba(21,93,252,0.14)]">
                  <ReservationForm
                    shopId={hit.shopId}
                    shopName={hit.shopName}
                    staffId={hit.therapistId ?? hit.staffId}
                    tel={tel ?? undefined}
                    lineId={lineId ?? undefined}
                    defaultStart={selectedSlots[0]?.startAt ?? defaultStart ?? undefined}
                    defaultDurationMinutes={defaultDurationMinutes ?? undefined}
                    allowDemoSubmission={allowDemoSubmission}
                    selectedSlots={selectedSlots}
                    courseOptions={courseOptions}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
