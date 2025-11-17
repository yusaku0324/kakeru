'use client'

import clsx from 'clsx'
import { useMemo } from 'react'

import { Card } from '@/components/ui/Card'
import {
  ReservationBookingSection,
  RESERVATION_STATUS_BADGE_CLASSES,
} from '@/components/reservation'
import type { ReservationOverlayProps } from '@/components/ReservationOverlay'
import { useReservationOverlayState } from '@/components/reservationOverlay/useReservationOverlayState'

type DashboardReservationAvailabilityPreviewProps = {
  availabilityDays?: ReservationOverlayProps['availabilityDays']
  generatedAt?: string | null
  className?: string
}

export function DashboardReservationAvailabilityPreview({
  availabilityDays,
  generatedAt,
  className,
}: DashboardReservationAvailabilityPreviewProps) {
  const state = useReservationOverlayState({
    availabilityDays,
  })
  const updatedLabel = useMemo(() => {
    if (!generatedAt) return null
    const parsed = new Date(generatedAt)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }, [generatedAt])

  return (
    <Card
      className={clsx(
        'space-y-4 border border-brand-primary/20 bg-white/95 p-5 shadow-sm shadow-brand-primary/10',
        className,
      )}
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-neutral-text">空き状況プレビュー</h2>
        <p className="text-xs text-neutral-textMuted">
          公開ページと同じ空き枠レイアウトです。候補枠をタップして送信前の体験を確認できます。
        </p>
        {updatedLabel ? (
          <p className="text-[11px] text-neutral-textMuted/80">最終更新: {updatedLabel}</p>
        ) : null}
      </div>

      <ReservationBookingSection
        variant="inline"
        currentScheduleDays={state.currentScheduleDays}
        timeline={state.timelineTimes}
        selectedSlots={state.selectedSlots}
        dayFormatter={state.dayFormatter}
        timeFormatter={state.timeFormatter}
        statusBadgeClasses={RESERVATION_STATUS_BADGE_CLASSES}
        scheduleRangeLabel={state.scheduleRangeLabel}
        schedulePage={state.schedulePage}
        schedulePageCount={state.schedulePageCount}
        hasAvailability={state.hasAvailability}
        setSchedulePage={state.setSchedulePage}
        onToggleSlot={state.toggleSlot}
        onRemoveSlot={state.removeSlot}
        onEnsureSelection={state.ensureSelection}
      />

      {!state.hasAvailability ? (
        <p className="text-xs text-neutral-textMuted">
          公開されている空き枠がありません。プロフィールの空き状況を更新するとプレビューが表示されます。
        </p>
      ) : null}
    </Card>
  )
}
