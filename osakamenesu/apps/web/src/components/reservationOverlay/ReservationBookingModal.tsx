import type { ComponentProps } from 'react'
import clsx from 'clsx'

import ReservationForm from '@/components/ReservationForm'
import type { AvailabilityStatus } from '@/components/calendar/types'

import { RESERVATION_LEGEND_ITEMS } from '@/components/reservation/constants'
import { ReservationAvailabilitySection, SelectedSlotList } from '@/components/reservation'
import type { ReservationOverlayProps } from '../ReservationOverlay'
import type { ReservationOverlayState } from './useReservationOverlayState'

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
    availabilitySourceType,
  } = state

  // Calculate step completion status based on actual data
  // Step 1: Complete when at least one slot is selected
  const isScheduleComplete = selectedSlots.length > 0
  // Step 2: Course is auto-selected by default, so complete when on info tab with schedule done
  // Step 3: Active when on info tab (personal info being filled)

  if (!formOpen) return null

  return (
    <div className="fixed inset-0 z-[999] overflow-y-auto bg-neutral-950/70 backdrop-blur-md">
      <div className="relative mx-auto flex min-h-full max-w-4xl flex-col justify-center px-4 py-10 sm:px-6 sm:py-14">
        <div className="absolute inset-0" onClick={handleFormBackdrop} aria-hidden="true" />
        <div
          className="relative z-10 overflow-hidden rounded-[36px] border border-white/50 bg-white/95 shadow-[0_50px_150px_rgba(37,99,235,0.35)] backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          aria-label={`${hit.name}の予約フォーム`}
          onClick={(event) => event.stopPropagation()}
        >
          {/* Decorative gradient background */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_50%),radial-gradient(circle_at_bottom_right,rgba(147,51,234,0.1),transparent_50%)]" />

          <div className="relative flex items-center justify-between gap-4 border-b border-white/60 bg-gradient-to-r from-brand-primary/5 via-white/90 to-brand-secondary/5 px-6 py-5">
            <div className="flex items-center gap-4">
              {/* Animated badge */}
              <div className="relative">
                <div className="absolute inset-0 animate-pulse rounded-full bg-brand-primary/20 blur-md" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-[0_8px_24px_rgba(37,99,235,0.3)]">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-primary animate-pulse" />
                  予約リクエスト
                </div>
                <h2 className="mt-1 text-xl font-bold text-neutral-text">{hit.name}</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/95 text-neutral-textMuted shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-500 hover:shadow-[0_6px_16px_rgba(239,68,68,0.15)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/40"
              aria-label="予約フォームを閉じる"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="relative space-y-6 p-6 sm:p-8">
            {/* Progress Steps */}
            <div className="rounded-[28px] border border-white/60 bg-gradient-to-r from-brand-primary/5 via-white to-brand-secondary/5 p-5 shadow-[0_8px_32px_rgba(37,99,235,0.08)]">
              <ol className="flex flex-wrap items-center justify-between gap-4 text-xs font-semibold">
                {bookingSteps.map((step, index) => {
                  // Determine step status based on actual completion state
                  const getStepStatus = (): 'active' | 'complete' | 'pending' => {
                    if (step.key === 'schedule') {
                      // Schedule is complete when slots are selected, active when on schedule tab
                      if (isScheduleComplete) return 'complete'
                      if (formTab === 'schedule') return 'active'
                      return 'pending'
                    }
                    if (step.key === 'course') {
                      // Course is complete when on info tab (course auto-selected by default)
                      if (formTab === 'info') return 'complete'
                      if (isScheduleComplete) return 'active'
                      return 'pending'
                    }
                    if (step.key === 'info') {
                      // Personal info is active when on info tab
                      if (formTab === 'info') return 'active'
                      return 'pending'
                    }
                    return 'pending'
                  }
                  const stepStatus = getStepStatus()
                  const isActive = stepStatus === 'active'
                  const isPast = stepStatus === 'complete'
                  return (
                    <li key={step.key} className="relative flex flex-1 items-center gap-3">
                      {index > 0 && (
                        <div className={clsx(
                          'absolute -left-4 top-1/2 h-0.5 w-8 -translate-y-1/2',
                          isPast || isActive ? 'bg-gradient-to-r from-brand-primary to-brand-secondary' : 'bg-neutral-200'
                        )} />
                      )}
                      <div className="relative">
                        {isActive && (
                          <div className="absolute inset-0 animate-ping rounded-full bg-brand-primary/30" />
                        )}
                        <span
                          className={clsx(
                            'relative inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-300',
                            isActive
                              ? 'bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-[0_8px_24px_rgba(37,99,235,0.35)]'
                              : isPast
                              ? 'bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.25)]'
                              : 'border-2 border-neutral-200 bg-white text-neutral-400',
                          )}
                        >
                          {isPast ? (
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            index + 1
                          )}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className={clsx(
                          'text-sm font-bold',
                          isActive ? 'text-brand-primary' : isPast ? 'text-emerald-600' : 'text-neutral-400'
                        )}>
                          {step.label}
                        </div>
                        <div className="truncate text-[10px] text-neutral-textMuted">{step.description}</div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>

            {/* Mobile Tab Switcher */}
            <div className="flex gap-2 rounded-[24px] border border-white/60 bg-white/90 p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.06)] lg:hidden">
              <button
                type="button"
                onClick={() => setFormTab('schedule')}
                className={clsx(
                  'flex flex-1 items-center justify-center gap-2 rounded-[20px] px-4 py-3 text-sm font-bold transition-all duration-200',
                  formTab === 'schedule'
                    ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-[0_8px_24px_rgba(37,99,235,0.3)]'
                    : 'text-neutral-textMuted hover:bg-neutral-50 hover:text-neutral-text',
                )}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                日程選択
              </button>
              <button
                type="button"
                onClick={() => setFormTab('info')}
                className={clsx(
                  'flex flex-1 items-center justify-center gap-2 rounded-[20px] px-4 py-3 text-sm font-bold transition-all duration-200',
                  formTab === 'info'
                    ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-[0_8px_24px_rgba(37,99,235,0.3)]'
                    : 'text-neutral-textMuted hover:bg-neutral-50 hover:text-neutral-text',
                )}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                お客様情報
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              {/* Schedule Selection Column */}
              <div className={clsx('flex flex-col gap-5', formTab === 'info' ? 'hidden lg:flex' : 'flex')}>
                <div className="overflow-hidden rounded-[28px] border border-white/60 bg-gradient-to-br from-white via-white to-brand-primary/5 shadow-[0_18px_60px_rgba(21,93,252,0.14)]">
                  <div className="border-b border-white/60 bg-gradient-to-r from-brand-primary/10 to-transparent px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-neutral-text">候補枠の調整</h3>
                        <p className="text-[11px] text-neutral-textMuted">希望時間をタップして候補に追加（最大3枠）</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-5">
                    <ReservationAvailabilitySection
                      days={currentScheduleDays}
                      timeline={timelineTimes}
                      selected={selectedSlots}
                      onToggle={toggleSlot}
                      timeFormatter={timeFormatter}
                      legendItems={RESERVATION_LEGEND_ITEMS}
                      showLegend={false}
                      availabilitySourceType={availabilitySourceType}
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-[28px] border border-white/60 bg-gradient-to-br from-white via-white to-emerald-50/50 shadow-[0_18px_60px_rgba(21,93,252,0.14)]">
                  <div className="border-b border-white/60 bg-gradient-to-r from-emerald-500/10 to-transparent px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h3 className="text-sm font-bold text-neutral-text">選択済み候補</h3>
                      </div>
                      {selectedSlots.length > 0 && (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600">
                          {selectedSlots.length}枠選択中
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-5">
                    <SelectedSlotList
                      slots={selectedSlots}
                      dayFormatter={dayFormatter}
                      timeFormatter={timeFormatter}
                      statusBadgeClasses={statusBadgeClasses}
                      emptyMessage="候補枠が未選択です。空き時間を追加してください。"
                      onRemove={onRemoveSlot}
                    />
                  </div>
                  <div className="border-t border-white/60 bg-white/50 px-5 py-4 lg:hidden">
                    <button
                      type="button"
                      onClick={() => setFormTab('info')}
                      disabled={selectedSlots.length === 0}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-4 py-3 text-sm font-bold text-white shadow-[0_12px_35px_rgba(37,99,235,0.3)] transition-all duration-200 hover:shadow-[0_16px_40px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      入力フォームへ進む
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Customer Info Column */}
              <div className={clsx('flex flex-col gap-4', formTab === 'schedule' ? 'hidden lg:flex' : 'flex')}>
                <div className="overflow-hidden rounded-[28px] border border-white/60 bg-gradient-to-br from-white via-white to-brand-secondary/5 shadow-[0_18px_60px_rgba(21,93,252,0.14)]">
                  <div className="border-b border-white/60 bg-gradient-to-r from-brand-secondary/10 to-transparent px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-secondary/10 text-brand-secondary">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-neutral-text">お客様情報</h3>
                        <p className="text-[11px] text-neutral-textMuted">連絡先とご要望を入力</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-5">
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
    </div>
  )
}
