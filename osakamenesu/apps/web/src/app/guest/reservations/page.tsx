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

type AuthState = { status: 'checking' } | { status: 'guest' } | { status: 'authenticated'; displayName: string | null }

export default function GuestReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guestToken, setGuestToken] = useState<string | null>(null)
  const [authState, setAuthState] = useState<AuthState>({ status: 'checking' })

  // Check authentication status and get guest token
  useEffect(() => {
    if (typeof window === 'undefined') return
    const token = window.localStorage.getItem('guest_token')
    setGuestToken(token)

    // Check if user is authenticated
    fetch('/api/auth/me/site', { credentials: 'include', cache: 'no-store' })
      .then((res) => {
        if (res.ok) {
          return res.json().then((data) => {
            const displayName = data?.display_name || data?.email || null
            setAuthState({ status: 'authenticated', displayName })
          })
        }
        setAuthState({ status: 'guest' })
      })
      .catch(() => {
        setAuthState({ status: 'guest' })
      })
  }, [])

  useEffect(() => {
    const load = async () => {
      // Wait for auth check to complete
      if (authState.status === 'checking') return

      // If not authenticated and no guest token, we can't fetch reservations
      if (authState.status === 'guest' && !guestToken) {
        setLoading(false)
        return
      }

      setError(null)
      try {
        // Build URL with optional guest_token parameter
        let url = '/api/guest/reservations'
        if (guestToken) {
          url += `?guest_token=${encodeURIComponent(guestToken)}`
        }
        const resp = await fetch(url, {
          credentials: 'include',
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
  }, [guestToken, authState])

  const rows = useMemo(() => {
    return reservations.map((r) => {
      return { ...r, window: formatReservationRange(r.start_at, r.end_at) }
    })
  }, [reservations])

  const isAuthenticated = authState.status === 'authenticated'
  const canShowReservations = isAuthenticated || guestToken

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 text-sm">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-text">マイ予約一覧</h1>
        {isAuthenticated && authState.displayName ? (
          <p className="text-neutral-textMuted">ログイン中: {authState.displayName}</p>
        ) : guestToken ? (
          <p className="text-neutral-textMuted text-xs">ゲストとして閲覧中</p>
        ) : null}
      </div>

      {loading || authState.status === 'checking' ? <div>読み込み中...</div> : null}
      {error ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{error}</div>
      ) : null}

      {!loading && authState.status !== 'checking' && !canShowReservations ? (
        <div className="flex flex-col items-start gap-3 rounded border border-neutral-borderLight bg-white p-4">
          <p className="text-neutral-textMuted">予約履歴を表示するにはログインしてください。</p>
          <Link href="/auth/login" className="text-brand-primary underline">
            ログインする
          </Link>
        </div>
      ) : null}

      {!loading && authState.status !== 'checking' && canShowReservations && rows.length === 0 && !error ? (
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
