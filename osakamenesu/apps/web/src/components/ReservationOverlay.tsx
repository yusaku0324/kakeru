"use client"

import clsx from 'clsx'
import Image from 'next/image'
import { type MouseEvent, useCallback, useEffect, useMemo, useState } from 'react'

import ReservationForm from '@/components/ReservationForm'
import { AvailabilityPickerDesktop, type SelectedSlot } from '@/components/calendar/AvailabilityPickerDesktop'
import { AvailabilityPickerMobile } from '@/components/calendar/AvailabilityPickerMobile'
import { AVAILABILITY_STATUS_META, type AvailabilityStatus } from '@/components/calendar/types'
import { type TherapistHit } from '@/components/staff/TherapistCard'

export type ReservationOverlayProps = {
  hit: TherapistHit
  onClose: () => void
  tel?: string | null
  lineId?: string | null
  defaultStart?: string | null
  defaultDurationMinutes?: number | null
  allowDemoSubmission?: boolean
  gallery?: string[] | null
  profileDetails?: Array<{ label: string; value: string }>
  profileBio?: string | null
  profileSchedule?: string | null
  profilePricing?: string | null
  profileOptions?: string[] | null
  availabilityDays?: Array<{
    date: string
    is_today?: boolean | null
    slots: Array<{ start_at: string; end_at: string; status: 'open' | 'tentative' | 'blocked' }>
  }> | null
}

type OverlayTab = 'profile' | 'reviews' | 'booking'
type SlotStatus = Exclude<AvailabilityStatus, 'blocked'>

type NormalizedSlot = {
  start_at: string
  end_at: string
  status: AvailabilityStatus
  timeKey: string
}

type NormalizedDay = {
  date: string
  label: string
  isToday: boolean
  slots: NormalizedSlot[]
}

const FALLBACK_STAFF_META: Record<
  string,
  {
    details?: Array<{ label: string; value: string }>
    gallery?: string[]
    bio?: string
    schedule?: string
    pricing?: string
    options?: string[]
    availability?: Array<{
      dayOffset: number
      slots: Array<{ hour: number; minute: number; durationMinutes: number; status: AvailabilityStatus }>
    }>
  }
> = {
  葵: {
    details: [
      { label: '年齢', value: '26歳' },
      { label: '身長', value: '165cm' },
      { label: 'スタイル', value: 'グラマー' },
      { label: '3サイズ', value: 'B88 W60 H89' },
    ],
    gallery: [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1542293787938-4d2226c9dc13?auto=format&fit=crop&w=900&q=80',
    ],
    bio: 'タイ古式マッサージを得意としております。身体の芯からほぐしていきます。',
    schedule: '火・木・土・日 13:00〜23:00',
    pricing: '60分コース 11,000円〜 / 90分コース 15,000円〜',
    options: ['ホットストーン追加', 'ドライヘッドスパ', 'ハンドトリートメント延長', 'アロマブレンド変更'],
    availability: [
      {
        dayOffset: 0,
        slots: [
          { hour: 17, minute: 0, durationMinutes: 90, status: 'blocked' },
          { hour: 19, minute: 0, durationMinutes: 120, status: 'tentative' },
          { hour: 21, minute: 0, durationMinutes: 120, status: 'open' },
        ],
      },
      {
        dayOffset: 1,
        slots: [
          { hour: 14, minute: 0, durationMinutes: 90, status: 'open' },
          { hour: 18, minute: 0, durationMinutes: 120, status: 'open' },
        ],
      },
      {
        dayOffset: 2,
        slots: [
          { hour: 12, minute: 0, durationMinutes: 90, status: 'open' },
          { hour: 16, minute: 0, durationMinutes: 90, status: 'tentative' },
          { hour: 20, minute: 0, durationMinutes: 90, status: 'blocked' },
        ],
      },
      {
        dayOffset: 3,
        slots: [
          { hour: 13, minute: 0, durationMinutes: 90, status: 'tentative' },
          { hour: 19, minute: 30, durationMinutes: 90, status: 'open' },
        ],
      },
      {
        dayOffset: 4,
        slots: [
          { hour: 11, minute: 0, durationMinutes: 90, status: 'open' },
          { hour: 15, minute: 0, durationMinutes: 90, status: 'blocked' },
        ],
      },
      {
        dayOffset: 5,
        slots: [
          { hour: 10, minute: 30, durationMinutes: 90, status: 'open' },
          { hour: 17, minute: 30, durationMinutes: 90, status: 'tentative' },
        ],
      },
      {
        dayOffset: 6,
        slots: [
          { hour: 13, minute: 0, durationMinutes: 90, status: 'open' },
          { hour: 18, minute: 30, durationMinutes: 90, status: 'open' },
        ],
      },
    ],
  },
}

const pad = (value: number) => value.toString().padStart(2, '0')

function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toIsoWithOffset(date: Date) {
  return `${formatLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00+09:00`
}

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [active])
}

