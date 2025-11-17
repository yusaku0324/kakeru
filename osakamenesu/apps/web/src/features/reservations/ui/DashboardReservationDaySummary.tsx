'use client'

import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'

import {
  RESERVATION_STATUS_BADGES,
  getReservationStatusDisplay,
} from '@/components/reservations/status'
import { Card } from '@/components/ui/Card'
import type { DashboardReservationItem } from '@/lib/dashboard-reservations'
import {
  loadShopReservationsForDay,
  type ReservationDayMode,
} from '@/features/reservations/usecases'

const DAY_TABS: Array<{ mode: ReservationDayMode; label: string }> = [
  { mode: 'today', label: '今日' },
  { mode: 'tomorrow', label: '明日' },
]

const CANCELLED_STATUSES: Array<DashboardReservationItem['status']> = [
  'cancelled',
  'declined',
  'expired',
]

function formatTimeRange(item: DashboardReservationItem) {
  const start = new Date(item.desired_start)
  const end = new Date(item.desired_end)
  return `${start.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}〜${end.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`
}

function formatDateLabel(item: DashboardReservationItem) {
  const date = new Date(item.desired_start)
  return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })
}

type DayState = {
  loading: boolean
  error: string | null
  reservations: DashboardReservationItem[]
}

const INITIAL_STATE = DAY_TABS.reduce<Record<ReservationDayMode, DayState>>(
  (acc, tab) => {
    acc[tab.mode] = { loading: true, error: null, reservations: [] }
    return acc
  },
  {} as Record<ReservationDayMode, DayState>,
)

export default function DashboardReservationDaySummary({ profileId }: { profileId: string }) {
  const [mode, setMode] = useState<ReservationDayMode>('today')
  const [state, setState] = useState(INITIAL_STATE)

  useEffect(() => {
    let cancelled = false
    const controllers = DAY_TABS.reduce<Record<ReservationDayMode, AbortController>>(
      (acc, tab) => {
        acc[tab.mode] = new AbortController()
        return acc
      },
      {} as Record<ReservationDayMode, AbortController>,
    )

    async function loadDay(day: ReservationDayMode) {
      setState((prev) => ({
        ...prev,
        [day]: { ...prev[day], loading: true, error: null },
      }))
      try {
        const reservations = await loadShopReservationsForDay(profileId, day, {
          signal: controllers[day].signal,
        })
        if (cancelled) return
        setState((prev) => ({ ...prev, [day]: { loading: false, error: null, reservations } }))
      } catch (error) {
        if (cancelled) return
        if ((error as Error).name === 'AbortError') return
        setState((prev) => ({
          ...prev,
          [day]: {
            loading: false,
            error: '予約の取得に失敗しました',
            reservations: prev[day].reservations,
          },
        }))
      }
    }

    DAY_TABS.forEach((tab) => loadDay(tab.mode))

    return () => {
      cancelled = true
      DAY_TABS.forEach((tab) => controllers[tab.mode].abort())
    }
  }, [profileId])

  const summary = useMemo(() => {
    const list = state[mode].reservations
    const total = list.length
    const active = list.filter((item) => !CANCELLED_STATUSES.includes(item.status)).length
    const cancelledCount = total - active
    return { total, active, cancelled: cancelledCount }
  }, [mode, state])

  const currentState = state[mode]
  const currentLabel = useMemo(() => DAY_TABS.find((tab) => tab.mode === mode)?.label ?? '', [mode])

  return (
    <Card className="space-y-4 border border-brand-primary/20 bg-white/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-textMuted">直近の予約状況</p>
          <h2 className="text-lg font-semibold text-neutral-text">今日は誰が来店しますか？</h2>
        </div>
        <div className="inline-flex rounded-full border border-brand-primary/30 bg-white p-0.5 text-sm font-semibold">
          {DAY_TABS.map((tab) => (
            <button
              key={tab.mode}
              type="button"
              onClick={() => setMode(tab.mode)}
              className={clsx(
                'rounded-full px-3 py-1 transition',
                mode === tab.mode
                  ? 'bg-brand-primary text-white'
                  : 'text-brand-primary hover:bg-brand-primary/10',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-card bg-brand-primary/5 px-4 py-3 text-sm font-medium text-brand-primaryDark">
        {currentLabel}の予約: {summary.total}件（来店予定 {summary.active}件 / キャンセル{' '}
        {summary.cancelled}件）
      </div>

      {currentState.loading ? (
        <p className="text-sm text-neutral-textMuted">読み込み中...</p>
      ) : currentState.error ? (
        <p className="text-sm text-red-600">{currentState.error}</p>
      ) : currentState.reservations.length === 0 ? (
        <p className="text-sm text-neutral-textMuted">{currentLabel}の予約はまだありません。</p>
      ) : (
        <ul className="space-y-3">
          {currentState.reservations.map((reservation) => {
            const statusClass =
              RESERVATION_STATUS_BADGES[reservation.status] ?? 'bg-neutral-200 text-neutral-700'
            return (
              <li
                key={reservation.id}
                className="rounded-card border border-neutral-borderLight/70 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-neutral-text">
                      {formatDateLabel(reservation)}
                    </div>
                    <div className="text-xs text-neutral-textMuted">
                      {formatTimeRange(reservation)}
                    </div>
                  </div>
                  <div className="text-right text-xs text-neutral-textMuted">
                    <div className="font-semibold text-neutral-text">
                      {reservation.customer_name}
                    </div>
                    {reservation.channel ? <div>経路: {reservation.channel}</div> : null}
                  </div>
                  <span
                    className={clsx(
                      'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                      statusClass,
                    )}
                  >
                    {getReservationStatusDisplay(reservation.status)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
