'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

import { ReservationStatusBadge } from '@/components/ReservationStatusBadge'
import { formatReservationRange } from '@/lib/date'

type ReservationDetail = {
  id: string
  status: string
  shop_id: string
  therapist_id: string | null
  start_at: string
  end_at: string
  contact_info?: Record<string, unknown> | null
  notes?: string | null
}

export default function GuestReservationDetailPage() {
  const params = useParams<{ reservationId: string }>()
  const reservationId = params.reservationId
  const [reservation, setReservation] = useState<ReservationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const windowLabel = reservation ? formatReservationRange(reservation.start_at, reservation.end_at) : ''

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const resp = await fetch(`/api/guest/reservations/${reservationId}`, { cache: 'no-store' })
      if (!resp.ok) throw new Error(`status ${resp.status}`)
      const json = (await resp.json()) as ReservationDetail
      setReservation(json)
    } catch (err) {
      console.error('failed to load reservation detail', err)
      setError('予約情報の取得に失敗しました。時間をおいて再度お試しください。')
      setReservation(null)
    } finally {
      setLoading(false)
    }
  }, [reservationId])

  useEffect(() => {
    void load()
  }, [load])

  const cancel = async () => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('この予約をキャンセルしますか？')
      if (!ok) return
    }
    setError(null)
    setMessage(null)
    try {
      const resp = await fetch(`/api/guest/reservations/${reservationId}/cancel`, { method: 'POST' })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(json?.detail || 'キャンセルに失敗しました')
      }
      setReservation((prev) => (prev ? { ...prev, status: json.status || 'cancelled' } : prev))
      setMessage('キャンセルが完了しました')
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'キャンセルに失敗しました')
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-text">予約詳細</h1>
          <p className="text-neutral-textMuted text-xs break-all">{reservationId}</p>
        </div>
        <Link href="/guest/reservations" className="text-brand-primary underline text-sm">
          一覧に戻る
        </Link>
      </div>

      {loading ? <div>読み込み中...</div> : null}
      {error ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">{message}</div>
      ) : null}

      {!loading && !reservation && !error ? (
        <div className="text-neutral-textMuted">予約が見つかりませんでした。</div>
      ) : null}

      {reservation ? (
        <section className="space-y-4 rounded border border-neutral-borderLight bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <div className="text-lg font-semibold text-neutral-text">予約情報</div>
              <div className="text-neutral-textMuted">
                店舗: <span className="font-mono text-xs">{reservation.shop_id}</span>
              </div>
              <div className="text-neutral-textMuted">
                セラピスト: <span className="font-mono text-xs">{reservation.therapist_id ?? '未指定'}</span>
              </div>
            </div>
            <ReservationStatusBadge status={reservation.status} size="md" />
          </div>

          <div className="space-y-1">
            <div className="text-xs text-neutral-textMuted">日時</div>
            <div className="text-sm font-medium text-neutral-text">{windowLabel}</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-neutral-textMuted">連絡先</div>
            <pre className="overflow-auto rounded bg-neutral-50 p-2 text-xs text-neutral-text">
              {reservation.contact_info ? JSON.stringify(reservation.contact_info, null, 2) : '未入力'}
            </pre>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-neutral-textMuted">メモ</div>
            <div className="rounded bg-neutral-50 p-2 text-sm text-neutral-text">
              {reservation.notes || 'なし'}
            </div>
          </div>

          <div className="flex gap-2">
            {reservation.status !== 'cancelled' ? (
              <button
                onClick={() => cancel()}
                className="rounded border border-rose-200 bg-rose-50 px-3 py-1 text-sm text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                disabled={reservation.status === 'cancelled'}
              >
                この予約をキャンセルする
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  )
}
