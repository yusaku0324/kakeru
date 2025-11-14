"use client"

import { useCallback, useMemo, useState } from 'react'

import {
  getReservationStatusDisplay,
  getReservationStatusLabel,
  RESERVATION_STATUS_BADGES,
} from '@/components/reservations/status'
import type { DashboardReservationItem } from '@/lib/dashboard-reservations'

type ReservationModalProps = {
  open: boolean
  reservation: DashboardReservationItem | null
  onClose: () => void
  onApprove: (reservation: DashboardReservationItem) => Promise<void>
  onDecline: (reservation: DashboardReservationItem) => Promise<void>
  filterSummary?: string | null
}

export function ReservationModal({ open, reservation, onClose, onApprove, onDecline, filterSummary }: ReservationModalProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied'>('idle')
  const [actionState, setActionState] = useState<'idle' | 'approving' | 'declining'>('idle')

  const statusLabel = useMemo(() => {
    if (!reservation) return null
    return getReservationStatusDisplay(reservation.status)
  }, [reservation])

  const statusClass = reservation ? RESERVATION_STATUS_BADGES[reservation.status] ?? 'bg-neutral-200 text-neutral-700 border border-neutral-300' : ''

  const preferredSlots = useMemo(() => {
    if (!reservation?.preferred_slots?.length) return []
    return reservation.preferred_slots.map((slot, index) => {
      const start = new Date(slot.desired_start)
      const end = new Date(slot.desired_end)
      const dateLabel = `${start.toLocaleDateString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short',
      })} ${start.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })}`
      const endLabel = end.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })
      const status = slot.status === 'open' ? '◎ 予約可' : slot.status === 'tentative' ? '△ 要確認' : '× 予約不可'
      return `第${index + 1}候補: ${dateLabel}〜${endLabel} (${status})`
    })
  }, [reservation])

  const detailsText = useMemo(() => {
    if (!reservation) return ''
    const lines = [
      `予約ID: ${reservation.id}`,
      `ステータス: ${getReservationStatusLabel(reservation.status) ?? reservation.status}`,
      `希望開始: ${new Date(reservation.desired_start).toLocaleString('ja-JP')}`,
      `希望終了: ${new Date(reservation.desired_end).toLocaleString('ja-JP')}`,
      `顧客名: ${reservation.customer_name}`,
      `電話番号: ${reservation.customer_phone}`,
      reservation.customer_email ? `メールアドレス: ${reservation.customer_email}` : null,
      reservation.notes ? `メモ:\n${reservation.notes}` : null,
      preferredSlots.length ? `希望候補:\n${preferredSlots.join('\n')}` : null,
    ].filter(Boolean)
    return lines.join('\n')
  }, [reservation, preferredSlots])

  const handleCopy = useCallback(async () => {
    if (!detailsText) return
    try {
      setCopyState('copying')
      await navigator.clipboard.writeText(detailsText)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('idle')
    }
  }, [detailsText])

  const handleApprove = useCallback(async () => {
    if (!reservation) return
    setActionState('approving')
    try {
      await onApprove(reservation)
    } catch {
      /* noop - エラーは親でトースト表示済み */
    } finally {
      setActionState('idle')
    }
  }, [onApprove, reservation])

  const handleDecline = useCallback(async () => {
    if (!reservation) return
    setActionState('declining')
    try {
      await onDecline(reservation)
    } catch {
      /* noop - エラーは親でトースト表示済み */
    } finally {
      setActionState('idle')
    }
  }, [onDecline, reservation])

  if (!open || !reservation) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="reservation-modal-title" className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-white/60 bg-white/95 shadow-[0_40px_120px_rgba(15,23,42,0.22)]">
        <div className="flex items-center justify-between border-b border-white/60 bg-gradient-to-r from-brand-primary/10 to-transparent px-6 py-4">
          <div>
            <h2 id="reservation-modal-title" className="text-lg font-semibold text-neutral-900">
              予約詳細
            </h2>
            <p className="text-xs text-neutral-500">予約ID: {reservation.id}</p>
            {filterSummary ? (
              <p className="mt-1 text-[11px] text-neutral-500">現在の表示条件: {filterSummary}</p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800" aria-label="予約詳細モーダルを閉じる">
            ✕
          </button>
        </div>
        <div className="space-y-5 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 text-sm">
              <div className="font-semibold text-neutral-900">{reservation.customer_name}</div>
              <div className="text-neutral-600">
                送信日時: {new Date(reservation.created_at).toLocaleString('ja-JP')}
              </div>
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
              {statusLabel}
            </span>
          </div>

          <div className="grid gap-4 text-sm text-neutral-700 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">希望日時</div>
              <div>
                {new Date(reservation.desired_start).toLocaleString('ja-JP')}〜
                {new Date(reservation.desired_end).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">連絡先</div>
              <div className="space-y-1">
                <div>📞 {reservation.customer_phone}</div>
                {reservation.customer_email ? <div>✉️ {reservation.customer_email}</div> : null}
              </div>
            </div>
            {preferredSlots.length ? (
              <div className="space-y-1 md:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">候補日時</div>
                <div className="space-y-1 whitespace-pre-line rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-3 text-sm">
                  {preferredSlots.join('\n')}
                </div>
              </div>
            ) : null}
            {reservation.notes ? (
              <div className="space-y-1 md:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">メモ</div>
                <p className="whitespace-pre-line rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                  {reservation.notes}
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleCopy}
              disabled={copyState === 'copying'}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:border-brand-primary hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {copyState === 'copied' ? '複製しました' : copyState === 'copying' ? '複製中…' : '詳細をコピー'}
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDecline}
                disabled={actionState === 'declining' || actionState === 'approving'}
                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionState === 'declining' ? '辞退処理中…' : '辞退する'}
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionState === 'approving' || actionState === 'declining'}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-300/40 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionState === 'approving' ? '承認処理中…' : '承認する'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
