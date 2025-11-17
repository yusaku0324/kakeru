'use client'

import Link from 'next/link'
import { useState } from 'react'

import ReservationContactBar from '../ReservationContactBar'

import type { ReservationSummaryPayload } from './useReservationForm'

type ReservationSubmissionDetailsProps = {
  contactCount: number
  lastSuccess: Date | null
  lastReservationId: string | null
  shopId: string
  tel?: string | null
  lineId?: string | null
  shopName?: string | null
  lastPayload: ReservationSummaryPayload | null
  summaryText: string | null
  copySummary: () => Promise<boolean>
  canSubmit: boolean
  hasContactChannels: boolean
}

export default function ReservationSubmissionDetails({
  contactCount,
  lastSuccess,
  lastReservationId,
  shopId,
  tel,
  lineId,
  shopName,
  lastPayload,
  summaryText,
  copySummary,
  canSubmit,
  hasContactChannels,
}: ReservationSubmissionDetailsProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')

  async function handleCopy() {
    const success = await copySummary()
    if (!success) return
    setCopyState('copied')
    setTimeout(() => setCopyState('idle'), 2000)
  }

  return (
    <div className="space-y-3 text-xs text-neutral-textMuted">
      {contactCount > 0 && lastSuccess ? (
        <div className="rounded-[20px] border border-white/60 bg-white/85 px-4 py-3 text-neutral-text">
          直近の送信: {lastSuccess.toLocaleString('ja-JP')}
          {lastReservationId ? (
            <>
              {' / '}
              <Link
                href={`/thank-you?reservation=${lastReservationId}&shop=${shopId}`}
                className="text-brand-primary hover:underline"
              >
                サンクスページを見る
              </Link>
            </>
          ) : null}
        </div>
      ) : (
        <div className="rounded-[20px] border border-white/60 bg-white/85 px-4 py-3 text-neutral-text">
          店舗からの折り返しをお待ちください。同一内容の複数送信はお控えください。
        </div>
      )}

      {summaryText ? (
        <div className="space-y-2 rounded-[24px] border border-white/60 bg-white/90 px-4 py-3 text-neutral-text shadow-sm shadow-brand-primary/10">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-neutral-text">送信内容メモ</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-full border border-brand-primary/30 px-3 py-1 text-[11px] font-semibold text-brand-primary transition hover:border-brand-primary hover:bg-brand-primary/10"
            >
              {copyState === 'copied' ? 'コピーしました' : 'コピーする'}
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-neutral-textMuted">
            {summaryText}
          </pre>
        </div>
      ) : null}

      {hasContactChannels ? (
        <ReservationContactBar
          tel={tel}
          lineId={lineId}
          reservationId={lastReservationId}
          shopName={shopName}
          lastPayload={lastPayload}
        />
      ) : null}

      {!canSubmit ? (
        <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-red-600">
          この店舗はデモデータのため、予約リクエストの送信は無効化されています。
        </div>
      ) : null}
    </div>
  )
}
