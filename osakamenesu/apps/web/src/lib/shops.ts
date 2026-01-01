import { notFound } from 'next/navigation'
import { buildApiUrl, resolveApiBases } from '@/lib/api'
import { getSampleShops } from '@/lib/sampleShops'
import { sampleShopToDetail } from '@/lib/sampleShopAdapters'
import { type NextAvailableSlotPayload } from '@/lib/nextAvailableSlot'

export type MediaImage = { url: string; kind?: string | null; caption?: string | null }
export type Contact = {
    phone?: string | null
    line_id?: string | null
    website_url?: string | null
    reservation_form_url?: string | null
    sns?: Array<{ platform: string; url: string; label?: string | null }> | null
}
export type MenuItem = {
    id: string
    name: string
    description?: string | null
    duration_minutes?: number | null
    price: number
    currency?: string | null
    is_reservable_online?: boolean | null
    tags?: string[] | null
}
export type Promotion = {
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
    today_available?: boolean | null
    next_available_slot?: NextAvailableSlotPayload | null
    next_available_at?: string | null
    mood_tag?: string | null
    talk_level?: string | null
    style_tag?: string | null
    look_type?: string | null
    contact_style?: string | null
    hobby_tags?: string[] | null
}
export type AvailabilitySlot = {
    start_at: string
    end_at: string
    status: 'open' | 'tentative' | 'blocked'
    staff_id?: string | null
    menu_id?: string | null
}
export type AvailabilityDay = { date: string; is_today?: boolean | null; slots: AvailabilitySlot[] }
export type AvailabilityCalendar = { shop_id: string; generated_at: string; days: AvailabilityDay[] }

export type ReviewAspectKey = 'therapist_service' | 'staff_response' | 'room_cleanliness'
export type ReviewAspect = { score: number; note?: string | null }
export type ReviewAspects = Partial<Record<ReviewAspectKey, ReviewAspect>>
export type HighlightedReview = {
    review_id?: string | null
    title: string
    body: string
    score: number
    visited_at?: string | null
    author_alias?: string | null
    aspects?: ReviewAspects | null
}
export type ReviewSummary = {
    average_score?: number | null
    review_count?: number | null
    highlighted?: HighlightedReview[] | null
    aspect_averages?: Partial<Record<ReviewAspectKey, number>> | null
    aspect_counts?: Partial<Record<ReviewAspectKey, number>> | null
}
export type DiaryEntry = {
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
    photos?: MediaImage[] | null
    contact?: Contact | null
    menus?: MenuItem[] | null
    staff?: StaffSummary[] | null
    availability_calendar?: AvailabilityCalendar | null
    badges?: string[] | null
    today_available?: boolean | null
    service_tags?: string[] | null
    metadata?: Record<string, unknown> | null
    store_name?: string | null
    promotions?: Promotion[] | null
    ranking_reason?: string | null
    reviews?: ReviewSummary | null
    diary_count?: number | null
    has_diaries?: boolean | null
    diaries?: DiaryEntry[] | null
    business_hours?: string | null
    address?: string | null
    nearest_station?: string | null
    station_walk_minutes?: number | null
}

function parseText(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
}

function parseNumber(value: unknown): number | null {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
        const parsed = Number(value)
        return Number.isNaN(parsed) ? null : parsed
    }
    return null
}

