"use client"

import { useEffect, useMemo, useState } from 'react'

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
        setError('予約一覧を取得できませんでした。時間をおいて再度お試しください。')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [guestToken])

  const rows = useMemo(() => {
    return reservations.map((r) => {
      const start = new Date(r.start_at)
      const end = new Date(r.end_at)
      const date = start.toLocaleDateString('ja-JP')
      const startTime = start.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
      const endTime = end.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
      return { ...r, date, startTime, endTime }
    })
  }, [reservations])

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 text-sm">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-text">マイ予約一覧</h1>
        <p className="text-neutral-textMuted">guest_token: {guestToken || '(未発行)'}</p>
      </div>

      {loading ? <div>読み込み中...</div> : null}
      {error ? <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{error}</div> : null}

      {!loading && !guestToken ? <div className="text-neutral-textMuted">guest_token が未発行のため予約が表示できません。</div> : null}

      {!loading && guestToken && rows.length === 0 && !error ? (
        <div className="text-neutral-textMuted">現在予約はありません。</div>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-neutral-borderLight text-sm">
            <thead className="bg-neutral-50 text-left">
              <tr>
                <th className="border-b px-3 py-2">日付</th>
                <th className="border-b px-3 py-2">時間</th>
                <th className="border-b px-3 py-2">セラピストID</th>
                <th className="border-b px-3 py-2">ステータス</th>
                <th className="border-b px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2">{r.startTime} - {r.endTime}</td>
                  <td className="px-3 py-2">{r.therapist_id ?? '未指定'}</td>
                  <td className="px-3 py-2">{r.status}</td>
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
