"use client"

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

import { buildAdminHeaders } from '@/lib/admin-headers'

type ReservationItem = {
  id: string
  shop_id: string
  shop_name?: string
  therapist_id?: string | null
  therapist_name?: string | null
  start_at?: string | null
  end_at?: string | null
  status?: string | null
  notes?: string | null
  contact_info?: Record<string, unknown> | null
}

type ReservationsResponse = { items?: ReservationItem[]; total?: number }

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}/${dd} ${hh}:${mi}`
}

export default function AdminShopReservationsPage() {
  const params = useParams<{ shopId: string }>()
  const shopId = params?.shopId?.toString() ?? ''
  const [reservations, setReservations] = useState<ReservationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const metrics = useMemo(() => {
    const endOfToday = new Date(today.getTime())
    endOfToday.setHours(23, 59, 59, 999)

    const endOfWeek = new Date(today.getTime())
    endOfWeek.setDate(endOfWeek.getDate() + 7)

    let todayCount = 0
    let weekCount = 0
    reservations.forEach((r) => {
      const start = r.start_at ? new Date(r.start_at) : null
      if (!start || Number.isNaN(start.getTime())) return
      if (start >= today && start <= endOfToday) todayCount += 1
      if (start >= today && start <= endOfWeek) weekCount += 1
    })
    return { todayCount, weekCount }
  }, [reservations, today])

  useEffect(() => {
    const load = async () => {
      if (!shopId) {
        setError('店舗IDが不明です')
        setReservations([])
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const url = `/api/admin/guest_reservations?shop_id=${shopId}`
        const resp = await fetch(url, { cache: 'no-store', headers: buildAdminHeaders() })
        if (!resp.ok) throw new Error(`status ${resp.status}`)
        const data = (await resp.json()) as ReservationsResponse
        setReservations(data.items ?? [])
      } catch (e) {
        console.error('failed to load guest reservations', e)
        setError('予約一覧の取得に失敗しました')
        setReservations([])
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [shopId])

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div>
        <h1 data-testid="admin-title" className="text-2xl font-semibold text-neutral-text">
          予約一覧
        </h1>
        <p className="text-sm text-neutral-textMuted">店舗ID: {shopId || '(不明)'}</p>
      </div>

      {error ? <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{error}</div> : null}

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded border border-neutral-borderLight bg-white p-3 text-sm">
          <div className="text-xs text-neutral-textMuted">今日の予約</div>
          <div className="text-2xl font-semibold text-neutral-text">{metrics.todayCount}</div>
        </div>
        <div className="rounded border border-neutral-borderLight bg-white p-3 text-sm">
          <div className="text-xs text-neutral-textMuted">今週の予約</div>
          <div className="text-2xl font-semibold text-neutral-text">{metrics.weekCount}</div>
        </div>
        <div className="rounded border border-neutral-borderLight bg-white p-3 text-sm">
          <div className="text-xs text-neutral-textMuted">総件数</div>
          <div className="text-2xl font-semibold text-neutral-text">{reservations.length}</div>
        </div>
      </section>

      <section className="space-y-2 rounded border border-neutral-borderLight bg-white p-3">
        <h2 className="text-lg font-semibold text-neutral-text">予約一覧</h2>
        {loading ? (
          <div className="text-sm text-neutral-textMuted">読み込み中…</div>
        ) : reservations.length === 0 ? (
          <div className="text-sm text-neutral-textMuted">予約がありません。</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-borderLight text-left text-xs text-neutral-textMuted">
                <th className="px-2 py-1">日付</th>
                <th className="px-2 py-1">時間</th>
                <th className="px-2 py-1">セラピスト</th>
                <th className="px-2 py-1">ステータス</th>
                <th className="px-2 py-1">メモ</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id} className="border-b border-neutral-borderLight">
                  <td className="px-2 py-1">{r.start_at ? r.start_at.slice(0, 10) : '-'}</td>
                  <td className="px-2 py-1">
                    {formatDateTime(r.start_at)} 〜 {formatDateTime(r.end_at)}
                  </td>
                  <td className="px-2 py-1">{r.therapist_name || r.therapist_id || '-'}</td>
                  <td className="px-2 py-1">{r.status || '-'}</td>
                  <td className="px-2 py-1 text-neutral-textMuted">
                    {r.notes || (r.contact_info ? JSON.stringify(r.contact_info) : '-')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}
