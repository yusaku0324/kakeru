'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useToast, ToastContainer } from '@/components/useToast'
import { usePolling } from '@/hooks/usePolling'

const STATUSES = ['pending', 'confirmed', 'declined', 'cancelled', 'expired'] as const
const PAGE_SIZE = 10

type ReservationAdminItem = {
  id: string
  shop_id: string
  shop_name: string
  status: string
  desired_start: string
  desired_end: string
  channel?: string | null
  notes?: string | null
  customer_name: string
  customer_phone: string
  customer_email?: string | null
  created_at: string
  updated_at: string
}

type ReservationListResponse = {
  total: number
  items: ReservationAdminItem[]
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('ja-JP')
  } catch {
    return iso
  }
}

export default function AdminReservationsPage() {
  const [data, setData] = useState<ReservationListResponse>({ total: 0, items: [] })
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set())
  const highlightTimers = useRef<Record<string, NodeJS.Timeout>>({})
  const lastStatusMap = useRef<Map<string, string>>(new Map())
  const { toasts, push, remove } = useToast()
  const [isRefreshing, startTransition] = useTransition()
  const [pageNumber, setPageNumber] = useState(1)

  const playNotification = useMemo(() => {
    let context: AudioContext | null = null
    return () => {
      try {
        if (typeof window === 'undefined') return
        context = context || new AudioContext()
        if (context.state === 'suspended') context.resume()
        const osc = context.createOscillator()
        const gain = context.createGain()
        osc.type = 'sine'
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.0001, context.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.4)
        osc.connect(gain)
        gain.connect(context.destination)
        osc.start()
        osc.stop(context.currentTime + 0.45)
      } catch (err) {
        console.warn('notification sound failed', err)
      }
    }
  }, [])

  const addHighlights = (ids: string[]) => {
    if (!ids.length) return
    setHighlightIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })
    ids.forEach((id) => {
      if (highlightTimers.current[id]) {
        clearTimeout(highlightTimers.current[id])
      }
      highlightTimers.current[id] = setTimeout(() => {
        setHighlightIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        delete highlightTimers.current[id]
      }, 15000)
    })
  }

  const { loading: isLoading, refresh } = usePolling(
    async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String((pageNumber - 1) * PAGE_SIZE))
      const resp = await fetch(`/api/admin/reservations?${params.toString()}`, {
        cache: 'no-store',
      })
      if (!resp.ok) {
        throw new Error('failed to fetch reservations')
      }
      const json = (await resp.json()) as ReservationListResponse

      const prevMap = lastStatusMap.current
      const nextMap = new Map<string, string>()
      const newHighlights: string[] = []
      json.items.forEach((item) => {
        nextMap.set(item.id, item.status)
        if (!prevMap.has(item.id)) {
          newHighlights.push(item.id)
        } else if (prevMap.get(item.id) !== item.status && item.status === 'pending') {
          newHighlights.push(item.id)
        }
      })
      lastStatusMap.current = nextMap

      if (newHighlights.length) {
        playNotification()
        push('success', `${newHighlights.length}件の新しい予約/更新があります`)
        addHighlights(newHighlights)
      }

      setData(json)
      const drafts: Record<string, string> = {}
      json.items.forEach((item) => {
        drafts[item.id] = item.notes || ''
      })
      setNotesDraft(drafts)
      return json
    },
    { intervalMs: 15000, enabled: true },
  )

  useEffect(() => {
    setPageNumber(1)
  }, [statusFilter])

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, pageNumber])

  async function updateReservation(id: string, nextStatus: string | null) {
    setPendingIds((prev) => new Set(prev).add(id))
    try {
      const payload: Record<string, unknown> = {}
      if (nextStatus) payload.status = nextStatus
      if (notesDraft[id] !== undefined) payload.notes = notesDraft[id]
      const resp = await fetch(`/api/admin/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) {
        const detail = await resp.json().catch(() => ({}))
        push('error', detail?.detail || '更新に失敗しました')
        return
      }
      push('success', '更新しました')
      startTransition(() => refresh())
    } catch (err) {
      console.error(err)
      push('error', 'ネットワークエラーが発生しました')
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  useEffect(
    () => () => {
      Object.values(highlightTimers.current).forEach((timer) => clearTimeout(timer))
    },
    [],
  )

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">予約管理</h1>
          <p className="text-sm text-slate-600">ステータス更新やメモ追記ができます。</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">
            ステータス
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="ml-2 border rounded px-2 py-1 text-sm"
              data-testid="status-filter"
            >
              <option value="">すべて</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => refresh()}
            className="border rounded px-3 py-1 text-sm"
            disabled={isLoading || isRefreshing}
            data-testid="reservations-refresh"
          >
            再読込
          </button>
        </div>
      </div>

      <div className="text-sm text-slate-500">
        {isLoading
          ? '読み込み中…'
          : `${data.total}件中 ${data.items.length}件を表示（${pageNumber} / ${Math.max(1, Math.ceil(data.total / PAGE_SIZE))}ページ）`}
      </div>

      <div className="flex justify-end items-center gap-2 text-sm">
        <button
          onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
          className="border rounded px-3 py-1 disabled:opacity-50"
          disabled={pageNumber <= 1}
          data-testid="reservations-prev"
        >
          前へ
        </button>
        <button
          onClick={() => setPageNumber((prev) => prev + 1)}
          className="border rounded px-3 py-1 disabled:opacity-50"
          disabled={data.total <= pageNumber * PAGE_SIZE}
          data-testid="reservations-next"
        >
          次へ
        </button>
      </div>

      <div className="space-y-4">
        {data.items.map((item) => {
          const pending = pendingIds.has(item.id)
          const highlighted = highlightIds.has(item.id)
          return (
            <div
              key={item.id}
              className={`border rounded-lg bg-white shadow-sm p-4 space-y-3 transition-all ${highlighted ? 'ring-2 ring-amber-400 animate-pulse' : ''}`}
              data-testid="reservation-card"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-500">{item.id}</div>
                  <div className="text-lg font-semibold">{item.shop_name || '不明な店舗'}</div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <select
                    value={item.status}
                    onChange={(e) => updateReservation(item.id, e.target.value)}
                    className="border rounded px-2 py-1"
                    disabled={pending}
                    data-testid="reservation-status"
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-500">
                    受付: {formatDate(item.created_at)}
                  </span>
                </div>
              </div>

              <div className="grid gap-2 text-sm md:grid-cols-2">
                <div className="space-y-1">
                  <div>
                    <span className="font-medium">希望日時:</span> {formatDate(item.desired_start)}{' '}
                    〜 {formatDate(item.desired_end)}
                  </div>
                  {item.channel ? (
                    <div>
                      <span className="font-medium">経路:</span> {item.channel}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <div>
                    <span className="font-medium">氏名:</span> {item.customer_name}
                  </div>
                  <div>
                    <span className="font-medium">電話:</span> {item.customer_phone}
                  </div>
                  {item.customer_email ? (
                    <div>
                      <span className="font-medium">メール:</span> {item.customer_email}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-600">メモ</label>
                <textarea
                  value={notesDraft[item.id] ?? ''}
                  onChange={(e) =>
                    setNotesDraft((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                  className="w-full border rounded px-3 py-2 text-sm"
                  rows={2}
                  data-testid="reservation-notes"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => updateReservation(item.id, null)}
                    className="px-3 py-1 border rounded text-sm"
                    disabled={pending}
                    data-testid="reservation-save-notes"
                  >
                    メモのみ更新
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <ToastContainer toasts={toasts} onDismiss={remove} />
    </main>
  )
}
