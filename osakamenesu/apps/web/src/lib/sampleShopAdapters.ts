import { createHash } from 'crypto'

import type { ShopHit } from '@/components/shop/ShopCard'
import type { NextAvailableSlotPayload } from '@/lib/nextAvailableSlot'

import type { SampleShop } from './sampleShops'
import { formatZonedIso, toZonedDayjs, type Dayjs } from '@/lib/timezone'

const priceFormatter = new Intl.NumberFormat('ja-JP')

const SAMPLE_REBASE_SOURCE = toZonedDayjs('2025-10-07T00:00:00').startOf('day')
const SAMPLE_REBASE_TARGET = toZonedDayjs().startOf('day')

function rebaseDate(original: Dayjs | string | Date): Dayjs {
  const base = toZonedDayjs(original)
  if (!base.isValid()) return base
  const diff = base.valueOf() - SAMPLE_REBASE_SOURCE.valueOf()
  return SAMPLE_REBASE_TARGET.add(diff, 'millisecond')
}

function rebaseIsoDate(value?: string | null): string | null | undefined {
  if (!value) return value
  const parsed = toZonedDayjs(`${value}T00:00:00`)
  if (!parsed.isValid()) return value
  const rebased = rebaseDate(parsed)
  return rebased.isValid() ? rebased.format('YYYY-MM-DD') : value
}

function rebaseIsoDateTime(value?: string | null): string | null | undefined {
  if (!value) return value
  const parsed = toZonedDayjs(value)
  if (!parsed.isValid()) return value
  const rebased = rebaseDate(parsed)
  return rebased.isValid() ? formatZonedIso(rebased) : value
}

function rebaseNextSlot(slot?: SampleNextSlot | null): SampleNextSlot | null {
  if (!slot) return null
  const rebasedStart = rebaseIsoDateTime(slot.start_at)
  if (!rebasedStart) return slot
  return { ...slot, start_at: rebasedStart }
}

type PriceBandDefinition = {
  key: string
  lower: number
  upper: number | null
  label: string
}

const SAMPLE_PRICE_BANDS: PriceBandDefinition[] = [
  { key: 'under_10k', lower: 0, upper: 10000, label: '〜1万円' },
  { key: '10k_14k', lower: 10000, upper: 14000, label: '1.0〜1.4万円' },
  { key: '14k_18k', lower: 14000, upper: 18000, label: '1.4〜1.8万円' },
  { key: '18k_22k', lower: 18000, upper: 22000, label: '1.8〜2.2万円' },
  { key: '22k_plus', lower: 22000, upper: null, label: '2.2万円以上' },
]

type Contact = {
  phone?: string | null
  line_id?: string | null
  website_url?: string | null
  reservation_form_url?: string | null
  sns?: Array<{ platform: string; url: string; label?: string | null }> | null
}

type MenuItem = {
  id: string
  name: string
  description?: string | null
  duration_minutes?: number | null
  price: number
  currency?: string | null
  is_reservable_online?: boolean | null
  tags?: string[] | null
}

type Promotion = {
  label: string
  description?: string | null
  expires_at?: string | null
  highlight?: string | null
}

export type StaffSummary = {
  id: string
  name: string
  alias?: string | null
  avatar_url?: string | null
  headline?: string | null
  rating?: number | null
  review_count?: number | null
  specialties?: string[] | null
}

type AvailabilitySlot = {
  start_at: string
  end_at: string
  status: 'open' | 'tentative' | 'blocked'
  staff_id?: string | null
  menu_id?: string | null
}

type AvailabilityDay = {
  date: string
  is_today?: boolean | null
  slots: AvailabilitySlot[]
}

type AvailabilityCalendar = {
  shop_id: string
  generated_at: string
  days: AvailabilityDay[]
}

type ReviewAspectKey = 'therapist_service' | 'staff_response' | 'room_cleanliness'

type HighlightedReview = {
  review_id?: string | null
  title: string
  body: string
  score: number
  visited_at?: string | null
  author_alias?: string | null
  aspects?: Partial<Record<ReviewAspectKey, { score: number; note?: string | null }>> | null
}

type ReviewSummary = {
  average_score?: number | null
  review_count?: number | null
  highlighted?: HighlightedReview[] | null
  aspect_averages?: Partial<Record<ReviewAspectKey, number>> | null
  aspect_counts?: Partial<Record<ReviewAspectKey, number>> | null
}

type DiaryEntry = {
  id?: string | null
  title?: string | null
  body: string
  photos?: string[] | null
  hashtags?: string[] | null
  published_at?: string | null
}

