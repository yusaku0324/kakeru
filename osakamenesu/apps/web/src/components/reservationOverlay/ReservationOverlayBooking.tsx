import clsx from 'clsx'
import type { ComponentProps } from 'react'

import ReservationForm from '@/components/ReservationForm'
import { AvailabilityPickerDesktop } from '@/components/calendar/AvailabilityPickerDesktop'
import { AvailabilityPickerMobile } from '@/components/calendar/AvailabilityPickerMobile'
import { AVAILABILITY_STATUS_META, type AvailabilityStatus } from '@/components/calendar/types'
import type { TherapistHit } from '@/components/staff/TherapistCard'

import type { ReservationOverlayProps } from '../ReservationOverlay'
import type { ReservationOverlayState } from './useReservationOverlayState'

type ContactItem = {
  key: string
  label: string
  value: string
  helper: string
}

type ReservationOverlayBookingProps = {
  hit: TherapistHit
  tel?: ReservationOverlayProps['tel']
  lineId?: ReservationOverlayProps['lineId']
  defaultStart?: ReservationOverlayProps['defaultStart']
  defaultDurationMinutes?: ReservationOverlayProps['defaultDurationMinutes']
  allowDemoSubmission?: ReservationOverlayProps['allowDemoSubmission']
  contactItems: ContactItem[]
  courseOptions: NonNullable<ComponentProps<typeof ReservationForm>['courseOptions']>
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
    hasAvailability,
    formOpen,
    formTab,
    setFormTab,
    handleFormBackdrop,
    closeForm,
  } = state

  const selectedSlotList = selectedSlots.map((slot, index) => {
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
              onClick={() =>
                toggleSlot(
                  {
                    date: slot.date,
                    label: dayFormatter.format(new Date(slot.date)),
                    isToday: false,
                    slots: [],
                  },
                  {
                    start_at: slot.startAt,
                    end_at: slot.endAt,
                    status: slot.status,
                    timeKey: slot.startAt.slice(11, 16),
                  },
                )
              }
              className="text-xs font-semibold text-brand-primary underline-offset-2 hover:underline"
            >
              削除
            </button>
          </div>
        </div>
      </li>
    )
  })

  return (
    <>
      <div className="space-y-6 px-4 pb-6 text-sm text-neutral-text">
        <div className="rounded-[32px] bg-gradient-to-br from-[#eef4ff] via-white to-white p-6 shadow-[0_24px_80px_rgba(37,99,235,0.18)] ring-1 ring-white/60">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-neutral-text">希望日時を選択</h3>
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
              <div className="text-sm text-neutral-text">{currentMonthLabel}</div>
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
                    : 'border border-brand-primary/20 bg-white text-brand-primary hover:border-brand-primary/40',
                )}
              >
                今週
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <div className="hidden lg:block">
              <AvailabilityPickerDesktop
                days={currentScheduleDays}
                timeline={timelineTimes ?? []}
                selected={selectedSlots}
                onToggle={toggleSlot}
                timeFormatter={timeFormatter}
              />
            </div>
            <div className="lg:hidden">
              <AvailabilityPickerMobile
                days={currentScheduleDays}
                timeline={timelineTimes ?? []}
                selected={selectedSlots}
                onToggle={toggleSlot}
                timeFormatter={timeFormatter}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-white/60 bg-white/80 px-4 py-2 text-[11px] text-neutral-text">
              {legendItems.map((item) => (
                <span
                  key={item.key}
                  className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white px-3 py-1"
                >
                  <span className={clsx('inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs', item.iconClass)}>
                    {item.icon}
                  </span>
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4 rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_18px_60px_rgba(21,93,252,0.12)]">
            <h4 className="text-sm font-semibold text-neutral-text">選択中の候補</h4>
            {selectedSlots.length ? (
              <ul className="space-y-3">{selectedSlotList}</ul>
            ) : (
              <div className="rounded-[24px] border border-dashed border-brand-primary/30 bg-brand-primary/5 px-4 py-6 text-center text-xs text-brand-primary">
                候補枠が選択されていません。時間をタップして追加してください。
              </div>
            )}
            <p className="text-[11px] text-neutral-textMuted">
              最大3枠まで提示できます。フォーム送信後は担当者が調整して折り返します。
            </p>
          </div>
          <div className="space-y-4">
            <div className="rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_18px_60px_rgba(21,93,252,0.12)]">
              <h4 className="text-sm font-semibold text-neutral-text">お問い合わせ方法</h4>
              <ul className="mt-4 space-y-3 text-sm">
                {contactItems.map((item) => (
                  <li
                    key={item.key}
                    className="flex flex-col gap-1 rounded-[24px] border border-white/70 bg-white/90 px-4 py-3 shadow-sm shadow-brand-primary/10"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-neutral-text">{item.label}</span>
                      <span className="text-xs font-semibold text-brand-primary">{item.value}</span>
                    </div>
                    <span className="text-[11px] text-neutral-textMuted">{item.helper}</span>
                  </li>
                ))}
              </ul>
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

      {formOpen ? (
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
                      <div className="mt-4 hidden md:block">
                        <AvailabilityPickerDesktop
                          days={currentScheduleDays}
                          timeline={timelineTimes ?? []}
                          selected={selectedSlots}
                          onToggle={toggleSlot}
                          timeFormatter={timeFormatter}
                        />
                      </div>
                      <div className="md:hidden">
                        <AvailabilityPickerMobile
                          days={currentScheduleDays}
                          timeline={timelineTimes ?? []}
                          selected={selectedSlots}
                          onToggle={toggleSlot}
                          timeFormatter={timeFormatter}
                        />
                      </div>
                    </div>
                    <div className="rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-[0_18px_60px_rgba(21,93,252,0.14)]">
                      <h3 className="text-sm font-semibold text-neutral-text">選択済み候補</h3>
                      {selectedSlots.length ? (
                        <ul className="mt-3 space-y-3">{selectedSlotList}</ul>
                      ) : (
                        <div className="mt-3 rounded-[24px] border border-dashed border-brand-primary/30 bg-brand-primary/5 px-4 py-6 text-center text-xs text-brand-primary">
                          候補枠が未選択です。空き時間を追加してください。
                        </div>
                      )}
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
      ) : null}
    </>
  )
}
