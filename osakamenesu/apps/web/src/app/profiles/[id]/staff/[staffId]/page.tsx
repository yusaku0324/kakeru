import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'

import type { ReservationOverlayProps } from '@/components/ReservationOverlay'
import ReservationOverlayRoot from '@/components/ReservationOverlayRoot'
import ReservationOverlayTriggerButton from '@/components/ReservationOverlayTriggerButton'
import ShopReservationCardClient from '../../ShopReservationCardClient'
import type { TherapistHit } from '@/components/staff/TherapistCard'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Section } from '@/components/ui/Section'
import { buildStaffIdentifier, staffMatchesIdentifier, slugifyStaffIdentifier } from '@/lib/staff'
import { fetchShop, type ShopDetail, type StaffSummary } from '../../page'

function findStaff(shop: ShopDetail, staffId: string): StaffSummary | null {
  if (!staffId) return null
  const list = Array.isArray(shop.staff) ? shop.staff : []
  return list.find((member) => staffMatchesIdentifier(member, staffId)) || null
}

function buildShopHref(params: { id: string }) {
  return `/profiles/${params.id}`
}

function buildStaffHref(shopId: string, staff: StaffSummary) {
  const identifier = buildStaffIdentifier(staff, staff.id || staff.alias || staff.name || 'staff')
  return `/profiles/${shopId}/staff/${encodeURIComponent(identifier)}`
}

function listOtherStaff(shop: ShopDetail, currentId: string) {
  const list = Array.isArray(shop.staff) ? shop.staff : []
  return list.filter((member) => member.id !== currentId)
}

function formatSpecialties(list?: string[] | null) {
  return Array.isArray(list) ? list.filter(Boolean) : []
}

const SAMPLE_STAFF_PROFILE_EXTRAS: Record<string, {
  details?: Array<{ label: string; value: string }>
  gallery?: string[]
  bio?: string
  schedule?: string
  pricing?: string
  options?: string[]
}> = {
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
    options: ['ホットストーン追加', 'ドライヘッドスパ', 'リンパ集中ケア', '延長15分オプション'],
  },
}

type StaffPageProps = {
  params: { id: string; staffId: string }
  searchParams?: Record<string, string | string[] | undefined>
}

const dayFormatter = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr
  return dayFormatter.format(date)
}

function toTimeLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.slice(11, 16)
  return date
    .toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replace(/^24:/, '00:')
}

function toDateTimeLocal(iso?: string | null) {
  if (!iso) return undefined
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return undefined
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
}

function formatWaitLabel(startIso?: string | null) {
  if (!startIso) return null
  const target = new Date(startIso)
  if (Number.isNaN(target.getTime())) return null
  const now = new Date()
  const diffMs = target.getTime() - now.getTime()
  if (diffMs <= 0) return 'まもなく'
  const totalMinutes = Math.round(diffMs / 60_000)
  if (totalMinutes < 60) return `約${totalMinutes}分後`
  const totalHours = Math.floor(totalMinutes / 60)
  const remainMinutes = totalMinutes % 60
  if (totalHours < 24) {
    return `約${totalHours}時間${remainMinutes ? `${remainMinutes}分` : ''}後`
  }
  const days = Math.floor(totalHours / 24)
  const remainHours = totalHours % 24
  let label = `約${days}日`
  if (remainHours) label += `${remainHours}時間`
  if (remainMinutes && days < 3) label += `${remainMinutes}分`
  label += '後'
  return label
}

function computeSlotDurationMinutes(startIso?: string | null, endIso?: string | null): number | undefined {
  if (!startIso || !endIso) return undefined
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined
  const diff = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
  return diff || undefined
}

