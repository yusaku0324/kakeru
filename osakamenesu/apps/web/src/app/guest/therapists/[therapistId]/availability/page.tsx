'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

import { formatReservationRange, toLocalDateISO } from '@/lib/date'

type SummaryItem = { date: string; has_available: boolean }
type SummaryResponse = { therapist_id: string; items: SummaryItem[] }
type Slot = { start_at: string; end_at: string }
type SlotsResponse = { therapist_id: string; date: string; slots: Slot[] }

const DAY_COUNT = 7

function buildReserveLink(slot: Slot, therapistId: string, shopId?: string | null) {
  const params = new URLSearchParams()
  if (shopId) params.set('shop_id', shopId)
  if (slot.start_at) params.set('start_at', slot.start_at)
  if (slot.end_at) params.set('end_at', slot.end_at)
  const dateIso = toLocalDateISO(slot.start_at)
  if (dateIso) params.set('date', dateIso)
  params.set('therapist_id', therapistId)
  return `/guest/therapists/${therapistId}/reserve?${params.toString()}`
}

function formatDayLabel(iso: string): string {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return iso
  const month = dt.getMonth() + 1
  const day = dt.getDate()
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][dt.getDay()]
  return `${month}/${day} (${weekday})`
}

export default function TherapistAvailabilityPage() {
  const params = useParams()
  const therapistId = params.therapistId as string
  const sp = useSearchParams()
  const shopId = sp.get('shop_id')
  const days = useMemo(() => {
    const today = new Date()
    const list: string[] = []
    for (let i = 0; i < DAY_COUNT; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      list.push(toLocalDateISO(d))
    }
    return list
  }, [])

  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotsResponse | null>(null)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)

  useEffect(() => {
    async function loadSummary() {
      setLoadingSummary(true)
      setSummaryError(null)
      try {
        const dateFrom = days[0]
        const dateTo = days[days.length - 1]
        const resp = await fetch(
          `/api/guest/therapists/${therapistId}/availability_summary?date_from=${dateFrom}&date_to=${dateTo}`,
          { cache: 'no-store' },
        )
        const data = (await resp.json()) as SummaryResponse
        if (!resp.ok) {
          const message = (data as any)?.detail || 'failed to load availability'
          throw new Error(message)
        }
        setSummary(data)
        setSelectedDate((prev) => prev || days[0])
      } catch (err) {
        console.error('availability summary failed', err)
        setSummaryError('空き状況の取得に失敗しました。時間をおいて再度お試しください。')
      } finally {
        setLoadingSummary(false)
      }
    }
    loadSummary()
  }, [days, therapistId])

  useEffect(() => {
    if (!selectedDate) return
    async function loadSlots() {
      setLoadingSlots(true)
      setSlotsError(null)
      try {
        const resp = await fetch(
          `/api/guest/therapists/${therapistId}/availability_slots?date=${selectedDate}`,
          { cache: 'no-store' },
        )
        const data = (await resp.json()) as SlotsResponse
        if (!resp.ok) {
          const message = (data as any)?.detail || 'failed to load slots'
          throw new Error(message)
        }
        setSlots(data)
      } catch (err) {
        console.error('availability slots failed', err)
        setSlotsError('枠の取得に失敗しました。時間をおいて再度お試しください。')
        setSlots(null)
      } finally {
        setLoadingSlots(false)
      }
    }
    loadSlots()
  }, [selectedDate, therapistId])

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 text-sm">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-text">空き状況</h1>
        <p className="text-neutral-textMuted">セラピストID: {therapistId}</p>
        {shopId ? <p className="text-neutral-textMuted">店舗ID: {shopId}</p> : null}
        <p className="text-neutral-textMuted">※ バッファなし（0分）のシンプルな空き状況です。</p>
      </div>

      {summaryError ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{summaryError}</div>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-text">日付を選択</h2>
        {loadingSummary ? (
          <div className="rounded border border-neutral-borderLight bg-white px-3 py-2 text-neutral-textMuted">
            空き状況を読み込み中...
          </div>
        ) : (
        <div className="flex flex-wrap gap-2">
          {days.map((d) => {
            const status = summary?.items.find((item) => item.date === d)
            const isActive = selectedDate === d
            const hasAvailable = status?.has_available ?? false
            return (
              <button
                key={d}
                onClick={() => setSelectedDate(d)}
                className={`flex min-w-[110px] flex-col rounded border px-3 py-2 text-left transition hover:shadow-sm ${
                  isActive ? 'border-brand-primary bg-brand-surface text-brand-primary' : 'border-neutral-borderLight bg-white'
                } ${hasAvailable ? '' : 'opacity-70'}`}
              >
                <span className="text-xs text-neutral-textMuted">{formatDayLabel(d)}</span>
                <span className={`text-lg font-semibold ${hasAvailable ? 'text-green-600' : 'text-neutral-500'}`}>
                  {hasAvailable ? '○ 空きあり' : '× 受付終了'}
                </span>
              </button>
            )
          })}
        </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-text">選択した日の枠</h2>
          <Link className="text-brand-primary underline" href={`/guest/therapists/${therapistId}${shopId ? `?shop_id=${shopId}` : ''}`}>
            セラピスト詳細に戻る
          </Link>
        </div>

        {loadingSlots ? (
          <div className="rounded border border-neutral-borderLight bg-white px-3 py-2 text-neutral-textMuted">読み込み中...</div>
        ) : slotsError ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{slotsError}</div>
        ) : slots && slots.slots.length > 0 ? (
          <div className="space-y-2">
            {slots.slots.map((slot) => (
              <div
                key={`${slot.start_at}-${slot.end_at}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-neutral-borderLight bg-white px-3 py-2"
              >
                <div className="text-neutral-text">{formatReservationRange(slot.start_at, slot.end_at)}</div>
                <Link
                  className="rounded bg-brand-primary px-3 py-1 text-sm font-semibold text-white hover:brightness-105"
                  href={buildReserveLink(slot, therapistId, shopId)}
                >
                  この時間で予約する
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded border border-neutral-borderLight bg-neutral-50 px-3 py-2 text-neutral-textMuted">
            空きがありません。
          </div>
        )}
      </section>
    </main>
  )
}
