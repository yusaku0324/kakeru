'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { ReservationStatusBadge } from '@/components/ReservationStatusBadge'
import { formatReservationRange } from '@/lib/date'

type AdminGuestReservation = {
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

type ListResponse = {
  items?: AdminGuestReservation[]
  summary?: Record<string, number>
}

export default function AdminShopReservationsPage() {
  const params = useParams()
  const shopId = params.shopId as string
  const [items, setItems] = useState<AdminGuestReservation[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`/api/admin/guest_reservations?shop_id=${shopId}`, {
        cache: 'no-store',
      })
      if (!resp.ok) {
        throw new Error(`status ${resp.status}`)
      }
      const json = (await resp.json()) as ListResponse
      setItems(json.items ?? [])
      setSummary(json.summary ?? {})
    } catch (err) {
      console.error('failed to load guest reservations', err)
      setItems([])
      setSummary({})
      setError('予約情報の取得に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const statusBadges = useMemo(() => {
    const entries = Object.entries(summary)
    if (!entries.length) return null
    return entries.map(([status, count]) => (
      <span
        key={status}
        className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
      >
        {status}: {count}
      </span>
    ))
  }, [summary])

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">予約一覧</h1>
          <p className="text-sm text-slate-600">
            店舗別のゲスト予約を確認し、詳細へ遷移できます。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh()}
            className="rounded border border-slate-300 px-3 py-1 text-sm"
            disabled={loading}
          >
            再読込
          </button>
          <Link
            href="/admin/shops"
            className="text-sm text-brand-primary underline"
          >
            店舗一覧へ
          </Link>
        </div>
      </div>

      {statusBadges ? (
        <div className="flex flex-wrap gap-2">{statusBadges}</div>
      ) : null}

      {error ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      <section className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        {loading ? (
          <div className="text-sm text-slate-600">読み込み中...</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-slate-600">
            この店舗には現在表示できる予約がありません。
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-600">
                <th className="px-2 py-1">日時</th>
                <th className="px-2 py-1">セラピスト</th>
                <th className="px-2 py-1">ステータス</th>
                <th className="px-2 py-1">メモ</th>
                <th className="px-2 py-1">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-2 py-1">
                    <div className="font-medium text-slate-900">
                      {formatReservationRange(item.start_at, item.end_at)}
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    {item.therapist_name || item.therapist_id || '-'}
                  </td>
                  <td className="px-2 py-1">
                    <ReservationStatusBadge status={item.status} />
                  </td>
                  <td className="px-2 py-1">
                    <div className="max-w-xs truncate text-xs text-slate-600">
                      {item.notes || '-'}
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <Link
                      href={`/admin/shops/${shopId}/reservations/${item.id}`}
                      className="text-brand-primary underline"
                    >
                      詳細
                    </Link>
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
