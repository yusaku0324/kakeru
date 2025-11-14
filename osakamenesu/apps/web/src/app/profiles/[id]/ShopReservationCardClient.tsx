"use client"

import Link from 'next/link'
import { useMemo } from 'react'

import ReservationContactBar from '@/components/ReservationContactBar'
import type { ReservationOverlayProps } from '@/components/ReservationOverlay'
import { openReservationOverlay } from '@/components/reservationOverlayBus'

type ShopReservationCardClientProps = {
  tel?: string | null
  lineId?: string | null
  shopName: string
  description?: string
  selectedSlotLabel?: string | null
  clearHref?: string | null
  overlay: Omit<ReservationOverlayProps, 'onClose'>
}

export default function ShopReservationCardClient({
  tel,
  lineId,
  shopName,
  description,
  selectedSlotLabel,
  clearHref,
  overlay,
}: ShopReservationCardClientProps) {
  const hasContact = useMemo(() => Boolean(tel || lineId), [tel, lineId])
  const helperText = description ?? 'フォーム送信後は店舗担当者からの折り返しをもってご予約確定となります。24時間受付しています。'

  return (
    <div className="space-y-4">
      {selectedSlotLabel ? (
        <div className="space-y-1 rounded-card border border-brand-primary/30 bg-brand-primary/5 px-3 py-2 text-xs text-brand-primaryDark">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>選択中の枠: {selectedSlotLabel}</span>
            {clearHref ? (
              <Link href={clearHref} className="text-[11px] font-semibold text-brand-primary hover:underline">
                クリア
              </Link>
            ) : null}
          </div>
          <span className="text-[11px] text-brand-primary/70">フォームで変更できます</span>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => openReservationOverlay(overlay)}
        className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(37,99,235,0.28)] transition hover:from-brand-primary/90 hover:to-brand-secondary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/60"
      >
        Web予約する
      </button>
      <p className="text-[11px] leading-relaxed text-neutral-textMuted">{helperText}</p>
      {hasContact ? (
        <div className="rounded-card border border-neutral-borderLight bg-white/80 p-3">
          <div className="mb-2 text-xs font-semibold text-neutral-textMuted">電話・LINEでのお問い合わせ</div>
          <ReservationContactBar tel={tel || undefined} lineId={lineId || undefined} shopName={shopName} />
        </div>
      ) : null}
    </div>
  )
}