export type ShopDetail = {
  id: string
  slug?: string | null
  name: string
  area: string
  area_name?: string | null
  min_price: number
  max_price: number
  description?: string | null
  catch_copy?: string | null
  photos?: Array<{ url: string; kind?: string | null; caption?: string | null }> | null
  contact?: Contact | null
  menus?: MenuItem[] | null
  staff?: StaffSummary[] | null
  availability_calendar?: AvailabilityCalendar | null
  badges?: string[] | null
  today_available?: boolean | null
  next_available_slot?: NextAvailableSlotPayload | null
  service_tags?: string[] | null
  metadata?: Record<string, unknown> | null
  store_name?: string | null
  promotions?: Promotion[] | null
  ranking_reason?: string | null
  reviews?: ReviewSummary | null
  diary_count?: number | null
  has_diaries?: boolean | null
  diaries?: DiaryEntry[] | null
}

type SampleNextSlot = NextAvailableSlotPayload

function normalizeSlotStatus(
  status: 'open' | 'tentative' | 'blocked',
): SampleNextSlot['status'] | null {
  if (status === 'open') return 'ok'
  if (status === 'tentative') return 'maybe'
  return null
}

function computeSampleNextSlots(sample: SampleShop): {
  shopSlot: SampleNextSlot | null
  staffSlots: Map<string, SampleNextSlot>
} {
  const staffSlots = new Map<string, SampleNextSlot>()
  let computedShopSlot: { ts: number; slot: SampleNextSlot } | null = null
  const calendar = sample.availability_calendar
  if (!calendar?.days?.length) {
    return { shopSlot: null, staffSlots }
  }
  const now = Date.now()
  for (const day of calendar.days) {
    const slots = Array.isArray(day.slots) ? day.slots : []
    for (const slot of slots) {
      const normalizedStatus = normalizeSlotStatus(slot.status)
      if (!normalizedStatus) continue
      const ts = Date.parse(slot.start_at)
      if (Number.isNaN(ts) || ts < now) continue
      const payload: SampleNextSlot = { start_at: slot.start_at, status: normalizedStatus }
      if (!computedShopSlot || ts < computedShopSlot.ts) {
        computedShopSlot = { ts, slot: payload }
      }
      if (slot.staff_id) {
        const existing = staffSlots.get(slot.staff_id)
        if (!existing || Date.parse(existing.start_at) > ts) {
          staffSlots.set(slot.staff_id, payload)
        }
      }
    }
  }
  return { shopSlot: computedShopSlot?.slot ?? null, staffSlots }
}

