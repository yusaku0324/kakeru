'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { ReservationStatusBadge } from '@/components/ReservationStatusBadge'
import { formatReservationRange } from '@/lib/date'

type AdminGuestReservationDetail = {
  id: string
  shop_id: string
  shop_name?: string | null
  therapist_id?: string | null
  therapist_name?: string | null
  start_at: string
  end_at: string
  status: string
  contact_info?: Record<string, unknown> | null
  notes?: string | null
  created_at: string
  updated_at: string
}

function pretty(obj?: Record<string, unknown> | null) {
  if (!obj) return '-'
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

export default function AdminGuestReservationDetailPage() {
  const params = useParams()
  const shopId = params.shopId as string
  const reservationId = params.reservationId as string
  const [reservation, setReservation] =
    useState<AdminGuestReservationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const windowLabel = reservation ? formatReservationRange(reservation.start_at, reservation.end_at) : ''

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(
        `/api/admin/guest_reservations/${reservationId}`,
        { cache: 'no-store' },
      )
      if (!resp.ok) {
        throw new Error(`status ${resp.status}`)
      }
      const json = (await resp.json()) as AdminGuestReservationDetail
      setReservation(json)
    } catch (err) {
      console.error('failed to load reservation detail', err)
      setReservation(null)
      setError('予約情報の取得に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setLoading(false)
    }
  }, [reservationId])

  useEffect(() => {
    void load()
  }, [load])

  const updateStatus = async (nextStatus: 'confirmed' | 'cancelled') => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm(`ステータスを ${nextStatus} に変更しますか？`)
      if (!ok) return
    }
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      const resp = await fetch(
        `/api/admin/guest_reservations/${reservationId}/status`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: nextStatus,
            reason: nextStatus === 'cancelled' ? 'admin manually cancelled' : undefined,
          }),
        },
      )
      const json = await resp
        .json()
        .catch(() => ({ detail: 'failed to parse response' }))
      if (!resp.ok) {
        throw new Error(json?.detail || '更新に失敗しました')
      }
      setReservation((prev) =>
        prev ? { ...prev, status: json.status || nextStatus } : prev,
      )
      setMessage('ステータスを更新しました')
    } catch (err: any) {
      console.error(err)
      setError(err?.message || '更新に失敗しました')
    } finally {
      setPending(false)
    }
  }

  const actions = useMemo(() => {
    const status = reservation?.status
    if (!status) return { canConfirm: false, canCancel: false }
    return {
      canConfirm: status === 'pending',
      canCancel: status === 'pending' || status === 'confirmed',
    }
  }, [reservation?.status])

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">予約詳細</h1>
          <p className="text-sm text-slate-600">
            ステータス変更と連絡先/メモの確認ができます。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/shops/${shopId}/reservations`}
            className="text-sm text-brand-primary underline"
          >
            予約一覧へ戻る
          </Link>
          <button
            onClick={() => load()}
            className="rounded border border-slate-300 px-3 py-1 text-sm"
            disabled={loading}
          >
            再読込
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-slate-600">読み込み中...</div>
      ) : reservation ? (
        <section className="space-y-3 rounded border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">{reservation.id}</div>
              <div className="text-lg font-semibold">
                {reservation.shop_name || reservation.shop_id}
              </div>
              <div className="text-sm text-slate-600">
                {reservation.therapist_name || reservation.therapist_id || '担当未定'}
              </div>
            </div>
            <ReservationStatusBadge status={reservation.status} size="md" />
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500">日時</div>
            <div className="text-sm font-medium text-slate-900">{windowLabel}</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500">連絡先</div>
            <pre className="overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-800">
              {pretty(reservation.contact_info)}
            </pre>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500">メモ</div>
            <div className="rounded bg-slate-50 p-2 text-sm text-slate-800">
              {reservation.notes || 'なし'}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {actions.canConfirm ? (
              <button
                onClick={() => updateStatus('confirmed')}
                className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                disabled={pending}
              >
                予約を確定する
              </button>
            ) : null}
            {actions.canCancel ? (
              <button
                onClick={() => updateStatus('cancelled')}
                className="rounded border border-rose-200 bg-rose-50 px-3 py-1 text-sm text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                disabled={pending}
              >
                予約をキャンセルする
              </button>
            ) : null}
          </div>
        </section>
      ) : (
        <div className="text-sm text-slate-600">予約が見つかりません。</div>
      )}
    </main>
  )
}
