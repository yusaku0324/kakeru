import { type ComponentProps, useEffect, useRef, useState } from 'react'

import type ReservationFormComponent from '@/components/ReservationForm'
import type { TherapistHit } from '@/components/staff/TherapistCard'

import type { ReservationOverlayProps } from '../ReservationOverlay'
import {
  RESERVATION_LEGEND_ITEMS,
  RESERVATION_STATUS_BADGE_CLASSES,
} from '@/components/reservation/constants'
import { ReservationBookingModal } from './ReservationBookingModal'
import {
  ReservationAvailabilitySection,
  ReservationScheduleHeader,
  ReservationContactList,
  SelectedSlotList,
  type ReservationContactItem,
} from '@/components/reservation'
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
  /** セラピストID（空き状況の再取得に使用） */
  therapistId?: string | null
  /** ポーリングによる更新中フラグ */
  isPolling?: boolean
  /** 最終更新時刻 (Unix timestamp in ms) */
  lastRefreshAt?: number | null
  /** 手動更新を実行するコールバック */
  onRefresh?: () => Promise<void>
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
  therapistId,
  isPolling = false,
  lastRefreshAt,
  onRefresh,
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
    availabilitySourceType,
    updateAvailability,
    isRefreshing,
  } = state

  // サンプルデータを使用しているかどうか
  const [isSampleData, setIsSampleData] = useState(false)

  // 最新の空き状況データを取得（コンポーネントマウント時）
  const hasFetchedRef = useRef(false)
  useEffect(() => {
    if (!therapistId || hasFetchedRef.current) return
    hasFetchedRef.current = true

    const fetchFreshAvailability = async () => {
      try {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        const resp = await fetch(
          `${baseUrl}/api/guest/therapists/${therapistId}/availability_slots`,
          { cache: 'no-store' }
        )
        if (!resp.ok) return
        const data = await resp.json()
        if (Array.isArray(data?.days)) {
          updateAvailability(data.days)
        }
        // サンプルデータフラグをチェック
        if (data?.sample === true) {
          setIsSampleData(true)
        }
      } catch (err) {
        console.warn('[ReservationOverlayBooking] Failed to fetch fresh availability:', err)
      }
    }

    fetchFreshAvailability()
  }, [therapistId, updateAvailability])

  const canGoPrev = schedulePage === 0
  const canGoNext = schedulePage >= schedulePageCount - 1

  const handlePrevPage = () => setSchedulePage((prev) => Math.max(prev - 1, 0))
  const handleNextPage = () => setSchedulePage((prev) => Math.min(prev + 1, schedulePageCount - 1))
  const handleResetPage = () => setSchedulePage(0)

  return (
    <>
      <div className="space-y-6 px-4 pb-6 text-sm text-neutral-text">
        {isSampleData && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="font-medium">サンプルデータを表示中</p>
                <p className="mt-0.5 text-xs text-amber-600">
                  実際の空き状況とは異なる場合があります。正確な予約可否は店舗にお問い合わせください。
                </p>
              </div>
            </div>
          </div>
        )}
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
            isRefreshing={isRefreshing || isPolling}
            lastRefreshAt={lastRefreshAt}
            onRefresh={onRefresh}
          />

          <ReservationAvailabilitySection
            className="mt-6"
            days={currentScheduleDays}
            timeline={timelineTimes}
            selected={selectedSlots}
            onToggle={toggleSlot}
            timeFormatter={timeFormatter}
            legendItems={RESERVATION_LEGEND_ITEMS}
            availabilitySourceType={availabilitySourceType}
            onRequestReservation={onOpenForm}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4 rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_18px_60px_rgba(21,93,252,0.12)]">
            <h4 className="text-sm font-semibold text-neutral-text">選択中の候補</h4>
            <SelectedSlotList
              slots={selectedSlots}
              dayFormatter={dayFormatter}
              timeFormatter={timeFormatter}
              statusBadgeClasses={RESERVATION_STATUS_BADGE_CLASSES}
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
        state={state}
        onRemoveSlot={removeSlot}
        bookingSteps={bookingSteps}
        statusBadgeClasses={RESERVATION_STATUS_BADGE_CLASSES}
      />
    </>
  )
}
