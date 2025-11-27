'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { ReservationStatusBadge } from '@/components/ReservationStatusBadge'
import { formatReservationRange } from '@/lib/date'

type Reservation = {
  id: string
  status: string
  shop_id: string
  therapist_id: string | null
  start_at: string
  end_at: string
}

export default function GuestReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guestToken, setGuestToken] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const token = window.localStorage.getItem('guest_token')
    setGuestToken(token)
  }, [])

  useEffect(() => {
    const load = async () => {
      if (!guestToken) {
        setLoading(false)
        return
      }
      setError(null)
      try {
        const resp = await fetch(`/api/guest/reservations?guest_token=${encodeURIComponent(guestToken)}`, {
          cache: 'no-store',
        })
        if (!resp.ok) throw new Error(`status ${resp.status}`)
        const data = (await resp.json()) as Reservation[]
        setReservations(data)
      } catch (e) {
        console.error('failed to load reservations', e)
        setError('予約情報の取得に失敗しました。時間をおいて再度お試しください。')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [guestToken])

  const rows = useMemo(() => {
    return reservations.map((r) => {
      return { ...r, window: formatReservationRange(r.start_at, r.end_at) }
    })
  }, [reservations])

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 text-sm">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-text">マイ予約一覧</h1>
        <p className="text-neutral-textMuted">guest_token: {guestToken || '(未発行)'}</p>
      </div>

      {loading ? <div>読み込み中...</div> : null}
      {error ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{error}</div>
      ) : null}

      {!loading && !guestToken ? (
        <div className="text-neutral-textMuted">guest_token が未発行のため予約が表示できません。</div>
      ) : null}

      {!loading && guestToken && rows.length === 0 && !error ? (
        <div className="flex flex-col items-start gap-2 rounded border border-neutral-borderLight bg-white p-4 text-neutral-textMuted">
          <div>現在、予約はありません。</div>
          <Link href="/guest/search" className="text-brand-primary underline">
            店舗を探す
          </Link>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-neutral-borderLight text-sm">
            <thead className="bg-neutral-50 text-left">
              <tr>
                <th className="border-b px-3 py-2">日時</th>
                <th className="border-b px-3 py-2">セラピストID</th>
                <th className="border-b px-3 py-2">ステータス</th>
                <th className="border-b px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="px-3 py-2">{r.window}</td>
                  <td className="px-3 py-2">{r.therapist_id ?? '未指定'}</td>
                  <td className="px-3 py-2">
                    <ReservationStatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2">
                    <a className="text-brand-primary underline" href={`/guest/reservations/${r.id}`}>
                      詳細を見る
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  )
}
