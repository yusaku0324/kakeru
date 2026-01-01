import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { createHash } from 'crypto'
import SafeImage from '@/components/SafeImage'
import Gallery from '@/components/Gallery'
import RecentlyViewedRecorder from '@/components/RecentlyViewedRecorder'
import { LocalBusinessJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd'
import type { ReservationOverlayProps } from '@/components/ReservationOverlay'
import ReservationOverlayRoot from '@/components/ReservationOverlayRoot'
import ShopReviews from '@/components/ShopReviews'
import { Badge } from '@/components/ui/Badge'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Section } from '@/components/ui/Section'
import type { TherapistHit } from '@/components/staff/TherapistCard'
import { ProfileTagList } from '@/components/staff/ProfileTagList'
import { buildApiUrl, resolveApiBases } from '@/lib/api'
import { nextSlotPayloadToScheduleSlot, type NextAvailableSlotPayload } from '@/lib/nextAvailableSlot'
import { formatSlotJp } from '@/lib/schedule'
import { getSampleShops, type SampleShop } from '@/lib/sampleShops'
import { sampleShopToDetail } from '@/lib/sampleShopAdapters'
import { TOKYO_TZ, formatDatetimeLocal, formatZonedIso, toZonedDayjs, toZonedDate } from '@/lib/timezone'
import { getJaFormatter } from '@/utils/date'
import { SITE_SESSION_COOKIE_NAME } from '@/lib/session'
import ShopReservationCardClient from './ShopReservationCardClient'
import ShopSectionNav from './ShopSectionNav'
import StickyReservationCTA from './StickyReservationCTA'
import StaffSectionClient from './StaffSectionClient'
import { ShopHero } from './_components/ShopHero'
import { ShopContentLayout } from './_components/ShopContentLayout'