function parseBooleanParam(value?: string | string[] | null): boolean {
  if (!value) return false
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return false
  const normalized = raw.toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

const formatYen = (value: number) => `¥${Intl.NumberFormat('ja-JP').format(value)}`

export async function generateMetadata({ params }: StaffPageProps): Promise<Metadata> {
  const shop = await fetchShop(params.id)
  const staff = findStaff(shop, params.staffId)
  const title = staff ? `${staff.name}｜${shop.name}のセラピスト` : `${shop.name}｜セラピスト`
  const description = staff?.headline || `${shop.name}に在籍するセラピストのプロフィール`
  return { title, description }
}

export default async function StaffProfilePage({ params, searchParams }: StaffPageProps) {
  const shop = await fetchShop(params.id)
  const staff = findStaff(shop, params.staffId)

  if (!staff) {
    notFound()
  }

  const allowDemoSubmission = parseBooleanParam(searchParams?.force_demo_submit ?? null)

  const shopHref = buildShopHref(params)
  const baseStaffHref = buildStaffHref(params.id, staff)
  const staffId = staff.id
  const specialties = formatSpecialties(staff.specialties)
  const ratingLabel = typeof staff.rating === 'number' ? `${staff.rating.toFixed(1)} / 5.0` : null
  const reviewLabel = typeof staff.review_count === 'number' ? `${staff.review_count}件のクチコミ` : null
  const contact = shop.contact || {}
  const phone = contact.phone || null
  const lineId = contact.line_id ? contact.line_id.replace(/^@/, '') : null
  const menus = Array.isArray(shop.menus) ? shop.menus : []
  const otherStaff = listOtherStaff(shop, staff.id)
  const availabilityDays = Array.isArray(shop.availability_calendar?.days) ? shop.availability_calendar?.days ?? [] : []
  const normalizedStaffId = slugifyStaffIdentifier(staff.id) || slugifyStaffIdentifier(staff.alias) || slugifyStaffIdentifier(staff.name)
  const staffAvailabilityRaw = availabilityDays
    .map((day) => ({
      date: day.date,
      is_today: day.is_today,
      slots: (day.slots || []).filter((slot) => {
        if (!normalizedStaffId) return false
        const slotIdSlug = slugifyStaffIdentifier(slot.staff_id)
        return slotIdSlug === normalizedStaffId
      }),
    }))
    .filter((day) => day.slots.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  const staffAvailability =
    staffAvailabilityRaw.length > 0
      ? staffAvailabilityRaw
      : (() => {
          if (!normalizedStaffId) return []
          const staffIdentifier = staff.id || staff.alias || staff.name || normalizedStaffId
          const base = new Date()
          base.setHours(0, 0, 0, 0)
          const slotTemplates = [
            { startMinutes: 11 * 60, durationMinutes: 60, status: 'open' as const },
            { startMinutes: 13 * 60 + 30, durationMinutes: 60, status: 'open' as const },
            { startMinutes: 16 * 60, durationMinutes: 60, status: 'tentative' as const },
          ]
          const pad = (value: number) => value.toString().padStart(2, '0')
          const formatLocalDate = (date: Date) => {
            const year = date.getFullYear()
            const month = pad(date.getMonth() + 1)
            const day = pad(date.getDate())
            return `${year}-${month}-${day}`
          }
          const buildIso = (date: Date, minutesFromMidnight: number) => {
            const hours = Math.floor(minutesFromMidnight / 60)
            const minutes = minutesFromMidnight % 60
            const isoDate = formatLocalDate(date)
            return `${isoDate}T${pad(hours)}:${pad(minutes)}:00+09:00`
          }
          return Array.from({ length: 7 }).map((_, index) => {
            const date = new Date(base)
            date.setDate(base.getDate() + index)
            return {
              date: formatLocalDate(date),
              is_today: index === 0,
              slots: slotTemplates.map((template) => ({
                start_at: buildIso(date, template.startMinutes),
                end_at: buildIso(date, template.startMinutes + template.durationMinutes),
                status: template.status,
                staff_id: staffIdentifier,
              })),
            }
          })
        })()

  const slotParamValue = (() => {
    if (!searchParams) return undefined
    const value = searchParams.slot
    if (Array.isArray(value)) return value[0]
    return value
  })()

  const weekParamValue = (() => {
    if (!searchParams) return undefined
    const value = searchParams.week
    if (Array.isArray(value)) return value[0]
    return value
  })()

  function startOfWeek(dateStr: string) {
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return dateStr
    const day = date.getDay() || 7
    if (day !== 1) {
      date.setHours(-24 * (day - 1))
    }
    const iso = date.toISOString().slice(0, 10)
    return iso
  }

  const weeksMap = new Map<string, typeof staffAvailability>()
  for (const entry of staffAvailability) {
    const key = startOfWeek(entry.date)
    if (!weeksMap.has(key)) {
      weeksMap.set(key, [])
    }
    weeksMap.get(key)!.push(entry)
  }

  const weekKeys = [...weeksMap.keys()].sort()
  const weeks = weekKeys.map((key) => ({ key, days: weeksMap.get(key)! }))

  const defaultWeekIndex = (() => {
    const today = new Date().toISOString().slice(0, 10)
    const weekKey = startOfWeek(today)
    const index = weeks.findIndex((w) => w.key === weekKey)
    return index >= 0 ? index : 0
  })()

  const requestedWeekIndex = (() => {
    if (!weekParamValue) return defaultWeekIndex
    const idx = Number.parseInt(weekParamValue, 10)
    if (Number.isNaN(idx)) return defaultWeekIndex
    return Math.min(Math.max(idx, 0), Math.max(weeks.length - 1, 0))
  })()

  const currentWeek = weeks[requestedWeekIndex] ?? { key: '', days: staffAvailability }
  const displayDays = currentWeek.days
  const hasWeekNavigation = weeks.length > 1
  const weekStartIso = currentWeek.key || displayDays[0]?.date || new Date().toISOString().slice(0, 10)
  const weekStartDate = new Date(weekStartIso)
  const todayIso = new Date().toISOString().slice(0, 10)
  const weekColumns = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(weekStartDate.getTime())
    date.setDate(weekStartDate.getDate() + index)
    const iso = date.toISOString().slice(0, 10)
    const match = displayDays.find((day) => day.date === iso)
    if (match) return match
    return {
      date: iso,
      is_today: iso === todayIso,
      slots: [],
    }
  })
  const currentWeekRangeLabel = weekColumns.length
    ? `${formatDayLabel(weekColumns[0].date)} 〜 ${formatDayLabel(weekColumns[weekColumns.length - 1].date)}`
    : null

  const todayColumn = weekColumns.find((day) => day.date === todayIso) || null
  const todayOpenSlots = todayColumn?.slots.filter((slot) => slot.status === 'open') ?? []
  const todayReservedSlots = todayColumn?.slots.filter((slot) => slot.status === 'blocked') ?? []

  const buildWeekHref = (index: number) => {
    const urlParams = new URLSearchParams()
    if (index > 0) urlParams.set('week', String(index))
    const search = urlParams.toString()
    return `${buildStaffHref(params.id, staff)}${search ? `?${search}` : ''}`
  }

  const selectedSlotInfo = (() => {
    if (!slotParamValue) return null
    const target = Date.parse(slotParamValue)
    if (Number.isNaN(target)) return null
    for (const day of staffAvailability) {
      for (const slot of day.slots) {
        const start = Date.parse(slot.start_at)
        if (!Number.isNaN(start) && Math.abs(start - target) < 60_000) {
          return { day, slot }
        }
      }
    }
    return null
  })()

  const firstOpenSlotInfo = (() => {
    for (const day of staffAvailability) {
      const slot = day.slots.find((item) => item.status === 'open')
      if (slot) return { day, slot }
    }
    return null
  })()

  const chosenSlot = selectedSlotInfo ?? firstOpenSlotInfo
  const defaultSlotLocal = chosenSlot ? toDateTimeLocal(chosenSlot.slot.start_at) : undefined
  const defaultDurationMinutes = chosenSlot
    ? computeSlotDurationMinutes(chosenSlot.slot.start_at, chosenSlot.slot.end_at)
    : undefined
  const selectedSlotLabel = selectedSlotInfo
    ? `${formatDayLabel(selectedSlotInfo.day.date)} ${toTimeLabel(selectedSlotInfo.slot.start_at)}〜${toTimeLabel(selectedSlotInfo.slot.end_at)}`
    : null
  const slotStaffId = selectedSlotInfo?.slot.staff_id || staffId
  const slotStatusMap = {
    open: { label: '空き枠', badgeClass: 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30', icon: '◎' },
    tentative: { label: '要確認', badgeClass: 'bg-amber-100 text-amber-700 border border-amber-300', icon: '△' },
    blocked: { label: '予約済', badgeClass: 'bg-neutral-200 text-neutral-700 border border-neutral-300', icon: '×' },
  } as const
  type SlotStatus = keyof typeof slotStatusMap

  const nextAvailabilitySlot = (() => {
    for (const day of staffAvailability) {
      const slot = day.slots.find((item) => item.status === 'open')
      if (slot) return { day, slot }
    }
    for (const day of staffAvailability) {
      const slot = day.slots.find((item) => item.status === 'tentative')
      if (slot) return { day, slot }
    }
    return null
  })()

  const nextAvailabilitySummary = nextAvailabilitySlot
    ? {
        label: `${formatDayLabel(nextAvailabilitySlot.day.date)} ${toTimeLabel(nextAvailabilitySlot.slot.start_at)}〜${toTimeLabel(nextAvailabilitySlot.slot.end_at)}`,
        wait: formatWaitLabel(nextAvailabilitySlot.slot.start_at),
        status: slotStatusMap[nextAvailabilitySlot.slot.status as SlotStatus],
        defaultStart: toDateTimeLocal(nextAvailabilitySlot.slot.start_at),
        defaultDurationMinutes: computeSlotDurationMinutes(
          nextAvailabilitySlot.slot.start_at,
          nextAvailabilitySlot.slot.end_at,
        ),
      }
    : null

  const pageTheme = {
    '--color-brand-primary': '#0f9bb4',
    '--color-brand-primary-dark': '#0b6ca3',
    '--color-brand-secondary': '#2563eb',
    '--color-surface': '#ffffff',
    '--color-surface-alt': '#f1f5f9',
    '--color-border-light': '#d3dbe8',
  } as CSSProperties

  const fallbackStaffIdentifier = normalizedStaffId || staff.id || staff.alias || staff.name || 'staff'
  const reservationHit: TherapistHit = {
    id: `${shop.id}-${fallbackStaffIdentifier}`,
    therapistId: staff.id ? String(staff.id) : null,
    staffId: slotStaffId ?? fallbackStaffIdentifier,
    name: staff.name,
    alias: staff.alias ?? null,
    headline: staff.headline ?? null,
    specialties,
    avatarUrl: staff.avatar_url ?? null,
    rating: typeof staff.rating === 'number' ? staff.rating : shop.reviews?.average_score ?? null,
    reviewCount: typeof staff.review_count === 'number' ? staff.review_count : shop.reviews?.review_count ?? null,
    shopId: shop.id,
    shopSlug: shop.slug ?? null,
    shopName: shop.name,
    shopArea: shop.area,
    shopAreaName: shop.area_name ?? null,
  todayAvailable: todayOpenSlots.length > 0 ? true : null,
  nextAvailableAt: nextAvailabilitySlot?.slot.start_at ?? null,
  }

  const sampleExtra = SAMPLE_STAFF_PROFILE_EXTRAS[staff.name] ?? null

  const overlayGallery = (() => {
    const sources: string[] = []
    const seen = new Set<string>()
    const push = (src?: string | null) => {
      if (!src) return
      if (seen.has(src)) return
      seen.add(src)
      sources.push(src)
    }
    if (sampleExtra?.gallery) sampleExtra.gallery.forEach((src) => push(src))
    if (Array.isArray(shop.photos)) shop.photos.slice(0, 4).forEach((photo) => push(photo?.url ?? null))
    push(staff.avatar_url ?? null)
    return sources.length ? sources : null
  })()

  const overlayProfileDetails = sampleExtra?.details ? [...sampleExtra.details] : []

  const derivedSchedule = (() => {
    if (sampleExtra?.schedule) return sampleExtra.schedule
    const days = availabilityDays.slice(0, 3).map((day) => {
      const openSlots = day.slots.filter((slot) => slot.status !== 'blocked').length
      const label = formatDayLabel(day.date)
      if (openSlots) return `${label} ${openSlots}枠`
      return `${label} 要問合せ`
    })
    return days.length ? days.join(' / ') : null
  })()

  const derivedPricing = (() => {
    if (sampleExtra?.pricing) return sampleExtra.pricing
    if (menus[0]) {
      const menu = menus[0]
      const price = formatYen(menu.price)
      const duration = menu.duration_minutes ? `${menu.duration_minutes}分` : null
      return `${menu.name}${duration ? `（${duration}）` : ''} ${price}`
    }
    return null
  })()

  const reservationOverlayConfig = {
    hit: reservationHit,
    tel: phone,
    lineId,
    defaultStart: defaultSlotLocal ?? null,
    defaultDurationMinutes: defaultDurationMinutes ?? null,
    allowDemoSubmission,
    gallery: overlayGallery,
    profileDetails: overlayProfileDetails.length ? overlayProfileDetails : undefined,
    profileBio: sampleExtra?.bio ?? staff.headline ?? null,
    profileSchedule: derivedSchedule,
    profilePricing: derivedPricing,
    profileOptions: sampleExtra?.options ?? null,
    availabilityDays: staffAvailability,
  } satisfies Omit<ReservationOverlayProps, 'onClose'>

  const profileRows = [
    { label: '在籍店舗', value: shop.name },
    { label: 'エリア', value: shop.area_name || shop.area || '準備中' },
    specialties.length ? { label: '得意な施術', value: specialties.join(' / ') } : null,
    staff.headline ? { label: '紹介文', value: staff.headline, multiline: true } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; multiline?: boolean }>

  const optionRows = [
    { label: '料金目安', value: `${formatYen(shop.min_price)} 〜 ${formatYen(shop.max_price)}` },
    menus[0]
      ? {
          label: '代表メニュー',
          value: `${menus[0].name}${menus[0].duration_minutes ? `（${menus[0].duration_minutes}分）` : ''} / ${formatYen(menus[0].price)}`,
        }
      : null,
    {
      label: 'オンライン予約',
      value: 'フォームからリクエスト可能（折り返し確定）',
    },
    { label: 'LINE対応', value: lineId ? `ID: ${lineId}` : '未対応' },
  ].filter(Boolean) as Array<{ label: string; value: string }>

  const officialComment = staff.headline || shop.catch_copy || null
  const managerComment = shop.description || shop.ranking_reason || null

  const shopDataEntries = [
    { label: '店舗名', value: shop.name },
    shop.store_name ? { label: '運営名', value: shop.store_name } : null,
    { label: 'エリア', value: shop.area_name || shop.area || '準備中' },
    contact.phone ? { label: '電話番号', value: contact.phone } : null,
    lineId ? { label: 'LINE', value: lineId } : null,
    contact.website_url
      ? { label: '公式サイト', value: contact.website_url, href: contact.website_url, external: true }
      : null,
    contact.reservation_form_url
      ? { label: 'Web予約フォーム', value: contact.reservation_form_url, href: contact.reservation_form_url, external: true }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string; href?: string; external?: boolean }>

  const heroAvailabilityBadge = (() => {
    if (nextAvailabilitySummary) {
      return {
        label: nextAvailabilitySummary.status.label,
        detail: nextAvailabilitySummary.label,
        tone: nextAvailabilitySummary.status.badgeClass,
      }
    }
    if (todayOpenSlots.length) {
      return {
        label: '本日空きあり',
        detail: `${todayOpenSlots.length}枠 受付中`,
        tone: 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30',
      }
    }
    if (shop.today_available) {
      return {
        label: '本日案内可',
        detail: 'お電話・LINEでご相談ください',
        tone: 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30',
      }
    }
    return null
  })()

  return (
    <main
      style={pageTheme}
      className="relative min-h-screen bg-[var(--color-surface-alt)] text-neutral-text"
    >
      <ReservationOverlayRoot />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,148,173,0.18),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(79,70,229,0.12),_transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-14 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <Link
            href={shopHref}
            className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 font-semibold text-brand-primary transition hover:bg-white"
          >
            ← {shop.name} に戻る
          </Link>
          {ratingLabel ? (
            <div className="text-right text-neutral-text">
              <div className="text-sm font-semibold text-brand-primaryDark">平均評価 {ratingLabel}</div>
              {reviewLabel ? <div className="text-xs text-neutral-textMuted">{reviewLabel}</div> : null}
            </div>
          ) : null}
        </div>

        <section className="mt-6 relative isolate overflow-hidden rounded-[36px] border border-white/60 bg-white/92 shadow-[0_45px_120px_rgba(15,155,180,0.2)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(15,155,180,0.18),transparent_60%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.18),transparent_55%)]" />
          <div className="grid gap-10 p-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:p-12">
            <div>
              <ReservationOverlayTriggerButton
                overlay={reservationOverlayConfig}
                className="group relative block w-full overflow-hidden rounded-[32px] border border-white/60 bg-white/60 shadow-[0_32px_90px_rgba(15,155,180,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary/40"
                aria-label={`${staff.name}の予約詳細を開く`}
              >
                {staff.avatar_url ? (
                  <Image
                    src={staff.avatar_url}
                    alt={`${staff.name}の写真`}
                    width={720}
                    height={960}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.015]"
                    priority
                  />
                ) : (
                  <div className="flex h-full min-h-[360px] items-center justify-center bg-neutral-surfaceAlt text-5xl font-semibold text-brand-primary">
                    {staff.name.slice(0, 1)}
                  </div>
                )}
                {(ratingLabel || reviewLabel) ? (
                  <div className="pointer-events-none absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-black/60 px-4 py-1 text-xs font-semibold text-white backdrop-blur">
                    <span aria-hidden>★</span>
                    {ratingLabel}
                    {reviewLabel ? <span className="text-[11px] font-medium text-white/80">{reviewLabel}</span> : null}
                  </div>
                ) : null}
                {heroAvailabilityBadge ? (
                  <div className={`pointer-events-none absolute bottom-5 left-5 max-w-[80%] rounded-[24px] border px-4 py-2 text-xs font-semibold shadow-sm ${heroAvailabilityBadge.tone}`}>
                    <div>{heroAvailabilityBadge.label}</div>
                    <div className="mt-1 text-[11px] font-medium opacity-80">{heroAvailabilityBadge.detail}</div>
                  </div>
                ) : null}
              </ReservationOverlayTriggerButton>
            </div>
            <div className="flex flex-col gap-6">
              <div className="space-y-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-brand-primary">
                  Therapist Profile
                </span>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight text-neutral-text md:text-4xl">{staff.name}</h1>
                    {staff.alias ? (
                      <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">
                        {staff.alias}
                      </span>
                    ) : null}
                  </div>
                  {ratingLabel ? (
                    <div className="flex flex-wrap items-center gap-3 text-sm text-brand-primaryDark">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 font-semibold shadow-sm shadow-brand-primary/15">
                        <span aria-hidden>★</span>
                        {ratingLabel}
                      </span>
                      {reviewLabel ? <span className="text-xs text-neutral-textMuted">{reviewLabel}</span> : null}
                    </div>
                  ) : null}
                </div>
                {staff.headline ? (
                  <p className="text-sm leading-relaxed text-neutral-textMuted">{staff.headline}</p>
                ) : null}
                {specialties.length ? (
                  <div className="flex flex-wrap gap-2">
                    {specialties.map((tag) => (
                      <Chip key={tag} variant="accent" className="text-[11px]">
                        {tag}
                      </Chip>
                    ))}
                  </div>
                ) : null}
              </div>
              {nextAvailabilitySummary ? (
                <div className="rounded-[28px] border border-brand-primary/25 bg-brand-primary/10 p-4 shadow-sm shadow-brand-primary/20">
                  <div className="text-xs font-semibold uppercase tracking-wide text-brand-primary/80">直近の空き状況</div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold text-brand-primaryDark">
                    <span>{nextAvailabilitySummary.label}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${nextAvailabilitySummary.status.badgeClass}`}>
                      {nextAvailabilitySummary.status.icon ? <span aria-hidden>{nextAvailabilitySummary.status.icon}</span> : null}
                      {nextAvailabilitySummary.status.label}
                    </span>
                  </div>
                  {nextAvailabilitySummary.wait ? (
                    <div className="mt-1 text-xs text-brand-primary">最短ご案内まで {nextAvailabilitySummary.wait}</div>
                  ) : (
                    <div className="mt-1 text-xs text-brand-primary/80">まもなくご案内できます</div>
                  )}
                </div>
              ) : (
                <div className="rounded-[28px] border border-dashed border-neutral-borderLight/70 bg-white/80 p-4 text-xs text-neutral-textMuted">
                  公開されている空き枠はありません。最新のスケジュールはお問い合わせください。
                </div>
              )}
              <ReservationOverlayTriggerButton
                overlay={reservationOverlayConfig}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(37,99,235,0.25)] transition hover:from-brand-primary/90 hover:to-brand-secondary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/40"
              >
                このセラピストを予約する
              </ReservationOverlayTriggerButton>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/60 bg-white/85 p-4 shadow-sm shadow-brand-primary/15">
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-textMuted">所属店舗</div>
                  <div className="mt-2 text-sm font-semibold text-neutral-text">{shop.name}</div>
                  <div className="text-[11px] text-neutral-textMuted">{shop.area_name || shop.area || '掲載準備中'}</div>
                </div>
                <div className="rounded-[24px] border border-white/60 bg-white/85 p-4 shadow-sm shadow-brand-primary/15">
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-textMuted">お問い合わせ</div>
                  <div className="mt-2 space-y-1 text-sm text-neutral-text">
                    {phone ? <div className="font-semibold">TEL {phone}</div> : null}
                    {lineId ? <div className="font-semibold">LINE ID {lineId}</div> : null}
                    {!phone && !lineId ? (
                      <div className="text-xs text-neutral-textMuted">連絡先は店舗情報をご確認ください</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {weekColumns.length ? (
          <Section
            title="出勤・空き枠"
            subtitle="表示枠は店舗提供情報に基づきます"
            className="border border-neutral-borderLight/70 bg-white/90 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/80"
          >
            {hasWeekNavigation && currentWeekRangeLabel ? (
              <div className="mb-4 flex items-center justify-between text-xs text-neutral-text">
                <div className="font-semibold">{currentWeekRangeLabel}</div>
                <div className="flex gap-2">
                  {requestedWeekIndex > 0 ? (
                    <Link
                      href={buildWeekHref(requestedWeekIndex - 1)}
                      className="rounded-badge border border-neutral-borderLight px-3 py-1 transition hover:border-brand-primary hover:text-brand-primary"
                    >
                      前の週
                    </Link>
                  ) : (
                    <span className="rounded-badge border border-neutral-borderLight/60 px-3 py-1 text-neutral-textMuted/70">前の週</span>
                  )}
                  {requestedWeekIndex < weeks.length - 1 ? (
                    <Link
                      href={buildWeekHref(requestedWeekIndex + 1)}
                      className="rounded-badge border border-neutral-borderLight px-3 py-1 transition hover:border-brand-primary hover:text-brand-primary"
                    >
                      次の週
                    </Link>
                  ) : (
                    <span className="rounded-badge border border-neutral-borderLight/60 px-3 py-1 text-neutral-textMuted/70">次の週</span>
                  )}
                </div>
              </div>
            ) : null}

            {todayColumn?.slots.length ? (
              <Card className="mb-4 space-y-3 border border-brand-primary/20 bg-brand-primary/5 p-4 text-sm text-brand-primaryDark">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">本日の枠</div>
                  <span className="text-xs text-brand-primaryDark/80">{formatDayLabel(todayColumn.date)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {todayOpenSlots.length ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600">
                      ◎ 空き {todayOpenSlots.length}枠
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600">
                      空き枠なし
                    </span>
                  )}
                  {todayReservedSlots.length ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600">
                      × 予約済 {todayReservedSlots.length}枠
                    </span>
                  ) : null}
                </div>
              </Card>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
              {weekColumns.map((day) => (
                <Card key={day.date} className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-neutral-text">{formatDayLabel(day.date)}</div>
                    {(day.is_today || day.date === todayIso) ? <Badge variant="brand">本日</Badge> : null}
                  </div>
                  <div className="space-y-2 text-sm text-neutral-text">
                    {day.slots.map((slot, idx) => {
                      const display = slotStatusMap[slot.status]
                      const isSelected = selectedSlotInfo?.slot.start_at === slot.start_at
                      const waitLabel = slot.status !== 'blocked' ? formatWaitLabel(slot.start_at) : null
                      const baseClasses = `flex items-center justify-between gap-3 rounded-card border px-3 py-2 ${
                        isSelected
                          ? 'border-brand-primary bg-brand-primary/10 text-brand-primaryDark'
                          : 'border-neutral-borderLight/70 bg-neutral-surfaceAlt text-neutral-text'
                      }`
                      const content = (
                        <>
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-neutral-text">{toTimeLabel(slot.start_at)}〜{toTimeLabel(slot.end_at)}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${display.badgeClass}`}>
                              {display.icon ? <span aria-hidden>{display.icon}</span> : null}
                              {display.label}
                            </span>
                          </div>
                          {waitLabel ? (
                            <span className="text-[11px] font-medium text-brand-primary">{waitLabel}</span>
                          ) : null}
                        </>
                      )
                      if (slot.status === 'blocked') {
                        return (
                          <div
                            key={`${slot.start_at}-${idx}`}
                            className={`${baseClasses} cursor-not-allowed opacity-80`}
                          >
                            {content}
                          </div>
                        )
                      }
                      const defaultStart = toDateTimeLocal(slot.start_at)
                      const durationMinutes = computeSlotDurationMinutes(slot.start_at, slot.end_at)
                      return (
                        <ReservationOverlayTriggerButton
                          overlay={reservationOverlayConfig}
                          key={`${slot.start_at}-${idx}`}
                          defaultStart={defaultStart}
                          defaultDurationMinutes={durationMinutes}
                          className={`${baseClasses} transition hover:border-brand-primary hover:bg-brand-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary`}
                        >
                          {content}
                        </ReservationOverlayTriggerButton>
                      )
                    })}
                    {day.slots.length === 0 ? (
                      <div className="rounded-card border border-dashed border-neutral-borderLight/70 bg-white/60 px-3 py-6 text-center text-[11px] text-neutral-textMuted">
                        公開された枠はありません
                      </div>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="space-y-4 border border-neutral-borderLight/70 bg-white/95 p-6 shadow-lg shadow-neutral-950/5">
            <div className="text-sm font-semibold text-neutral-text">PROFILE</div>
            <dl className="space-y-3 text-sm">
              {profileRows.map((row) => (
                <div key={row.label} className="grid grid-cols-[110px_1fr] gap-3">
                  <dt className="text-neutral-textMuted">{row.label}</dt>
                  <dd className={`font-medium text-neutral-text ${row.multiline ? 'whitespace-pre-line leading-relaxed text-neutral-textMuted/90' : ''}`}>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="space-y-4 border border-neutral-borderLight/70 bg-white/95 p-6 shadow-lg shadow-neutral-950/5">
            <div className="text-sm font-semibold text-neutral-text">OPTION</div>
            <dl className="space-y-3 text-sm">
              {optionRows.map((row) => (
                <div key={row.label} className="grid grid-cols-[110px_1fr] gap-3">
                  <dt className="text-neutral-textMuted">{row.label}</dt>
                  <dd className="font-medium text-neutral-text">{row.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <div className="mt-6 grid gap-6">
          <Card className="space-y-3 border border-neutral-borderLight/70 bg-white/95 p-6 shadow-lg shadow-neutral-950/5">
            <div className="text-sm font-semibold text-neutral-text">THERAPIST OFFICIAL</div>
            <p className="text-sm leading-relaxed text-neutral-textMuted">
              {officialComment ?? 'セラピストからのコメントは準備中です。'}
            </p>
          </Card>
          <Card className="space-y-3 border border-neutral-borderLight/70 bg-white/95 p-6 shadow-lg shadow-neutral-950/5">
            <div className="text-sm font-semibold text-neutral-text">MANAGER COMMENT</div>
            <p className="text-sm leading-relaxed text-neutral-textMuted whitespace-pre-line">
              {managerComment ?? '店舗からのコメントは準備中です。'}
            </p>
          </Card>
        </div>

        <Card className="mt-6 space-y-4 border border-neutral-borderLight/70 bg-white/95 p-6 shadow-lg shadow-neutral-950/5">
          <div className="text-sm font-semibold text-neutral-text">SHOP DATA</div>
          <dl className="space-y-3 text-sm">
            {shopDataEntries.map((entry) => (
              <div key={`${entry.label}-${entry.value}`} className="grid grid-cols-[120px_1fr] gap-3">
                <dt className="text-neutral-textMuted">{entry.label}</dt>
                <dd className="text-neutral-text">
                  {entry.href ? (
                    <a
                      href={entry.href}
                      target={entry.external ? '_blank' : undefined}
                      rel={entry.external ? 'noopener noreferrer' : undefined}
                      className="inline-flex items-center gap-1 text-brand-primary transition hover:underline"
                    >
                      {entry.value}
                      <span aria-hidden>↗</span>
                    </a>
                  ) : (
                    entry.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card id="reserve" className="space-y-3 border border-neutral-borderLight/70 bg-white/95 p-5 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-neutral-text">WEB予約リクエスト</div>
            <p className="text-xs leading-relaxed text-neutral-textMuted">
              希望枠を送信すると店舗担当者が折り返しご連絡します。返信をもって予約成立となります。
            </p>
          </div>
          <ShopReservationCardClient
            tel={phone}
            lineId={lineId}
            shopName={shop.name}
            selectedSlotLabel={selectedSlotLabel}
            clearHref={selectedSlotLabel ? buildWeekHref(requestedWeekIndex) : null}
            description="担当セラピスト宛に希望時間をお送りいただけます。送信後は担当者から折り返しをご案内します。"
            overlay={reservationOverlayConfig}
          />
        </Card>

        {otherStaff.length ? (
          <Section
            title="他の在籍セラピスト"
            subtitle="気になるセラピストをチェック"
            className="border border-neutral-borderLight/70 bg-white/90 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/80"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {otherStaff.map((member) => (
                <Link
                  key={member.id}
                  href={buildStaffHref(params.id, member)}
                  className="flex items-center gap-3 rounded-card border border-neutral-borderLight/70 bg-neutral-surfaceAlt/60 p-3 transition hover:border-brand-primary"
                >
                  <div className="relative h-16 w-16 overflow-hidden rounded-full bg-neutral-surface">
                    {member.avatar_url ? (
                      <Image src={member.avatar_url} alt={`${member.name}の写真`} fill className="object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-sm font-semibold text-neutral-textMuted">
                        {member.name.slice(0, 1)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-neutral-text">{member.name}</div>
                    {member.specialties?.length ? (
                      <div className="text-xs text-neutral-textMuted">
                        {member.specialties.slice(0, 2).join(' / ')}
                      </div>
                    ) : null}
                  </div>
                  <span className="text-xs text-brand-primary">詳細 →</span>
                </Link>
              ))}
            </div>
          </Section>
        ) : null}

        <ReservationOverlayTriggerButton
          overlay={reservationOverlayConfig}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-primary/30 transition hover:bg-brand-primary/90 md:hidden"
        >
          今すぐ予約する
        </ReservationOverlayTriggerButton>
      </div>
    </main>
  )
}