export default function ReservationOverlay({
  hit,
  onClose,
  tel = null,
  lineId = null,
  defaultStart,
  defaultDurationMinutes,
  allowDemoSubmission,
  gallery,
  profileDetails,
  profileBio,
  profileSchedule,
  profilePricing,
  profileOptions,
  availabilityDays,
}: ReservationOverlayProps) {
  useBodyScrollLock(true)

  const [activeTab, setActiveTab] = useState<OverlayTab>('profile')
  const [formOpen, setFormOpen] = useState(false)
  const [formTab, setFormTab] = useState<'schedule' | 'info'>('schedule')
  const [schedulePage, setSchedulePage] = useState(0)
  const [heroIndex, setHeroIndex] = useState(0)
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([])

  const fallbackMeta = FALLBACK_STAFF_META[hit.name] ?? null
  const dayFormatter = useMemo(
    () => new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' }),
    [],
  )
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }),
    [],
  )

  const specialties = useMemo(
    () => (Array.isArray(hit.specialties) ? hit.specialties.filter(Boolean).slice(0, 6) : []),
    [hit.specialties],
  )

  const contactItems = useMemo(
    () => [
      {
        key: 'tel',
        label: '電話予約',
        value: tel ? `TEL ${tel}` : '未登録',
        helper: '24時間受付（折り返し連絡）',
      },
      {
        key: 'line',
        label: 'LINE相談',
        value: lineId ? `ID ${lineId}` : '準備中',
        helper: '空き状況や指名のご相談に',
      },
    ],
    [lineId, tel],
  )

  const heroImages = useMemo(() => {
    const sources: string[] = []
    const seen = new Set<string>()
    const push = (src?: string | null) => {
      if (!src || seen.has(src)) return
      seen.add(src)
      sources.push(src)
    }
    if (Array.isArray(gallery)) gallery.forEach((src) => push(src))
    if (Array.isArray(fallbackMeta?.gallery)) fallbackMeta.gallery.forEach((src) => push(src))
    push(hit.avatarUrl)
    return sources.length ? sources : [null]
  }, [gallery, fallbackMeta?.gallery, hit.avatarUrl])

  useEffect(() => {
    if (heroIndex >= heroImages.length) setHeroIndex(0)
  }, [heroImages.length, heroIndex])

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const availabilitySource = useMemo(() => {
    if (Array.isArray(availabilityDays) && availabilityDays.length) return availabilityDays
    if (!Array.isArray(fallbackMeta?.availability) || fallbackMeta.availability.length === 0) return []
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    return fallbackMeta.availability.map((template) => {
      const date = new Date(base)
      date.setDate(base.getDate() + template.dayOffset)
      const iso = formatLocalDate(date)
      return {
        date: iso,
        is_today: template.dayOffset === 0,
        slots: template.slots.map((slot) => {
          const start = new Date(date)
          start.setHours(slot.hour, slot.minute, 0, 0)
          const end = new Date(start)
          end.setMinutes(end.getMinutes() + slot.durationMinutes)
          return {
            start_at: toIsoWithOffset(start),
            end_at: toIsoWithOffset(end),
            status: slot.status,
          }
        }),
      }
    })
  }, [availabilityDays, fallbackMeta?.availability])

  const normalizedAvailability = useMemo<NormalizedDay[]>(() => {
    const days = Array.isArray(availabilitySource) ? availabilitySource : []
    return days
      .map<NormalizedDay>((day) => ({
        date: day.date,
        label: dayFormatter.format(new Date(day.date)),
        isToday: Boolean(day.is_today) || day.date === todayIso,
        slots: (Array.isArray(day.slots) ? day.slots : []).map((slot) => ({
            start_at: slot.start_at,
            end_at: slot.end_at,
            status: slot.status,
            timeKey: slot.start_at.slice(11, 16),
          })),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [availabilitySource, dayFormatter, todayIso])

  const timelineTimes = useMemo(() => {
    const activeMinutes: number[] = []

    normalizedAvailability.forEach((day) => {
      day.slots.forEach((slot) => {
        const start = new Date(slot.start_at)
        const end = new Date(slot.end_at)
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return
        const step = 30
        const startMinutes = start.getHours() * 60 + start.getMinutes()
        const endMinutes = end.getHours() * 60 + end.getMinutes()
        for (let minutes = startMinutes; minutes < endMinutes; minutes += step) {
          activeMinutes.push(minutes)
        }
      })
    })

    if (!activeMinutes.length) {
      const fallback: { key: string; label: string }[] = []
      for (let minutes = 10 * 60; minutes <= 22 * 60; minutes += 30) {
        const hour = Math.floor(minutes / 60)
        const minute = minutes % 60
        const key = `${pad(hour)}:${pad(minute)}`
        fallback.push({ key, label: `${hour}:${minute.toString().padStart(2, '0')}`.replace(/^0/, '') })
      }
      return fallback
    }

    activeMinutes.sort((a, b) => a - b)
    const minMinutes = Math.max(0, activeMinutes[0] - 30)
    const maxMinutes = Math.min(24 * 60, activeMinutes[activeMinutes.length - 1] + 60)

    const times: { key: string; label: string }[] = []
    for (let minutes = minMinutes; minutes <= maxMinutes; minutes += 30) {
      const hour = Math.floor(minutes / 60)
      const minute = minutes % 60
      const key = `${pad(hour)}:${pad(minute)}`
      times.push({ key, label: `${hour}:${minute.toString().padStart(2, '0')}`.replace(/^0/, '') })
    }
    return times
  }, [normalizedAvailability])

  const schedulePages = useMemo(() => {
    const chunkSize = 7
    if (!normalizedAvailability.length) {
      const base = new Date(todayIso)
      base.setHours(0, 0, 0, 0)
      const page: NormalizedDay[] = Array.from({ length: chunkSize }).map((_, offset) => {
        const date = new Date(base)
        date.setDate(base.getDate() + offset)
        const iso = date.toISOString().slice(0, 10)
        return {
          date: iso,
          label: dayFormatter.format(date),
          isToday: iso === todayIso,
          slots: [],
        }
      })
      return [page]
    }

    const dayMap = new Map(normalizedAvailability.map((day) => [day.date, day]))
    const firstDate = normalizedAvailability[0]?.date ?? todayIso
    const base = new Date(firstDate)
    base.setHours(0, 0, 0, 0)
    const totalDays = Math.max(normalizedAvailability.length, chunkSize)
    const pageCount = Math.max(1, Math.ceil(totalDays / chunkSize))
    const pages: NormalizedDay[][] = []

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const page: NormalizedDay[] = []
      for (let offset = 0; offset < chunkSize; offset++) {
        const date = new Date(base)
        date.setDate(base.getDate() + pageIndex * chunkSize + offset)
        const iso = date.toISOString().slice(0, 10)
        const existing = dayMap.get(iso)
        page.push(
          existing ?? {
            date: iso,
            label: dayFormatter.format(date),
            isToday: iso === todayIso,
            slots: [],
          },
        )
      }
      pages.push(page)
    }

    return pages
  }, [dayFormatter, normalizedAvailability, todayIso])

  const currentScheduleDays = useMemo(
    () => schedulePages[schedulePage] ?? schedulePages[0] ?? [],
    [schedulePage, schedulePages],
  )

  const currentMonthLabel = useMemo(() => {
    const day = currentScheduleDays[0]
    if (!day) return ''
    const date = new Date(`${day.date}T00:00:00`)
    if (Number.isNaN(date.getTime())) return day.label
    return `${date.getFullYear()}年${date.getMonth() + 1}月`
  }, [currentScheduleDays])

  useEffect(() => {
    if (schedulePage >= schedulePages.length) {
      setSchedulePage(Math.max(0, schedulePages.length - 1))
    }
  }, [schedulePage, schedulePages.length])

  useEffect(() => {
    if (!defaultStart || selectedSlots.length) return
    const match = normalizedAvailability
      .flatMap((day) => day.slots.map((slot) => ({ day, slot })))
      .find(({ slot }) => slot.start_at === defaultStart)
    if (match) {
      setSelectedSlots([
        {
          startAt: match.slot.start_at,
          endAt: match.slot.end_at,
          date: match.day.date,
          status: match.slot.status,
        },
      ])
    }
  }, [defaultStart, normalizedAvailability, selectedSlots.length])

  const toggleSlot = (day: NormalizedDay, slot: NormalizedSlot) => {
    if (slot.status === 'blocked') return
    setSelectedSlots((prev) => {
      const exists = prev.some((item) => item.startAt === slot.start_at)
      if (exists) {
        return prev.filter((item) => item.startAt !== slot.start_at)
      }
      const next = [...prev, { startAt: slot.start_at, endAt: slot.end_at, date: day.date, status: slot.status }]
      if (next.length > 3) next.shift()
      return next
    })
  }

  const ensureSelection = useCallback(() => {
    if (selectedSlots.length) return selectedSlots
    const first = normalizedAvailability
      .flatMap((day) => day.slots.map((slot) => ({ day, slot })))
      .find(({ slot }) => slot.status !== 'blocked')
    if (first) {
      const slot = first.slot
      const initial = { startAt: slot.start_at, endAt: slot.end_at, date: first.day.date, status: slot.status } as const
      setSelectedSlots([initial])
      return [initial]
    }
    return []
  }, [normalizedAvailability, selectedSlots])

  const handleClose = useCallback(() => {
    setFormOpen(false)
    onClose()
  }, [onClose])

  const handleFormBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
    setFormOpen(false)
  }

  const legendItems = useMemo(
    () => [
      { key: 'open', label: AVAILABILITY_STATUS_META.open.label, icon: '●', iconClass: 'border-emerald-400 bg-emerald-500 text-white' },
      { key: 'tentative', label: AVAILABILITY_STATUS_META.tentative.label, icon: AVAILABILITY_STATUS_META.tentative.icon, iconClass: 'border-amber-300 bg-amber-100 text-amber-600' },
      { key: 'blocked', label: AVAILABILITY_STATUS_META.blocked.label, icon: AVAILABILITY_STATUS_META.blocked.icon, iconClass: 'border-white/70 bg-white text-neutral-textMuted' },
    ],
    [],
  )

  const statusBadgeClasses: Record<AvailabilityStatus, string> = {
    open: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600',
    tentative: 'border-amber-500/40 bg-amber-500/15 text-amber-600',
    blocked: 'border-neutral-borderLight/70 bg-neutral-borderLight/30 text-neutral-textMuted',
  }

  const tabs: Array<{ key: OverlayTab; label: string; helper?: string }> = [
    { key: 'profile', label: 'プロフィール' },
    { key: 'reviews', label: '口コミ' },
    { key: 'booking', label: '空き状況・予約', helper: '候補枠を最大3枠まで選択できます' },
  ]

  const bookingSteps = [
    { key: 'schedule', label: '日程選択', description: 'ご希望の日時をタップ' },
    { key: 'course', label: 'コース選択', description: '希望コース・オプション' },
    { key: 'info', label: 'お客様情報', description: '連絡先と要望を入力' },
  ] as const

  const detailItems = useMemo(() => {
    const base: Array<{ label: string; value: string }> = []
    const seen = new Set<string>()
    const append = (item?: { label: string; value: string }) => {
      if (!item?.label || !item.value || seen.has(item.label)) return
      seen.add(item.label)
      base.push(item)
    }
    const primary = Array.isArray(profileDetails) ? profileDetails : []
    const fallback = Array.isArray(fallbackMeta?.details) ? fallbackMeta.details : []
    primary.forEach((item) => append(item))
    fallback.forEach((item) => append(item))
    if (!seen.has('得意な施術') && specialties.length) {
      append({ label: '得意な施術', value: specialties.join(' / ') })
    }
    return base
  }, [profileDetails, fallbackMeta?.details, specialties])

  const reviewSummary = hit.reviewCount
    ? `口コミ ${hit.reviewCount}件のうち評価 ${hit.rating ? hit.rating.toFixed(1) : '---'}★`
    : '口コミデータの集計を準備中です。'

  const summaryBio = profileBio ?? fallbackMeta?.bio ?? hit.headline ?? null
  const summarySchedule = profileSchedule ?? fallbackMeta?.schedule ?? null
  const summaryPricing = profilePricing ?? fallbackMeta?.pricing ?? null
  const optionsList = useMemo(() => {
    const primary = Array.isArray(profileOptions) ? profileOptions.filter(Boolean) : []
    if (primary.length) return primary
    const fallback = Array.isArray(fallbackMeta?.options) ? fallbackMeta.options.filter(Boolean) : []
    return fallback
  }, [profileOptions, fallbackMeta?.options])

  const pricingItems = useMemo(() => {
    const source = profilePricing ?? summaryPricing ?? ''
    if (!source) return []
    return source
      .split(/[／/]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part, index) => {
        const priceMatch = part.match(/¥[\d,]+|[0-9]+(?:,?[0-9]{3})*円/)
        const durationMatch = part.match(/[0-9]+分/)
        const price = priceMatch?.[0]?.replace(/円$/, '円') ?? null
        const duration = durationMatch?.[0] ?? null
        const durationMinutes = duration ? Number.parseInt(duration.replace(/\D/g, ''), 10) || null : null
        let title = part
        if (price) title = title.replace(price, '').trim()
        if (duration) title = title.replace(duration, '').trim()
        title = title.replace(/[()（）]/g, '').trim()
        if (!title) title = `コース ${index + 1}`
        return { title, duration, price, durationMinutes }
      })
  }, [profilePricing, summaryPricing])

  const courseOptions = useMemo(
    () =>
      pricingItems.map((item, index) => ({
        id: `course-${index}`,
        label: [item.title, item.duration].filter(Boolean).join(' ').trim(),
        durationMinutes: item.durationMinutes ?? undefined,
        priceLabel: item.price ?? undefined,
      })),
    [pricingItems],
  )

  const selectedSlotKeys = useMemo(() => new Set(selectedSlots.map((slot) => slot.startAt)), [selectedSlots])

  const selectedSlotList = selectedSlots.map((slot, index) => {
    const badgeClass = statusBadgeClasses[slot.status]
    const meta = AVAILABILITY_STATUS_META[slot.status]
    return (
      <li
        key={slot.startAt}
        className="rounded-[24px] bg-gradient-to-br from-brand-primary/12 via-white to-white px-5 py-4 shadow-[0_14px_38px_rgba(37,99,235,0.18)] ring-1 ring-white/60"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-text">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-brand-primary">
              第{index + 1}候補
            </span>
            <div className="font-semibold">
              {dayFormatter.format(new Date(slot.date))}{' '}
              {timeFormatter.format(new Date(slot.startAt))}〜{timeFormatter.format(new Date(slot.endAt))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={clsx('inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold', badgeClass)}>
              <span aria-hidden>{meta.icon}</span>
              {meta.label}
            </span>
            <button
              type="button"
              onClick={() =>
                toggleSlot(
                  { date: slot.date, label: dayFormatter.format(new Date(slot.date)), isToday: false, slots: [] },
                  { start_at: slot.startAt, end_at: slot.endAt, status: slot.status, timeKey: slot.startAt.slice(11, 16) },
                )
              }
              className="text-xs font-semibold text-brand-primary underline-offset-2 hover:underline"
            >
              削除
            </button>
          </div>
        </div>
      </li>
    )
  })

  const scheduleRangeLabel = currentScheduleDays.length
    ? `${currentScheduleDays[0].label}〜${currentScheduleDays[currentScheduleDays.length - 1].label}`
    : '空き状況'

  const schedulePageCount = schedulePages.length
  const hasAvailability = normalizedAvailability.some((day) => day.slots.length)

  const handleOpenForm = useCallback(() => {
    ensureSelection()
    setActiveTab('booking')
    setSchedulePage(0)
    setFormTab(hasAvailability ? 'schedule' : 'info')
    setFormOpen(true)
  }, [ensureSelection, hasAvailability])

  useEffect(() => {
    if (!formOpen) return
    setFormTab(hasAvailability ? 'schedule' : 'info')
  }, [formOpen, hasAvailability])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (formOpen) {
        setFormOpen(false)
      } else {
        handleClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [formOpen, handleClose])

  return (
    <>
      <div className="fixed inset-0 z-[998] overflow-y-auto bg-neutral-950/45 backdrop-blur-sm">
        <div className="relative flex min-h-full items-center justify-center px-4 py-8 sm:px-6 sm:py-14 lg:py-16">
          <div className="absolute inset-0" onClick={handleClose} aria-hidden="true" />
          <div
            className="relative z-10 w-full max-w-5xl overflow-hidden rounded-[40px] border border-white/40 bg-white/55 shadow-[0_50px_150px_rgba(37,99,235,0.38)] backdrop-blur-[36px]"
            role="dialog"
            aria-modal="true"
            aria-label={`${hit.name}の予約詳細`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/90 text-neutral-text shadow-sm shadow-brand-primary/10 transition hover:border-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/40"
              aria-label="予約パネルを閉じる"
            >
              ✕
            </button>
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22)_0%,rgba(37,99,235,0)_65%),radial-gradient(circle_at_bottom_left,rgba(96,165,250,0.18)_0%,rgba(96,165,250,0)_60%),linear-gradient(135deg,rgba(255,255,255,0.92)_0%,rgba(236,245,255,0.62)_45%,rgba(219,234,254,0.55)_100%)]" />

            <div className="flex max-h-[calc(100vh-8rem)] flex-col overflow-y-auto">
            <div className="w-full space-y-10 p-6 sm:p-8 lg:p-12">
              <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <div className="relative overflow-hidden rounded-[36px] border border-white/45 bg-white/25 shadow-[0_28px_90px_rgba(21,93,252,0.28)] backdrop-blur-[28px]">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(147,197,253,0.24)_0%,rgba(147,197,253,0)_60%),linear-gradient(200deg,rgba(255,255,255,0.75)_0%,rgba(240,248,255,0.35)_55%,rgba(227,233,255,0.25)_100%),url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22%3E%3Cpath d=%22M0 39h1v1H0zM39 0h1v1h-1z%22 fill=%22%23ffffff33%22/%3E%3C/svg%3E')]" />
                  <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[5/4] lg:aspect-square">
                    {heroImages.map((src, index) => (
                      <div
                        key={src ?? `fallback-${index}`}
                          className={clsx(
                            'absolute inset-0 transition-opacity duration-500 ease-out',
                            index === heroIndex ? 'opacity-100' : 'pointer-events-none opacity-0',
                          )}
                        >
                          {src ? (
                            <Image
                              src={src}
                              alt={`${hit.name}の写真${index ? ` ${index + 1}` : ''}`}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 80vw, 480px"
                              priority={index === heroIndex}
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-4xl font-semibold text-brand-primary">
                              <span>{hit.name.slice(0, 1)}</span>
                            </div>
                          )}
                        </div>
                      ))}
                      {heroImages.length > 1 ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setHeroIndex((prev) => (prev - 1 + heroImages.length) % heroImages.length)}
                            className="absolute left-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/85 text-lg text-brand-primary shadow-sm shadow-brand-primary/20 transition hover:bg-white"
                            aria-label="前の写真"
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            onClick={() => setHeroIndex((prev) => (prev + 1) % heroImages.length)}
                            className="absolute right-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/85 text-lg text-brand-primary shadow-sm shadow-brand-primary/20 transition hover:bg-white"
                            aria-label="次の写真"
                          >
                            →
                          </button>
                        </>
                      ) : null}

                      <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-1 text-xs font-semibold text-brand-primary shadow-sm shadow-brand-primary/25">
                        <span aria-hidden>★</span>
                        {hit.rating ? hit.rating.toFixed(1) : '評価準備中'}
                        {hit.reviewCount ? (
                          <span className="text-[11px] font-medium text-neutral-textMuted">口コミ {hit.reviewCount}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                <div className="relative flex flex-col gap-5 overflow-hidden rounded-[36px] border border-white/50 bg-white/28 p-6 shadow-[0_32px_90px_rgba(21,93,252,0.28)] backdrop-blur-[26px]">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.22),transparent_58%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.2),transparent_55%),url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22%3E%3Cpath d=%22M0 47h1v1H0zM47 0h1v1h-1z%22 fill=%22%23ffffff29%22/%3E%3C/svg%3E')]" />
                  <div className="relative flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-primary">
                        WEB予約リクエスト
                      </span>
                      <div className="space-y-1">
                        <h2 className="text-2xl font-semibold text-neutral-text sm:text-3xl">{hit.name}</h2>
                        {hit.shopName ? (
                          <p className="text-sm text-neutral-textMuted">
                            {hit.shopAreaName || hit.shopArea || '掲載準備中'}・{hit.shopName}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[24px] border border-white/55 bg-white/45 p-3 text-xs text-neutral-text shadow-[0_16px_40px_rgba(21,93,252,0.22)] backdrop-blur-sm">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-textMuted">評価</div>
                        <div className="mt-1 text-sm font-semibold text-neutral-text">
                          {hit.rating ? `${hit.rating.toFixed(1)} / 5.0` : '準備中'}
                        </div>
                        {hit.reviewCount ? <div className="text-[11px] text-neutral-textMuted">口コミ {hit.reviewCount}</div> : null}
                      </div>
                      <div className="rounded-[24px] border border-white/55 bg-white/45 p-3 text-xs text-neutral-text shadow-[0_16px_40px_rgba(21,93,252,0.22)] backdrop-blur-sm">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-textMuted">出勤予定</div>
                        <div className="mt-1 text-sm font-semibold text-neutral-text">
                          {summarySchedule ?? '確認中です。フォームからお問い合わせください。'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenForm}
                      className="mt-auto inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(37,99,235,0.25)] transition hover:from-brand-primary/90 hover:to-brand-secondary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/40"
                    >
                      予約フォームを開く
                    </button>
                  </div>
                </div>
              </section>

              <section className="space-y-6 rounded-[32px] border border-white/60 bg-white/92 p-1.5 shadow-[0_20px_70px_rgba(21,93,252,0.18)]">
                  <div className="flex flex-wrap items-center gap-2 rounded-[28px] bg-white/85 p-2">
                    {tabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          setActiveTab(tab.key)
                          if (tab.key === 'booking') ensureSelection()
                        }}
                        className={clsx(
                          'flex-1 rounded-[24px] px-4 py-2 text-sm font-semibold transition sm:flex-none',
                          tab.key === activeTab
                            ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-[0_12px_35px_rgba(37,99,235,0.22)]'
                            : 'text-neutral-text hover:bg-white',
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {tabs.find((tab) => tab.key === activeTab)?.helper ? (
                    <p className="px-4 text-[11px] text-neutral-textMuted">
                      {tabs.find((tab) => tab.key === activeTab)?.helper}
                    </p>
                  ) : null}

                  {activeTab === 'profile' ? (
                    <div className="space-y-6 px-4 pb-6 text-sm text-neutral-text">
                      <div className="grid gap-6">
                        <div className="rounded-[32px] bg-gradient-to-br from-[#e8f2ff] via-white to-white p-6 shadow-[0_24px_80px_rgba(37,99,235,0.18)] ring-1 ring-white/60">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-base font-semibold text-neutral-text">プロフィール</h3>
                              <p className="text-xs text-neutral-textMuted">得意分野や基本情報をまとめています</p>
                            </div>
                            {hit.reviewCount ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-3 py-1 text-[11px] font-semibold text-brand-primary">
                                ★ {hit.rating ? hit.rating.toFixed(1) : '--'} / {hit.reviewCount}件
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div className="space-y-3">
                              <div className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 text-sm leading-relaxed text-neutral-text shadow-sm shadow-brand-primary/10">
                                {summaryBio ?? 'プロフィール情報は順次掲載予定です。'}
                              </div>
                              {specialties.length ? (
                                <div className="flex flex-wrap gap-2">
                                  {specialties.map((tag) => (
                                    <span
                                      key={tag}
                                      className="inline-flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold text-brand-primary"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          {detailItems.length || optionsList.length ? (
                            <div className="grid gap-3">
                              {detailItems.map((item) => (
                                <div
                                  key={`${item.label}-${item.value}`}
                                  className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 text-sm font-semibold text-neutral-text shadow-sm shadow-brand-primary/10"
                                >
                                  <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-textMuted">
                                    {item.label}
                                  </div>
                                  <div className="mt-1 text-sm">{item.value}</div>
                                </div>
                              ))}
                              {optionsList.length ? (
                                <div className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 text-sm shadow-sm shadow-brand-primary/10">
                                  <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-textMuted">
                                    オプション・対応メニュー
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                    {optionsList.map((option) => (
                                      <span
                                        key={`option-${option}`}
                                        className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-3 py-1 font-semibold text-brand-primary"
                                      >
                                        ✦ {option}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-[32px] bg-gradient-to-br from-white via-white to-[#f1f6ff] p-6 shadow-[0_18px_60px_rgba(37,99,235,0.16)] ring-1 ring-white/60">
                            <div className="text-xs font-semibold uppercase tracking-wide text-brand-primary">出勤予定</div>
                            <p className="mt-3 text-sm leading-6 text-neutral-text">
                              {summarySchedule ?? '最新スケジュールはお問い合わせください。'}
                            </p>
                          </div>
                          <div className="rounded-[32px] bg-gradient-to-br from-[#f5faff] via-white to-white p-6 shadow-[0_18px_60px_rgba(37,99,235,0.16)] ring-1 ring-white/60">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-brand-primary">コース料金</div>
                                <p className="mt-1 text-[11px] text-neutral-textMuted">サロンの代表的なコースをご覧ください</p>
                              </div>
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-3 py-1 text-[11px] font-semibold text-brand-primary">
                                料金の目安
                              </span>
                            </div>
                            {pricingItems.length ? (
                              <ul className="mt-4 space-y-3">
                                {pricingItems.map(({ title, duration, price }, index) => (
                                  <li
                                    key={`${title}-${price ?? index}`}
                                    className="flex items-center justify-between gap-3 rounded-[24px] bg-white/90 px-4 py-3 text-sm font-semibold text-neutral-text shadow-sm shadow-brand-primary/10"
                                  >
                                    <div className="space-y-0.5">
                                      <div>{title}</div>
                                      {duration ? <div className="text-xs font-medium text-neutral-textMuted">{duration}</div> : null}
                                    </div>
                                    {price ? <div className="text-base font-semibold text-brand-primary">{price}</div> : null}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-3 text-xs text-neutral-textMuted">料金情報はお問い合わせください。</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeTab === 'reviews' ? (
                    <div className="space-y-6 px-4 pb-6 text-sm text-neutral-text">
                      <div className="rounded-[32px] bg-gradient-to-br from-[#f6f9ff] via-white to-white p-6 shadow-[0_24px_80px_rgba(37,99,235,0.16)] ring-1 ring-white/60">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-base font-semibold text-neutral-text">口コミハイライト</h3>
                            <p className="text-xs text-neutral-textMuted">人気の理由をピックアップしました</p>
                          </div>
                          {hit.rating ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-3 py-1 text-[11px] font-semibold text-brand-primary">
                              ★ {hit.rating.toFixed(1)}
                              {hit.reviewCount ? <span className="text-[10px] font-medium text-neutral-textMuted">/{hit.reviewCount}件</span> : null}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-4 leading-relaxed">
                          {reviewSummary}
                        </p>
                        {specialties.length ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {specialties.map((tag) => (
                              <span
                                key={`review-${tag}`}
                                className="inline-flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold text-brand-primary"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-[28px] border border-white/70 bg-white/95 p-6 shadow-[0_18px_60px_rgba(21,93,252,0.16)]">
                        <h4 className="text-base font-semibold text-neutral-text">最近寄せられた声</h4>
                        <ul className="mt-4 space-y-4 text-sm leading-relaxed text-neutral-text">
                          <li>
                            <span className="font-semibold text-brand-primaryDark">丁寧な対応:</span> 施術中も細やかに声を掛けてくれて安心できたというコメントが多く寄せられています。
                          </li>
                          <li>
                            <span className="font-semibold text-brand-primaryDark">技術力の高さ:</span> リンパケアやストレッチなど、複数の手技を組み合わせた施術が好評です。
                          </li>
                          <li>
                            <span className="font-semibold text-brand-primaryDark">サロンの雰囲気:</span> ゆったりした音楽と照明でリラックスできたとの声が目立ちます。
                          </li>
                        </ul>
                        <button
                          type="button"
                          onClick={handleOpenForm}
                          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(37,99,235,0.25)] transition hover:from-brand-primary/90 hover:to-brand-secondary/90"
                        >
                          予約フォームへ進む
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {activeTab === 'booking' ? (
                    <div className="space-y-6 px-4 pb-6 text-sm text-neutral-text">
                      <div className="rounded-[32px] bg-gradient-to-br from-[#eef4ff] via-white to-white p-6 shadow-[0_24px_80px_rgba(37,99,235,0.18)] ring-1 ring-white/60">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <h3 className="text-base font-semibold text-neutral-text">希望日時を選択</h3>
                            <p className="text-xs text-neutral-textMuted">最大3枠まで候補を追加できます。◯をタップしてください。</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-1 text-xs font-semibold text-brand-primary shadow-sm shadow-brand-primary/10">
                              {scheduleRangeLabel}
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-1 text-[11px] font-semibold text-brand-primary">
                              ⭐️ {hasAvailability ? '公開枠あり' : 'お問い合わせで調整'}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/60 bg-white/75 px-4 py-2 text-[11px] font-semibold text-neutral-text">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setSchedulePage((prev) => Math.max(prev - 1, 0))}
                              disabled={schedulePage === 0}
                              className={clsx(
                                'inline-flex h-9 w-9 items-center justify-center rounded-full border transition',
                                schedulePage === 0
                                  ? 'cursor-not-allowed border-white/60 text-neutral-textMuted'
                                  : 'border-brand-primary/20 bg-white text-brand-primary hover:border-brand-primary/40',
                              )}
                              aria-label="前の週を表示"
                            >
                              ←
                            </button>
                            <div className="text-sm text-neutral-text">{currentMonthLabel}</div>
                            <button
                              type="button"
                              onClick={() => setSchedulePage((prev) => Math.min(prev + 1, schedulePageCount - 1))}
                              disabled={schedulePage >= schedulePageCount - 1}
                              className={clsx(
                                'inline-flex h-9 w-9 items-center justify-center rounded-full border transition',
                                schedulePage >= schedulePageCount - 1
                                  ? 'cursor-not-allowed border-white/60 text-neutral-textMuted'
                                  : 'border-brand-primary/20 bg-white text-brand-primary hover:border-brand-primary/40',
                              )}
                              aria-label="次の週を表示"
                            >
                              →
                            </button>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-neutral-textMuted">
                              {schedulePage + 1} / {schedulePageCount}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSchedulePage(0)}
                              disabled={schedulePage === 0}
                              className={clsx(
                                'rounded-full px-3 py-1 text-xs transition',
                                schedulePage === 0
                                  ? 'cursor-not-allowed border border-white/60 text-neutral-textMuted'
                                  : 'border border-brand-primary/20 bg-white text-brand-primary hover:border-brand-primary/40',
                              )}
                            >
                              今週
                            </button>
                          </div>
                        </div>

                        <div className="mt-6 space-y-6">
                          <div className="hidden lg:block">
                            <AvailabilityPickerDesktop
                              days={currentScheduleDays}
                              timeline={timelineTimes ?? []}
                              selected={selectedSlots}
                              onToggle={toggleSlot}
                              timeFormatter={timeFormatter}
                            />
                          </div>
                          <div className="lg:hidden">
                            <AvailabilityPickerMobile
                              days={currentScheduleDays}
                              timeline={timelineTimes ?? []}
                              selected={selectedSlots}
                              onToggle={toggleSlot}
                              timeFormatter={timeFormatter}
                            />
                          </div>
                        </div>

                        <div className="mt-6 flex flex-wrap items-center gap-3 text-[11px] text-neutral-textMuted">
                          <span className="font-semibold text-neutral-text">凡例</span>
                          {legendItems.map((item) => (
                            <span
                              key={item.key}
                              className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-3 py-1 font-semibold text-neutral-text"
                            >
                              <span
                                aria-hidden
                                className={clsx(
                                  'flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold',
                                  item.iconClass,
                                )}
                              >
                                {item.icon}
                              </span>
                              {item.label}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                        <div className="space-y-4 rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_18px_60px_rgba(21,93,252,0.12)]">
                          <h4 className="text-sm font-semibold text-neutral-text">選択中の候補</h4>
                          {selectedSlots.length ? (
                            <ul className="space-y-3">{selectedSlotList}</ul>
                          ) : (
                            <div className="rounded-[24px] border border-dashed border-brand-primary/30 bg-brand-primary/5 px-4 py-6 text-center text-xs text-brand-primary">
                              候補枠が選択されていません。時間をタップして追加してください。
                            </div>
                          )}
                          <p className="text-[11px] text-neutral-textMuted">
                            最大3枠まで提示できます。フォーム送信後は担当者が調整して折り返します。
                          </p>
                        </div>
                        <div className="space-y-4">
                          <div className="rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_18px_60px_rgba(21,93,252,0.12)]">
                            <h4 className="text-sm font-semibold text-neutral-text">お問い合わせ方法</h4>
                            <ul className="mt-4 space-y-3 text-sm">
                              {contactItems.map((item) => (
                                <li
                                  key={item.key}
                                  className="flex flex-col gap-1 rounded-[24px] border border-white/70 bg-white/90 px-4 py-3 shadow-sm shadow-brand-primary/10"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold text-neutral-text">{item.label}</span>
                                    <span className="text-xs font-semibold text-brand-primary">{item.value}</span>
                                  </div>
                                  <span className="text-[11px] text-neutral-textMuted">{item.helper}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <button
                            type="button"
                            onClick={handleOpenForm}
                            className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(37,99,235,0.25)] transition hover:from-brand-primary/90 hover:to-brand-secondary/90"
                          >
                            予約フォームに進む
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-[999] overflow-y-auto bg-neutral-950/60 backdrop-blur-sm">
          <div className="relative mx-auto flex min-h-full max-w-4xl flex-col justify-center px-4 py-10 sm:px-6 sm:py-14">
            <div className="absolute inset-0" onClick={handleFormBackdrop} aria-hidden="true" />
            <div
              className="relative z-10 overflow-hidden rounded-[32px] border border-white/40 bg-white/98 shadow-[0_36px_120px_rgba(21,93,252,0.32)]"
              role="dialog"
              aria-modal="true"
              aria-label={`${hit.name}の予約フォーム`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-4 border-b border-white/60 bg-white/90 px-6 py-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-primary">Reservation</div>
                  <h2 className="text-lg font-semibold text-neutral-text">{hit.name}の予約フォーム</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/95 text-neutral-text shadow-sm shadow-brand-primary/10 transition hover:border-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/40"
                  aria-label="予約フォームを閉じる"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6 p-6 sm:p-8">
                <div className="rounded-[28px] border border-white/70 bg-white/95 p-4">
                  <ol className="flex flex-wrap items-center gap-3 text-xs font-semibold text-neutral-textMuted">
                    {bookingSteps.map((step, index) => (
                      <li key={step.key} className="flex items-center gap-2">
                        <span
                          className={clsx(
                            'inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/70 bg-white text-sm',
                            (formTab === 'schedule' && step.key === 'schedule') ||
                              (formTab === 'info' && step.key !== 'schedule')
                              ? 'border-brand-primary bg-brand-primary text-white shadow-[0_8px_25px_rgba(21,93,252,0.25)]'
                              : 'text-brand-primary',
                          )}
                        >
                          {index + 1}
                        </span>
                        <div>
                          <div className="text-xs font-semibold text-neutral-text">{step.label}</div>
                          <div className="text-[10px] text-neutral-textMuted">{step.description}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="flex flex-col gap-3 rounded-[24px] border border-white/70 bg-white/90 p-2 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setFormTab('schedule')}
                    className={clsx(
                      'rounded-[20px] px-4 py-2 text-sm font-semibold',
                      formTab === 'schedule'
                        ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-[0_12px_40px_rgba(37,99,235,0.25)]'
                        : 'text-neutral-text hover:bg-white',
                    )}
                  >
                    日程・コース
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTab('info')}
                    className={clsx(
                      'rounded-[20px] px-4 py-2 text-sm font-semibold',
                      formTab === 'info'
                        ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-[0_12px_40px_rgba(37,99,235,0.25)]'
                        : 'text-neutral-text hover:bg-white',
                    )}
                  >
                    お客様情報
                  </button>
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                  <div
                    className={clsx(
                      'flex flex-col gap-5',
                      formTab === 'info' ? 'hidden lg:flex' : 'flex',
                    )}
                  >
                    <div className="rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-[0_18px_60px_rgba(21,93,252,0.14)]">
                      <h3 className="text-sm font-semibold text-neutral-text">候補枠の調整</h3>
                      <p className="mt-1 text-[11px] text-neutral-textMuted">
                        希望時間をタップして候補に追加してください。最大3枠まで登録できます。
                      </p>
                      <div className="mt-4 hidden md:block">
                        <AvailabilityPickerDesktop
                          days={currentScheduleDays}
                          selected={selectedSlots}
                          onToggle={toggleSlot}
                          dayFormatter={dayFormatter}
                          timeFormatter={timeFormatter}
                        />
                      </div>
                      <div className="md:hidden">
                        <AvailabilityPickerMobile
                          days={currentScheduleDays}
                          selected={selectedSlots}
                          onToggle={toggleSlot}
                          dayFormatter={dayFormatter}
                          timeFormatter={timeFormatter}
                        />
                      </div>
                    </div>
                    <div className="rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-[0_18px_60px_rgba(21,93,252,0.14)]">
                      <h3 className="text-sm font-semibold text-neutral-text">選択済み候補</h3>
                      {selectedSlots.length ? (
                        <ul className="mt-3 space-y-3">{selectedSlotList}</ul>
                      ) : (
                        <div className="mt-3 rounded-[24px] border border-dashed border-brand-primary/30 bg-brand-primary/5 px-4 py-6 text-center text-xs text-brand-primary">
                          候補枠が未選択です。空き時間を追加してください。
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setFormTab('info')}
                        className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(37,99,235,0.22)] transition hover:from-brand-primary/90 hover:to-brand-secondary/90 lg:hidden"
                      >
                        入力フォームへ進む
                      </button>
                    </div>
                  </div>

                  <div
                    className={clsx(
                      'flex flex-col gap-4',
                      formTab === 'schedule' ? 'hidden lg:flex' : 'flex',
                    )}
                  >
                    <div className="rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-[0_18px_60px_rgba(21,93,252,0.14)]">
                      <ReservationForm
                        shopId={hit.shopId}
                        shopName={hit.shopName}
                        staffId={hit.therapistId ?? hit.staffId}
                        tel={tel ?? undefined}
                        lineId={lineId ?? undefined}
                        defaultStart={selectedSlots[0]?.startAt ?? defaultStart ?? undefined}
                        defaultDurationMinutes={defaultDurationMinutes ?? undefined}
                        allowDemoSubmission={allowDemoSubmission}
                        selectedSlots={selectedSlots}
                        courseOptions={courseOptions}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