function normalizeShopDetail(data: any): ShopDetail {
    // Handle both snake_case (API) and camelCase or direct mapping
    const id = parseText(data.id) ?? ''
    const name = parseText(data.name) ?? '名称未設定'
    const area = parseText(data.area_name) ?? parseText(data.area) ?? '未設定エリア'
    const slug = parseText(data.slug)

    // Price handling: support price_min/min_price and price_max/max_price
    const min_price = (parseNumber(data.price_min) ?? parseNumber(data.min_price)) ?? 0
    const max_price = (parseNumber(data.price_max) ?? parseNumber(data.max_price)) ?? 0

    // Staff normalizing
    let staff: StaffSummary[] = []
    if (Array.isArray(data.staff)) {
        staff = data.staff.map((member: any) => ({
            id: parseText(member.id) ?? '',
            name: parseText(member.name) ?? 'スタッフ',
            alias: parseText(member.alias),
            headline: parseText(member.headline),
            avatar_url: parseText(member.avatar_url) ?? parseText(member.avatarUrl) ?? parseText(member.photo_url) ?? parseText(member.image),
            rating: parseNumber(member.rating),
            review_count: parseNumber(member.review_count),
            specialties: Array.isArray(member.specialties) ? member.specialties : null,
            today_available: Boolean(member.today_available),
            mood_tag: parseText(member.mood_tag),
            style_tag: parseText(member.style_tag),
            look_type: parseText(member.look_type),
            talk_level: parseText(member.talk_level),
            contact_style: parseText(member.contact_style),
            hobby_tags: Array.isArray(member.hobby_tags) ? member.hobby_tags : null,
        })).filter((s: StaffSummary) => s.id !== '')
    }

    // Menus
    let menus: MenuItem[] = []
    if (Array.isArray(data.menus)) {
        menus = data.menus.map((m: any) => ({
            id: parseText(m.id) ?? '',
            name: parseText(m.name) ?? '',
            price: parseNumber(m.price) ?? 0,
            description: parseText(m.description),
            duration_minutes: parseNumber(m.duration_minutes),
            currency: parseText(m.currency),
            is_reservable_online: Boolean(m.is_reservable_online),
            tags: Array.isArray(m.tags) ? m.tags : null
        }))
    }

    // Contact
    const contact: Contact = {
        phone: parseText(data.contact?.phone) ?? parseText(data.phone),
        line_id: parseText(data.contact?.line_id) ?? parseText(data.line_id),
        website_url: parseText(data.contact?.website_url) ?? parseText(data.website_url),
        reservation_form_url: parseText(data.contact?.reservation_form_url),
        sns: Array.isArray(data.contact?.sns) ? data.contact.sns : null
    }

    return {
        id,
        name,
        area,
        area_name: parseText(data.area_name) ?? parseText(data.area),
        slug,
        min_price,
        max_price,
        description: parseText(data.description),
        catch_copy: parseText(data.catch_copy),
        address: parseText(data.address),
        store_name: parseText(data.store_name),
        // Images can be under photos or map directly if sample
        photos: Array.isArray(data.photos) ? data.photos : [],
        contact,
        menus,
        staff,
        availability_calendar: data.availability_calendar,
        badges: Array.isArray(data.badges) ? data.badges : [],
        today_available: Boolean(data.today_available),
        service_tags: Array.isArray(data.service_tags) ? data.service_tags : [],
        promotions: Array.isArray(data.promotions) ? data.promotions : [],
        ranking_reason: parseText(data.ranking_reason),
        reviews: data.reviews ? {
            average_score: parseNumber(data.reviews.average_score),
            review_count: parseNumber(data.reviews.review_count),
            highlighted: data.reviews.highlighted,
        } : null,
        diary_count: parseNumber(data.diary_count),
        has_diaries: Boolean(data.has_diaries),
        diaries: Array.isArray(data.diaries) ? data.diaries : null,
        business_hours: parseText(data.business_hours),
        nearest_station: parseText(data.nearest_station),
        station_walk_minutes: parseNumber(data.station_walk_minutes),
    }
}

export async function fetchShop(id: string, preferApi = false): Promise<ShopDetail> {
    // Always try API first when API base is configured (e.g., local development)
    const hasApiBase = Boolean(process.env.OSAKAMENESU_API_BASE || process.env.OSAKAMENESU_API_INTERNAL_BASE)

    // For slug-like IDs or explicit API preference
    if (preferApi || hasApiBase) {
        const targets = resolveApiBases()
        const endpoint = `/api/v1/shops/${encodeURIComponent(id)}`
        for (const base of targets) {
            try {
                const response = await fetch(buildApiUrl(base, endpoint), {
                    cache: 'no-store',
                    headers: { 'Content-Type': 'application/json' }
                })
                if (response.ok) {
                    const data = await response.json()
                    return normalizeShopDetail(data)
                }
            } catch {
                // try next base
            }
        }
    }

    const fallback = getSampleShops().find((shop) => shop.id === id || shop.slug === id)
    if (fallback) {
        return sampleShopToDetail(fallback)
    }

    notFound()
}