function uuidFromString(input: string): string {
  const hash = createHash('sha1').update(input).digest('hex')
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`
}

function resolveBasePrice(sample: SampleShop): number | null {
  if (typeof sample.min_price === 'number' && sample.min_price > 0) {
    return sample.min_price
  }
  if (typeof sample.max_price === 'number' && sample.max_price > 0) {
    return sample.max_price
  }
  if (Array.isArray(sample.menus)) {
    for (const menu of sample.menus) {
      if (typeof menu?.price === 'number' && menu.price > 0) {
        return menu.price
      }
    }
  }
  return null
}

function computePriceBand(sample: SampleShop): { key: string | null; label: string | null } {
  const base = resolveBasePrice(sample)
  if (base == null) {
    return { key: null, label: null }
  }

  for (const band of SAMPLE_PRICE_BANDS) {
    if (band.upper == null) {
      if (base >= band.lower) {
        return { key: band.key, label: band.label }
      }
      continue
    }
    if (base >= band.lower && base < band.upper) {
      return { key: band.key, label: band.label }
    }
  }

  const fallbackBand = SAMPLE_PRICE_BANDS[0]
  return { key: fallbackBand.key, label: fallbackBand.label }
}

function fallbackPriceBandLabel(sample: SampleShop): string | null {
  if (sample.menus && sample.menus.length > 0) {
    const first = sample.menus.find((menu) => menu.duration_minutes && menu.price)
    if (first && first.duration_minutes) {
      return `${first.duration_minutes}分 ${priceFormatter.format(first.price)}円〜`
    }
  }
  if (sample.min_price) {
    return `¥${priceFormatter.format(sample.min_price)} 〜 ¥${priceFormatter.format(sample.max_price || sample.min_price)}`
  }
  return null
}

export function sampleShopToHit(sample: SampleShop): ShopHit {
  const { key: priceBandKey, label: computedPriceBandLabel } = computePriceBand(sample)
  const priceBandLabel = computedPriceBandLabel ?? fallbackPriceBandLabel(sample)
  const { shopSlot: computedShopSlot, staffSlots } = computeSampleNextSlots(sample)
  const staffPreview = Array.isArray(sample.staff)
    ? sample.staff
        .filter((member) => Boolean(member?.name))
        .slice(0, 3)
        .map((member, index) => {
          const originalId = member.id ?? null
          const previewId = member.id || uuidFromString(`staff:${sample.id}:${index}`)
          const staffSlot = originalId ? (staffSlots.get(originalId) ?? null) : null
          const mergedSlot = member.next_available_slot ?? staffSlot ?? null
          const rebasedSlot = rebaseNextSlot(mergedSlot)
          const nextAvailableAt =
            rebaseIsoDateTime(member.next_available_at ?? staffSlot?.start_at ?? null) ??
            member.next_available_at ??
            staffSlot?.start_at ??
            null
          return {
            id: previewId,
            name: member.name,
            alias: member.alias ?? null,
            headline: member.headline ?? null,
            rating: member.rating ?? null,
            review_count: member.review_count ?? null,
            avatar_url: member.avatar_url ?? null,
            specialties: member.specialties ?? null,
            today_available: member.today_available ?? null,
            next_available_slot: rebasedSlot,
            next_available_at: nextAvailableAt,
          }
        })
    : null

  const hasPromotions = sample.has_promotions ?? Boolean(sample.promotions?.length)
  const promotionCount = sample.promotion_count ?? sample.promotions?.length ?? 0
  const rawShopSlot = sample.next_available_slot ?? computedShopSlot ?? null
  const shopSlot = rebaseNextSlot(rawShopSlot)
  const nextAvailableAt =
    rebaseIsoDateTime(sample.next_available_at ?? rawShopSlot?.start_at ?? null) ??
    sample.next_available_at ??
    rawShopSlot?.start_at ??
    null

  return {
    id: sample.id,
    slug: sample.slug ?? sample.id,
    name: sample.name,
    store_name: sample.store_name ?? sample.name,
    area: sample.area,
    area_name: sample.area_name ?? sample.area,
    address: sample.address ?? null,
    categories: sample.categories ?? ['メンズエステ'],
    service_tags: sample.service_tags ?? null,
    min_price: sample.min_price,
    max_price: sample.max_price,
    rating: sample.reviews?.average_score ?? null,
    review_count: sample.reviews?.review_count ?? null,
    lead_image_url: sample.photos?.[0]?.url ?? null,
    badges: sample.badges ?? null,
    today_available: sample.today_available ?? null,
    next_available_at: nextAvailableAt,
    next_available_slot: shopSlot,
    distance_km: sample.distance_km ?? null,
    online_reservation:
      sample.online_reservation ??
      Boolean(sample.contact?.reservation_form_url || sample.contact?.website_url),
    updated_at: sample.updated_at ?? null,
    promotions: sample.promotions ?? null,
    ranking_reason: sample.ranking_reason ?? null,
    price_band: priceBandKey ?? null,
    price_band_label: priceBandLabel,
    has_promotions: hasPromotions,
    has_discounts: sample.has_discounts ?? false,
    promotion_count: promotionCount,
    diary_count: sample.diary_count ?? sample.diaries?.length ?? null,
    has_diaries: sample.has_diaries ?? Boolean(sample.diaries?.length),
    staff_preview: staffPreview,
  }
}

export function sampleShopToDetail(sample: SampleShop): ShopDetail {
  const { shopSlot: detailComputedSlot, staffSlots: detailStaffSlots } =
    computeSampleNextSlots(sample)
  const staff: StaffSummary[] | null = Array.isArray(sample.staff)
    ? sample.staff.map((member, index) => {
        const staffId = member.id || uuidFromString(`staff:${sample.id}:${index}`)
        const staffSlot = member.id ? (detailStaffSlots.get(member.id) ?? null) : null
        const mergedSlot = member.next_available_slot ?? staffSlot ?? null
        return {
          id: staffId,
          name: member.name,
          alias: member.alias ?? null,
          avatar_url: member.avatar_url ?? null,
          headline: member.headline ?? null,
          rating: member.rating ?? null,
          review_count: member.review_count ?? null,
          specialties: member.specialties ?? null,
          next_available_slot: rebaseNextSlot(mergedSlot),
        }
      })
    : null

  const staffIdMap = new Map<string, string>()
  staff?.forEach((member, index) => {
    const sourceId = sample.staff?.[index]?.id || `${sample.id}-staff-${index}`
    staffIdMap.set(sourceId, member.id)
  })

  const availability_calendar: AvailabilityCalendar | null = sample.availability_calendar
    ? {
        shop_id: sample.id,
        generated_at:
          rebaseIsoDateTime(sample.availability_calendar.generated_at) ??
          sample.availability_calendar.generated_at,
        days: sample.availability_calendar.days.map((day, dayIndex) => ({
          date: rebaseIsoDate(day.date) ?? day.date,
          is_today: day.is_today ?? null,
          slots: day.slots.map((slot, slotIndex) => ({
            start_at: rebaseIsoDateTime(slot.start_at) ?? slot.start_at,
            end_at: rebaseIsoDateTime(slot.end_at) ?? slot.end_at,
            status: slot.status,
            staff_id: slot.staff_id ? staffIdMap.get(slot.staff_id) || slot.staff_id : null,
            menu_id: slot.menu_id || uuidFromString(`menu:${sample.id}:${dayIndex}:${slotIndex}`),
          })),
        })),
      }
    : null

  const menus: MenuItem[] | null = Array.isArray(sample.menus)
    ? sample.menus.map((menu, index) => ({
        id: menu.id || uuidFromString(`menu:${sample.id}:${index}`),
        name: menu.name,
        description: menu.description ?? null,
        duration_minutes: menu.duration_minutes ?? null,
        price: menu.price,
        currency: 'JPY',
        is_reservable_online:
          sample.online_reservation ??
          Boolean(sample.contact?.reservation_form_url || sample.contact?.website_url),
        tags: menu.tags ?? null,
      }))
    : null

  const diaryEntries: DiaryEntry[] | null = Array.isArray(sample.diaries)
    ? sample.diaries.map((entry, index) => ({
        id: entry.id || uuidFromString(`diary:${sample.id}:${index}`),
        title: entry.title ?? null,
        body: entry.body,
        photos: entry.photos ?? null,
        hashtags: entry.hashtags ?? null,
        published_at: entry.published_at ?? null,
      }))
    : null

  const highlighted: HighlightedReview[] | null = sample.reviews?.highlighted
    ? sample.reviews.highlighted.map((review, index) => ({
        review_id: review.review_id || uuidFromString(`review:${sample.id}:${index}`),
        title: review.title,
        body: review.body,
        score: review.score,
        visited_at: review.visited_at ?? null,
        author_alias: review.author_alias ?? null,
        aspects: review.aspects ?? null,
      }))
    : null

  const detailShopSlot = rebaseNextSlot(sample.next_available_slot ?? detailComputedSlot ?? null)

  const photos = Array.isArray(sample.photos)
    ? sample.photos.map((photo) => ({
        url: photo.url,
        kind: 'photo',
        caption: photo.alt ?? null,
      }))
    : null

  return {
    id: sample.id,
    slug: sample.slug ?? sample.id,
    name: sample.name,
    area: sample.area,
    area_name: sample.area_name ?? null,
    min_price: sample.min_price,
    max_price: sample.max_price,
    description: sample.description ?? null,
    catch_copy: sample.catch_copy ?? null,
    photos,
    contact: sample.contact ?? null,
    menus,
    staff,
    availability_calendar,
    badges: sample.badges ?? null,
    today_available: sample.today_available ?? null,
    next_available_slot: detailShopSlot,
    service_tags: sample.service_tags ?? null,
    metadata: {
      updated_at: sample.updated_at ?? null,
      distance_km: sample.distance_km ?? null,
      next_available_at:
        rebaseIsoDateTime(sample.next_available_at ?? detailComputedSlot?.start_at ?? null) ??
        sample.next_available_at ??
        detailComputedSlot?.start_at ??
        detailShopSlot?.start_at ??
        null,
    },
    store_name: sample.store_name ?? null,
    promotions: sample.promotions ?? null,
    ranking_reason: sample.ranking_reason ?? null,
    reviews: {
      average_score: sample.reviews?.average_score ?? null,
      review_count: sample.reviews?.review_count ?? null,
      highlighted,
      aspect_averages: sample.reviews?.aspect_averages ?? null,
      aspect_counts: sample.reviews?.aspect_counts ?? null,
    },
    diary_count: sample.diary_count ?? sample.diaries?.length ?? null,
    has_diaries: sample.has_diaries ?? Boolean(sample.diaries?.length),
    diaries: diaryEntries,
  }
}