type Props = {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

import {
  fetchShop,
  type ShopDetail,
  type MediaImage,
  type Contact,
  type MenuItem,
  type Promotion,
  type StaffSummary,
  type AvailabilitySlot,
  type AvailabilityDay,
  type AvailabilityCalendar,
  type ReviewAspectKey,
  type ReviewAspect,
  type ReviewAspects,
  type HighlightedReview,
  type ReviewSummary,
  type DiaryEntry,
} from '@/lib/shops'



function uuidFromString(input: string): string {
  const hash = createHash('sha1').update(input).digest('hex')
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`
}

const formatYen = (n: number | null | undefined) =>
  n != null && !Number.isNaN(n) ? `¥${Number(n).toLocaleString('ja-JP')}` : null
const dayFormatter = getJaFormatter('day')
const timeFormatter = getJaFormatter('time')

function uniquePhotos(photos?: MediaImage[] | null): string[] {
  if (!Array.isArray(photos)) return []
  const seen = new Set<string>()
  const urls: string[] = []
  for (const img of photos) {
    if (img?.url && !seen.has(img.url)) {
      urls.push(img.url)
      seen.add(img.url)
    }
  }
  return urls
}

function shorten(text?: string | null, max = 160): string | undefined {
  if (!text) return undefined
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function parseBooleanParam(value?: string | string[] | null): boolean {
  if (!value) return false
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return false
  const normalized = raw.toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function toDateTimeLocal(iso?: string | null) {
  if (!iso) return undefined
  const formatted = formatDatetimeLocal(iso)
  return formatted || undefined
}

function toTimeLabel(iso: string): string {
  const zoned = toZonedDayjs(iso)
  if (!zoned.isValid()) return iso.slice(11, 16)
  return timeFormatter.format(zoned.toDate()).replace(/^24:/, '00:')
}

function formatWaitLabel(startIso?: string | null) {
  if (!startIso) return null
  const target = toZonedDayjs(startIso)
  if (!target.isValid()) return null
  const now = toZonedDayjs()
  const diffMs = target.valueOf() - now.valueOf()
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

function formatDayLabel(dateStr: string): string {
  const zoned = toZonedDate(dateStr)
  if (Number.isNaN(zoned.getTime())) return dateStr
  return dayFormatter.format(zoned)
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const [resolvedParams, resolvedSearchParams = {}] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ])
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SITE_SESSION_COOKIE_NAME)
  const shop = await fetchShop(resolvedParams.id, Boolean(sessionCookie))
  const photos = uniquePhotos(shop.photos)
  const badges = shop.badges || []
  const contact = shop.contact || {}
  const phone = contact.phone || null
  const lineId = contact.line_id
    ? contact.line_id.startsWith('@')
      ? contact.line_id.slice(1)
      : contact.line_id
    : null
  const menus = Array.isArray(shop.menus) ? shop.menus : []
  const staff = Array.isArray(shop.staff) ? shop.staff : []
  const availability = shop.availability_calendar?.days || []
  const slotParamValue = (() => {
    const value = resolvedSearchParams.slot
    if (Array.isArray(value)) return value[0]
    return value
  })()
  const diaries = Array.isArray(shop.diaries) ? shop.diaries : []
  const selectedSlot = (() => {
    if (!slotParamValue) return null
    const target = toZonedDayjs(slotParamValue)
    if (!target.isValid()) return null
    for (const day of availability) {
      if (!day?.slots) continue
      for (const slot of day.slots) {
        const start = toZonedDayjs(slot.start_at)
        if (start.isValid() && Math.abs(start.valueOf() - target.valueOf()) < 60_000) {
          return slot
        }
      }
    }
    return null
  })()

  const forceReviewsFetch = parseBooleanParam(resolvedSearchParams.force_reviews ?? null)
  const allowDemoSubmission = parseBooleanParam(resolvedSearchParams.force_demo_submit ?? null)

  const firstOpenSlot = (() => {
    for (const day of availability) {
      if (!day?.slots) continue
      const openSlot = day.slots.find((slot) => slot.status === 'open')
      if (openSlot) return openSlot
    }
    return null
  })()

  const defaultSlotLocal = (() => {
    const slot = selectedSlot || firstOpenSlot
    return slot ? toDateTimeLocal(slot.start_at) : undefined
  })()

  const defaultDurationMinutes = (() => {
    const slot = selectedSlot || firstOpenSlot
    if (!slot) return undefined
    const start = toZonedDayjs(slot.start_at)
    const end = toZonedDayjs(slot.end_at)
    if (!start.isValid() || !end.isValid()) return undefined
    const diff = Math.max(0, Math.round(end.diff(start, 'minute', true)))
    return diff || undefined
  })()

  const tentativeSlotFallback = (() => {
    for (const day of availability) {
      if (!day?.slots) continue
      const tentativeSlot = day.slots.find((slot) => slot.status === 'tentative')
      if (tentativeSlot) return tentativeSlot
    }
    return null
  })()

  const nextReservableStartIso =
    selectedSlot?.start_at ?? firstOpenSlot?.start_at ?? tentativeSlotFallback?.start_at ?? null

  const shopGallerySources = uniquePhotos(shop.photos)
  const shopPrimaryPhoto = shopGallerySources[0] ?? null
  const reservationTags = Array.isArray(shop.service_tags)
    ? shop.service_tags
      .filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim()))
      .map((tag) => tag.trim())
    : []

  const reservationHit: TherapistHit = {
    id: `${shop.id}-reservation`,
    therapistId: null,
    staffId: `${shop.id}-web`,
    name: shop.name,
    alias: shop.store_name ?? null,
    headline: shorten(shop.catch_copy, 80) ?? shorten(shop.description, 80) ?? null,
    specialties: reservationTags,
    avatarUrl: shopPrimaryPhoto,
    rating: shop.reviews?.average_score ?? null,
    reviewCount: shop.reviews?.review_count ?? null,
    shopId: shop.id,
    shopSlug: shop.slug ?? null,
    shopName: shop.name,
    shopArea: shop.area,
    shopAreaName: shop.area_name ?? null,
    todayAvailable: shop.today_available ?? null,
    nextAvailableSlot: nextReservableStartIso
      ? {
        start_at: nextReservableStartIso,
        status: 'ok' as const,
      }
      : null,
  }

  const availabilityUpdatedLabel = shop.availability_calendar?.generated_at
    ? formatDayLabel(shop.availability_calendar.generated_at)
    : null
  const overlayProfileDetails = [
    shop.area_name || shop.area ? { label: 'エリア', value: shop.area_name || shop.area } : null,
    shop.staff?.length ? { label: '在籍セラピスト', value: `${shop.staff.length}名` } : null,
    reservationTags.length
      ? { label: 'サービス', value: reservationTags.slice(0, 4).join(' / ') }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>
  const overlaySchedule = availabilityUpdatedLabel
    ? `空き状況更新: ${availabilityUpdatedLabel}`
    : null
  const overlayPricingLabel = (() => {
    const min = formatYen(shop.min_price)
    const max = formatYen(shop.max_price)
    if (min && max) return `${min}〜${max}`
    if (min) return `${min}〜`
    if (max) return `〜${max}`
    return null
  })()

  const reservationOverlayConfig = {
    hit: reservationHit,
    tel: phone,
    lineId,
    defaultStart: defaultSlotLocal ?? null,
    defaultDurationMinutes: defaultDurationMinutes ?? null,
    allowDemoSubmission,
    gallery: shopGallerySources.length ? shopGallerySources : undefined,
    profileDetails: overlayProfileDetails.length ? overlayProfileDetails : undefined,
    profileBio: shop.catch_copy ?? shop.description ?? null,
    profileSchedule: overlaySchedule,
    profilePricing: overlayPricingLabel,
    menus: menus.length ? menus : undefined,
    availabilityDays: availability,
  } satisfies Omit<ReservationOverlayProps, 'onClose'>
  const todayIso = formatZonedIso().slice(0, 10)
  const now = toZonedDayjs()
  const BOOKING_DEADLINE_MINUTES = 60

  // Filter availability to only include today and future dates
  const filteredAvailability = availability.filter((day) => day.date >= todayIso)

  // Filter slots to exclude those past the booking deadline (1 hour before start)
  const isSlotBookable = (slot: AvailabilitySlot) => {
    if (slot.status !== 'open') return true // Keep non-open slots for display
    const slotStart = toZonedDayjs(slot.start_at)
    const deadline = slotStart.subtract(BOOKING_DEADLINE_MINUTES, 'minute')
    return now.isBefore(deadline)
  }

  const todayAvailability = filteredAvailability.find((day) => day.date === todayIso) || null
  const todaySlots = todayAvailability?.slots || []
  const upcomingOpenToday = todaySlots.filter((slot) => slot.status === 'open' && isSlotBookable(slot))
  const reservedToday = todaySlots.filter((slot) => slot.status === 'blocked')

  const contactLinks = [
    contact.phone ? { label: `TEL: ${contact.phone}`, href: `tel:${contact.phone}` } : null,
    contact.reservation_form_url
      ? { label: 'WEB予約フォーム', href: contact.reservation_form_url, external: true }
      : null,
    contact.website_url
      ? { label: '公式サイトを見る', href: contact.website_url, external: true }
      : null,
  ].filter(Boolean) as Array<{ label: string; href: string; external?: boolean }>

  const slotStatusMap: Record<
    AvailabilitySlot['status'],
    { label: string; badgeClass: string; icon?: string }
  > = {
    open: {
      label: '空き枠',
      badgeClass: 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30',
      icon: '◎',
    },
    tentative: {
      label: '要確認',
      badgeClass: 'bg-amber-100 text-amber-700 border border-amber-300',
      icon: '△',
    },
    blocked: {
      label: '予約済',
      badgeClass: 'bg-neutral-200 text-neutral-700 border border-neutral-300',
      icon: '×',
    },
  }

  const breadcrumbItems = [
    { label: 'ホーム', href: '/' },
    { label: '検索', href: '/search' },
    { label: shop.name },
  ]

  // Build navigation sections based on available data
  const navSections = [
    { id: 'overview', label: '概要' },
    shop.description || shop.catch_copy ? { id: 'about', label: '店舗紹介' } : null,
    shop.reviews ? { id: 'reviews', label: '口コミ' } : null,
    menus.length ? { id: 'menus', label: 'メニュー' } : null,
    staff.length ? { id: 'staff', label: 'セラピスト' } : null,
    filteredAvailability.length ? { id: 'availability', label: '空き状況' } : null,
  ].filter((s): s is { id: string; label: string } => s !== null)

  // Build site URL for JSON-LD
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://osakamenesu.com'
  const shopUrl = `${siteUrl}/profiles/${shop.slug || shop.id}`

  const sidebarContent = (
    <div className="space-y-6">
      <Card className="space-y-4 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-neutral-text">ウェブ予約</div>
          {shop.today_available && <Badge variant="success">本日空きあり</Badge>}
        </div>
        <p className="text-xs leading-relaxed text-neutral-textMuted">
          WEBから24時間いつでも予約リクエストを送れます。
        </p>
        <ShopReservationCardClient
          tel={phone}
          lineId={lineId}
          shopName={shop.name}
          overlay={reservationOverlayConfig}
        />
      </Card>

      <Card className="space-y-4 p-5 shadow-sm">
        <div className="text-sm font-bold text-neutral-text border-b border-neutral-border pb-2 mb-2">料金・お問い合わせ</div>
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-textMuted">
            料金目安 (60分)
          </div>
          <div className="text-2xl font-bold text-brand-primaryDark font-mono">
            {formatYen(shop.min_price) || formatYen(shop.max_price) ? (
              <>
                {formatYen(shop.min_price) ?? '−'}{' '}
                <span className="text-sm text-neutral-textMuted font-sans font-normal">
                  〜 {formatYen(shop.max_price) ?? '−'}
                </span>
              </>
            ) : (
              <span className="text-neutral-textMuted text-base">店舗にお問い合わせ</span>
            )}
          </div>
        </div>

        <div className="space-y-3 pt-2">
          {contactLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
              className="flex items-center justify-center gap-2 rounded-full border border-neutral-borderLight bg-neutral-surface/50 py-2.5 text-sm font-medium text-neutral-text transition hover:bg-neutral-surface hover:text-brand-primaryDark"
            >
              {item.label}
              {item.external && (
                <svg className="h-3 w-3 opacity-50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
              )}
            </a>
          ))}
          {contact.line_id && (
            <div className="flex items-center justify-between rounded-lg border border-neutral-borderLight bg-neutral-surface/30 px-3 py-2">
              <span className="text-xs font-bold text-neutral-text">LINE ID</span>
              <span className="font-mono text-sm tracking-wide select-all">{contact.line_id}</span>
            </div>
          )}
        </div>

        {contact.sns?.length ? (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-borderLight">
            {contact.sns.map((sns) => (
              <a
                key={sns.url}
                href={sns.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-neutral-textMuted hover:text-brand-primary"
              >
                {sns.label || sns.platform}
                <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
              </a>
            ))}
          </div>
        ) : null}
      </Card>

      {shop.business_hours || shop.address ? (
        <Card className="space-y-4 p-5 shadow-sm">
          <div className="text-sm font-bold text-neutral-text border-b border-neutral-border pb-2 mb-2">アクセス・営業時間</div>
          {shop.business_hours && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-textMuted">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                営業時間
              </div>
              <p className="text-sm text-neutral-text pl-5.5">{shop.business_hours}</p>
            </div>
          )}
          {shop.address && (
            <div className="space-y-1 mt-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-textMuted">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                住所
              </div>
              <p className="text-sm text-neutral-text pl-5.5">{shop.address}</p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-primaryDark hover:underline pl-5.5 mt-1"
              >
                Google Mapで見る
              </a>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  )

  return (
    <main className="min-h-screen bg-neutral-50 pb-20">
      <ShopHero
        name={shop.name}
        catchCopy={shop.catch_copy}
        areaName={shop.area_name || shop.area}
        storeName={shop.store_name}
        imageUrl={shopPrimaryPhoto}
        badges={badges}
        serviceTags={reservationTags}
      />

      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <Breadcrumb items={breadcrumbItems} className="py-4" />
      </div>

      {/* JSON-LD Structured Data for SEO */}
      <LocalBusinessJsonLd
        name={shop.name}
        description={shop.catch_copy || shop.description}
        url={shopUrl}
        image={photos.slice(0, 3)}
        telephone={phone}
        address={shop.address}
        areaServed={shop.area_name || shop.area}
        priceRange={overlayPricingLabel}
        openingHours={shop.business_hours}
        aggregateRating={
          shop.reviews?.average_score && shop.reviews?.review_count
            ? {
              ratingValue: shop.reviews.average_score,
              reviewCount: shop.reviews.review_count,
            }
            : null
        }
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'ホーム', url: siteUrl },
          { name: '検索', url: `${siteUrl}/search` },
          { name: shop.name, url: shopUrl },
        ]}
      />

      <ShopSectionNav sections={navSections} />
      <ReservationOverlayRoot />
      <RecentlyViewedRecorder
        shopId={shop.id}
        slug={shop.slug ?? null}
        name={shop.name}
        area={shop.area_name ?? shop.area ?? null}
        imageUrl={photos[0] ?? null}
      />

      <ShopContentLayout aside={sidebarContent}>
        <div id="overview" className="space-y-8">
          {/* Description Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-text">
              {shop.catch_copy || '店舗紹介'}
            </h2>
            {shop.description && (
              <div className="prose prose-neutral max-w-none text-neutral-textMuted leading-relaxed">
                {shop.description.split('\n').map((line, i) => (
                  <p key={i} className="mb-2">{line}</p>
                ))}
              </div>
            )}

            {/* Ranking/Awards */}
            {shop.ranking_reason && (
              <div className="mt-4 rounded-lg bg-yellow-50/50 p-4 border border-yellow-100 flex gap-3 text-sm text-yellow-800">
                <span className="text-xl">👑</span>
                <span className="font-semibold pt-0.5">{shop.ranking_reason}</span>
              </div>
            )}
          </div>

          {/* Promotions */}
          {Array.isArray(shop.promotions) && shop.promotions.length ? (
            <Section title="キャンペーン" className="shadow-none border border-neutral-borderLight bg-white p-6 rounded-2xl">
              <ul className="grid gap-4 sm:grid-cols-2">
                {shop.promotions.map((promo, index) => (
                  <li key={`${promo.label}-${index}`} className="relative overflow-hidden rounded-xl border border-brand-primary/20 bg-gradient-to-br from-brand-primary/5 to-white p-4 transition-shadow hover:shadow-md">
                    <div className="font-bold text-brand-primaryDark mb-1">{promo.label}</div>
                    {promo.description && <p className="text-xs text-neutral-textMuted leading-relaxed">{promo.description}</p>}
                    {promo.highlight && <Badge variant="brand" className="absolute top-2 right-2 text-[10px] py-0 px-2 h-auto">{promo.highlight}</Badge>}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {/* Photo Gallery (if more than 1 photo) */}
          {photos.length > 1 && (
            <Section title="フォトギャラリー" className="shadow-none bg-transparent p-0 border-0">
              <Gallery photos={photos} altBase={shop.name} />
            </Section>
          )}
        </div>

        {/* Navigation content placeholders - Staff/Menus are rendered by other components or below */}

        <Section
          id="about"
          title="店舗紹介"
          subtitle={shop.catch_copy && shop.description ? shop.catch_copy : undefined}
          className="shadow-none border border-neutral-borderLight bg-neutral-surface"
        >
          {shop.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-text">
              {shop.description}
            </p>
          ) : (
            <p className="text-sm text-neutral-textMuted">{shop.catch_copy}</p>
          )}
        </Section>

        {shop.reviews ? (
          <Section
            id="reviews"
            title="口コミ"
            subtitle={
              shop.reviews.review_count ? `公開件数 ${shop.reviews.review_count}件` : undefined
            }
            className="shadow-none border border-neutral-borderLight bg-neutral-surface"
            actions={
              shop.reviews.average_score ? (
                <Badge variant="brand">平均 {shop.reviews.average_score.toFixed(1)}★</Badge>
              ) : undefined
            }
          >
            <ShopReviews
              shopId={shop.id}
              summary={shop.reviews}
              forceRemoteFetch={forceReviewsFetch}
            />
          </Section>
        ) : null}

        {menus.length ? (
          <Section
            id="menus"
            title="メニュー"
            subtitle="編集部が確認した代表的なコースと料金"
            className="shadow-none border border-neutral-borderLight bg-neutral-surface"
          >
            <div className="grid gap-4 md:grid-cols-2">
              {menus.map((menu) => (
                <Card key={menu.id} className="space-y-3 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-base font-semibold text-neutral-text">{menu.name}</div>
                    <div className="text-sm font-medium text-brand-primaryDark">
                      {formatYen(menu.price)}
                    </div>
                  </div>
                  {menu.duration_minutes ? (
                    <div className="text-xs text-neutral-textMuted">
                      所要時間: 約{menu.duration_minutes}分
                    </div>
                  ) : null}
                  {menu.description ? (
                    <p className="text-sm leading-relaxed text-neutral-textMuted">
                      {shorten(menu.description, 140)}
                    </p>
                  ) : null}
                  {menu.tags?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {menu.tags.map((tag) => (
                        <Chip key={tag} variant="subtle">
                          {tag}
                        </Chip>
                      ))}
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          </Section>
        ) : null}

        <StaffSectionClient
          staff={staff}
          shopId={shop.id}
          shopSlug={shop.slug ?? null}
          shopName={shop.store_name || shop.name}
          shopArea={shop.area}
          shopAreaName={shop.area_name}
          menus={menus}
          allowDemoSubmission={allowDemoSubmission}
        />

        {filteredAvailability.length ? (
          <Section
            id="availability"
            title="出勤・空き状況"
            subtitle={
              availabilityUpdatedLabel
                ? `最終更新: ${availabilityUpdatedLabel}`
                : '最新の出勤枠は店舗提供情報に基づきます'
            }
            className="shadow-none border border-neutral-borderLight bg-neutral-surface"
          >
            {todaySlots.length ? (
              <Card className="mb-4 space-y-3 border border-brand-primary/20 bg-brand-primary/5 p-4 text-sm text-brand-primaryDark">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">本日の枠</div>
                  <span className="text-xs text-brand-primaryDark/80">
                    {formatDayLabel(todayIso)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {upcomingOpenToday.length ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600">
                      ◎ 空き {upcomingOpenToday.length}枠
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600">
                      空き枠なし
                    </span>
                  )}
                  {reservedToday.length ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600">
                      × 予約済 {reservedToday.length}枠
                    </span>
                  ) : null}
                </div>
              </Card>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              {filteredAvailability.slice(0, 6).map((day) => {
                // Filter slots to only show bookable ones (or blocked for display)
                const bookableSlots = (day.slots || []).filter(isSlotBookable)
                return (
                  <Card key={day.date} className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-neutral-text">
                        {formatDayLabel(day.date)}
                      </div>
                      {day.is_today ? <Badge variant="brand">本日</Badge> : null}
                    </div>
                    {bookableSlots.length ? (
                      <div className="space-y-2 text-sm text-neutral-text">
                        {bookableSlots.slice(0, 6).map((slot, idx) => {
                          const display = slotStatusMap[slot.status]
                          const waitLabel =
                            slot.status !== 'blocked' ? formatWaitLabel(slot.start_at) : null
                          return (
                            <div
                              key={`${slot.start_at}-${idx}`}
                              className="flex items-center gap-3 rounded-card border border-neutral-borderLight/70 bg-neutral-surfaceAlt px-3 py-2"
                            >
                              <span className="font-medium text-neutral-text">
                                {toTimeLabel(slot.start_at)}〜{toTimeLabel(slot.end_at)}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${display.badgeClass}`}
                              >
                                {display.icon ? <span aria-hidden>{display.icon}</span> : null}
                                {display.label}
                              </span>
                              {waitLabel ? (
                                <span className="text-[11px] font-medium text-brand-primary">
                                  {waitLabel}
                                </span>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-textMuted">公開された枠はありません</p>
                    )}
                  </Card>
                )
              })}
            </div>
          </Section>
        ) : null}
      </ShopContentLayout>

      <StickyReservationCTA overlay={reservationOverlayConfig} tel={phone} />
    </main>
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const shop = await fetchShop(id, false)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://osakamenesu.com'
  const canonicalUrl = `${siteUrl}/profiles/${shop.slug || shop.id}`
  const title = `${shop.name} - 大阪メンエス.com`
  const priceRange = (() => {
    const min = formatYen(shop.min_price)
    const max = formatYen(shop.max_price)
    if (min && max) return `${min}〜${max}`
    if (min) return `${min}〜`
    if (max) return `〜${max}`
    return null
  })()
  const descParts = [shop.area, priceRange].filter(Boolean) as string[]
  if (shop.catch_copy) descParts.unshift(shop.catch_copy)
  if (shop.store_name) descParts.unshift(shop.store_name)
  if (shop.description) descParts.push(shorten(shop.description, 120) || '')
  const description = descParts.filter(Boolean).join(' / ')
  const images = uniquePhotos(shop.photos).slice(0, 1)
  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      images,
      type: 'article',
      url: canonicalUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images,
    },
  }
}
