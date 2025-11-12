"use client"

import clsx from 'clsx'
import Link from 'next/link'

import { Card } from '@/components/ui/Card'
import { getReservationStatusLabel, RESERVATION_STATUS_BADGES } from './status'
import type { LatestReservationSnapshot } from './storage'

type ReservationStatusCardProps = {
  shopId: string
  slug?: string | null
  snapshot: LatestReservationSnapshot | null
  className?: string
}

export default function ReservationStatusCard({
  shopId,
  slug,
  snapshot,
  className,
}: ReservationStatusCardProps) {
  const statusLabel = snapshot?.status ? getReservationStatusLabel(snapshot.status) : null
  const statusBadgeClass = statusLabel
    ? RESERVATION_STATUS_BADGES[snapshot?.status ?? ''] ?? 'bg-neutral-200 text-neutral-600 border border-neutral-300'
    : null
  const submittedAtLabel = snapshot?.submittedAt
    ? (() => {
        const date = new Date(snapshot.submittedAt!)
        return Number.isNaN(date.getTime()) ? null : date.toLocaleString('ja-JP')
      })()
    : null

  return (
    <Card className={clsx('p-6', className)}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-neutral-900">最新の予約状況</h2>
          <Link
            href={slug ? `/profiles/${slug}` : `/profiles/${shopId}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-primary hover:underline"
          >
            公開ページで確認
          </Link>
        </div>
        <p className="text-sm text-neutral-600">
          Web 予約フォームから最後に受け付けたリクエストのステータスです。承認／辞退を行うと即座に更新され、下の履歴には送信順で一覧表示されます。
        </p>

        {snapshot ? (
          <div className="space-y-2 rounded-[22px] border border-neutral-borderLight/70 bg-white/90 px-4 py-3 text-sm text-neutral-text shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-textMuted">
              <span>予約 ID</span>
              <span className="font-mono text-sm text-neutral-text">
                {snapshot.reservationId ?? '---'}
              </span>
            </div>
            {statusLabel ? (
              <span
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold',
                  statusBadgeClass,
                )}
              >
                {statusLabel}
              </span>
            ) : (
              <span className="text-xs text-neutral-textMuted">ステータスは未取得です。</span>
            )}
            {submittedAtLabel ? (
              <div className="text-xs text-neutral-textMuted">
                最終更新: <span>{submittedAtLabel}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-[22px] border border-dashed border-neutral-borderLight/70 bg-white/80 px-4 py-3 text-sm text-neutral-textMuted">
            まだ予約リクエストが登録されていません。Web 予約が届くとここに最新のステータスが表示されます。
          </div>
        )}
      </div>
    </Card>
  )
}
