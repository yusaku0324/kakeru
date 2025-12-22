'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import clsx from 'clsx'

import {
  RESERVATION_STATUS_BADGES,
  getReservationStatusDisplay,
} from '@/components/reservations/status'
import { Card } from '@/components/ui/Card'
import type { DashboardReservationItem } from '@/lib/dashboard-reservations'
import { fetchDashboardReservations } from '@/lib/dashboard-reservations'
import {
  loadShopReservationsForDay,
  type ReservationDayMode,
} from '@/features/reservations/usecases'

type DateMode = ReservationDayMode | 'custom'

const DAY_TABS: Array<{ mode: DateMode; label: string }> = [
  { mode: 'today', label: '今日' },
  { mode: 'tomorrow', label: '明日' },
  { mode: 'custom', label: '日付指定' },
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

function getTodayString() {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

function formatDateForDisplay(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })
}

export default function DashboardReservationDaySummary({ profileId }: { profileId: string }) {
  const [mode, setMode] = useState<DateMode>('today')
  const [customDate, setCustomDate] = useState<string>(getTodayString())
  const [todayState, setTodayState] = useState<DayState>({ loading: true, error: null, reservations: [] })
  const [tomorrowState, setTomorrowState] = useState<DayState>({ loading: true, error: null, reservations: [] })
  const [customState, setCustomState] = useState<DayState>({ loading: false, error: null, reservations: [] })

  // Load today and tomorrow on mount
  useEffect(() => {
    let cancelled = false
    const todayController = new AbortController()
    const tomorrowController = new AbortController()

    async function loadPreset(day: ReservationDayMode, setState: React.Dispatch<React.SetStateAction<DayState>>) {
      setState(prev => ({ ...prev, loading: true, error: null }))
      try {
        const reservations = await loadShopReservationsForDay(profileId, day, {
          signal: day === 'today' ? todayController.signal : tomorrowController.signal,
        })
        if (cancelled) return
        setState({ loading: false, error: null, reservations })
      } catch (error) {
        if (cancelled) return
        if ((error as Error).name === 'AbortError') return
        setState(prev => ({
          loading: false,
          error: '予約の取得に失敗しました',
          reservations: prev.reservations,
        }))
      }
    }

    loadPreset('today', setTodayState)
    loadPreset('tomorrow', setTomorrowState)

    return () => {
      cancelled = true
      todayController.abort()
      tomorrowController.abort()
    }
  }, [profileId])

  // Load custom date reservations
  const loadCustomDate = useCallback(async (date: string) => {
    setCustomState(prev => ({ ...prev, loading: true, error: null }))
    try {
      // Use JST timezone explicitly to avoid timezone issues
      const startOfDay = new Date(date + 'T00:00:00+09:00')
      const endOfDay = new Date(date + 'T23:59:59+09:00')
      const data = await fetchDashboardReservations(profileId, {
        limit: 100,
        sort: 'date',
        direction: 'asc',
        start: startOfDay.toISOString(),
        end: endOfDay.toISOString(),
      })
      setCustomState({ loading: false, error: null, reservations: data.reservations as DashboardReservationItem[] })
    } catch (error) {
      setCustomState(prev => ({
        loading: false,
        error: '予約の取得に失敗しました',
        reservations: prev.reservations,
      }))
    }
  }, [profileId])

  // Load custom date when switching to custom mode or changing date
  useEffect(() => {
    if (mode === 'custom' && customDate) {
      loadCustomDate(customDate)
    }
  }, [mode, customDate, loadCustomDate])

  const currentState = useMemo(() => {
    if (mode === 'today') return todayState
    if (mode === 'tomorrow') return tomorrowState
    return customState
  }, [mode, todayState, tomorrowState, customState])

  const summary = useMemo(() => {
    const list = currentState.reservations
    const total = list.length
    const active = list.filter((item) => !CANCELLED_STATUSES.includes(item.status)).length
    const cancelledCount = total - active
    return { total, active, cancelled: cancelledCount }
  }, [currentState])

  const currentLabel = useMemo(() => {
    if (mode === 'custom' && customDate) {
      return formatDateForDisplay(customDate)
    }
    return DAY_TABS.find((tab) => tab.mode === mode)?.label ?? ''
  }, [mode, customDate])

  return (
    <Card className="space-y-4 border border-brand-primary/20 bg-white/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-textMuted">直近の予約状況</p>
          <h2 className="text-lg font-semibold text-neutral-text">今日は誰が来店しますか？</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          {mode === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="rounded-lg border border-brand-primary/30 bg-white px-3 py-1 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          )}
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
