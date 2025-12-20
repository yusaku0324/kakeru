'use client'

import { useMemo } from 'react'
import type { ReservationOverlayProps } from '@/components/ReservationOverlay'
import { openReservationOverlay } from '@/components/reservationOverlayBus'
import ReservationContactBar from '@/components/ReservationContactBar'

type StaffReservationClientProps = {
  tel?: string | null
  lineId?: string | null
  shopName: string
  overlay: Omit<ReservationOverlayProps, 'onClose'>
}

export default function StaffReservationClient({
  tel,
  lineId,
  shopName,
  overlay,
}: StaffReservationClientProps) {
  const hasContact = useMemo(() => Boolean(tel || lineId), [tel, lineId])

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => openReservationOverlay(overlay)}
        className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(37,99,235,0.28)] transition hover:from-brand-primary/90 hover:to-brand-secondary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/60"
      >
        空き状況を見る・予約する
      </button>
      <p className="text-[11px] leading-relaxed text-neutral-textMuted">
        フォーム送信後は店舗担当者からの折り返しをもってご予約確定となります。
      </p>
      {hasContact ? (
        <div className="rounded-card border border-neutral-borderLight bg-white/80 p-3">
          <div className="mb-2 text-xs font-semibold text-neutral-textMuted">
            電話・LINEでのお問い合わせ
          </div>
          <ReservationContactBar
            tel={tel || undefined}
            lineId={lineId || undefined}
            shopName={shopName}
          />
        </div>
      ) : null}
    </div>
  )
}
