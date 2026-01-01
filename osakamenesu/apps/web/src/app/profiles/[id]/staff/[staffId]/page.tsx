import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import SafeImage from '@/components/SafeImage'
import type { ReservationOverlayProps } from '@/components/ReservationOverlay'
import ReservationOverlayRoot from '@/components/ReservationOverlayRoot'
import type { TherapistHit } from '@/components/staff/TherapistCard'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Section } from '@/components/ui/Section'
import { ProfileTagList } from '@/components/staff/ProfileTagList'
import { buildStaffIdentifier, staffMatchesIdentifier, slugifyStaffIdentifier } from '@/lib/staff'
import { formatDatetimeLocal, toZonedDayjs } from '@/lib/timezone'
import { SimilarTherapistsSection } from '@/features/matching/ui/SimilarTherapistsSection'
import { fetchShop, type ShopDetail, type StaffSummary } from '@/lib/shops'
import StaffReservationClient from './StaffReservationClient'

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

type StaffPageProps = {
  params: Promise<{ id: string; staffId: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function toDateTimeLocal(iso?: string | null) {
  if (!iso) return undefined
  const formatted = formatDatetimeLocal(iso)
  return formatted || undefined
}

function computeSlotDurationMinutes(
  startIso?: string | null,
  endIso?: string | null,
): number | undefined {
  if (!startIso || !endIso) return undefined
  const start = toZonedDayjs(startIso)
  const end = toZonedDayjs(endIso)
  if (!start.isValid() || !end.isValid()) return undefined
  const diff = Math.max(0, Math.round(end.diff(start, 'minute', true)))
  return diff || undefined
}

function shorten(text?: string | null, max = 160): string | null {
  if (!text) return null
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function parseBooleanParam(value?: string | string[] | null): boolean {
  if (!value) return false
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return false
  const normalized = raw.toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export async function generateMetadata({ params }: StaffPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const shop = await fetchShop(resolvedParams.id)
  const staff = findStaff(shop, resolvedParams.staffId)
  const title = staff ? `${staff.name}｜${shop.name}のセラピスト` : `${shop.name}｜セラピスト`
  const description = staff?.headline || `${shop.name}に在籍するセラピストのプロフィール`
  return { title, description }
}

export default async function StaffProfilePage({ params, searchParams }: StaffPageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const shop = await fetchShop(resolvedParams.id)
  const staff = findStaff(shop, resolvedParams.staffId)

  if (!staff) {
    notFound()
  }

  const allowDemoSubmission = parseBooleanParam(resolvedSearchParams?.force_demo_submit ?? null)

  const shopHref = buildShopHref(resolvedParams)
  const staffId = staff.id
  const specialties = formatSpecialties(staff.specialties)
  const specialtiesLabel = specialties.length ? specialties.join(' / ') : null
  const ratingLabel = typeof staff.rating === 'number' ? `${staff.rating.toFixed(1)} / 5.0` : null
  const reviewLabel =
    typeof staff.review_count === 'number' ? `${staff.review_count}件のクチコミ` : null
  const contact = shop.contact || {}
  const phone = contact.phone || null
  const lineId = contact.line_id
    ? contact.line_id.startsWith('@')
      ? contact.line_id.slice(1)
      : contact.line_id
    : null
  const otherStaff = listOtherStaff(shop, staff.id)
  const availabilityDays = Array.isArray(shop.availability_calendar?.days)
    ? (shop.availability_calendar?.days ?? [])
    : []
  const normalizedStaffId =
    slugifyStaffIdentifier(staff.id) ||
    slugifyStaffIdentifier(staff.alias) ||
    slugifyStaffIdentifier(staff.name)

  // Filter availability to only this staff's slots
  const staffAvailability = availabilityDays
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

  // Find first open slot for default selection
  const firstOpenSlot = (() => {
    for (const day of staffAvailability) {
      const slot = day.slots.find((item) => item.status === 'open')
      if (slot) return slot
    }
    return null
  })()

  const defaultSlotLocal = firstOpenSlot ? toDateTimeLocal(firstOpenSlot.start_at) : undefined
  const defaultDurationMinutes = firstOpenSlot
    ? computeSlotDurationMinutes(firstOpenSlot.start_at, firstOpenSlot.end_at)
    : undefined

  // Build TherapistHit for ReservationOverlay
  const therapistHit: TherapistHit = {
    id: `${shop.id}-${staffId}`,
    therapistId: staffId,
    staffId,
    name: staff.name,
    alias: staff.alias ?? null,
    headline: shorten(staff.headline, 80) ?? null,
    specialties: specialties,
    avatarUrl: staff.avatar_url ?? null,
    rating: staff.rating ?? null,
    reviewCount: staff.review_count ?? null,
    shopId: shop.id,
    shopSlug: shop.slug ?? null,
    shopName: shop.name,
    shopArea: shop.area,
    shopAreaName: shop.area_name ?? null,
    todayAvailable: staff.today_available ?? null,
    nextAvailableSlot: firstOpenSlot
      ? { start_at: firstOpenSlot.start_at, status: 'ok' as const }
      : null,
    mood_tag: staff.mood_tag,
    style_tag: staff.style_tag,
    look_type: staff.look_type,
    contact_style: staff.contact_style,
    hobby_tags: staff.hobby_tags ?? undefined,
  }

  // Profile details for overlay
  const overlayProfileDetails = [
    shop.area_name || shop.area ? { label: 'エリア', value: shop.area_name || shop.area } : null,
    specialties.length ? { label: '得意な施術', value: specialties.slice(0, 4).join(' / ') } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>

  // Build ReservationOverlay config
  const reservationOverlayConfig = {
    hit: therapistHit,
    tel: phone,
    lineId,
    defaultStart: defaultSlotLocal ?? null,
    defaultDurationMinutes: defaultDurationMinutes ?? null,
    allowDemoSubmission,
    gallery: staff.avatar_url ? [staff.avatar_url] : undefined,
    profileDetails: overlayProfileDetails.length ? overlayProfileDetails : undefined,
    profileBio: staff.headline ?? null,
    availabilityDays: staffAvailability,
    therapistId: staffId,
  } satisfies Omit<ReservationOverlayProps, 'onClose'>

  return (
    <main className="relative min-h-screen bg-neutral-surface">
      <ReservationOverlayRoot />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(147,197,253,0.18),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(196,181,253,0.16),_transparent_50%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-4xl space-y-6 px-4 py-10 lg:space-y-8">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <Link
              href={shopHref}
              className="text-xs font-semibold uppercase tracking-wide text-brand-primary hover:underline"
            >
              {shop.name} に戻る
            </Link>
            <h1 className="text-3xl font-semibold text-neutral-text">{staff.name}</h1>
            {staff.alias ? <p className="text-sm text-neutral-textMuted">{staff.alias}</p> : null}
          </div>
          {ratingLabel ? (
            <div className="text-right text-sm text-neutral-text">
              <div className="font-semibold text-brand-primaryDark">評価 {ratingLabel}</div>
              {reviewLabel ? (
                <div className="text-xs text-neutral-textMuted">{reviewLabel}</div>
              ) : null}
            </div>
          ) : null}
        </div>

        <Section
          title="プロフィール"
          subtitle={specialtiesLabel ?? undefined}
          className="border border-neutral-borderLight/70 bg-white/90 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/80"
        >
          <div className="grid gap-6 md:grid-cols-[minmax(0,260px)_1fr] md:items-start">
            <div className="overflow-hidden rounded-card border border-neutral-borderLight bg-neutral-surface">
              {staff.avatar_url ? (
                <SafeImage
                  src={staff.avatar_url}
                  alt={`${staff.name}の写真`}
                  width={480}
                  height={640}
                  className="h-full w-full object-cover"
                  fallbackSrc="/images/placeholder-avatar.svg"
                />
              ) : (
                <div className="flex h-full min-h-[320px] items-center justify-center bg-neutral-surfaceAlt text-3xl font-semibold text-neutral-textMuted">
                  {staff.name.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="space-y-5">
              {specialties.length ? (
                <div className="flex flex-wrap gap-2">
                  {specialties.map((tag) => (
                    <Chip key={tag} variant="accent" className="text-xs">
                      {tag}
                    </Chip>
                  ))}
                </div>
              ) : null}
              <ProfileTagList
                mood_tag={staff.mood_tag}
                style_tag={staff.style_tag}
                look_type={staff.look_type}
                contact_style={staff.contact_style}
                hobby_tags={staff.hobby_tags}
              />
              {staff.headline ? (
                <p className="text-sm leading-relaxed text-neutral-text">{staff.headline}</p>
              ) : null}

              <Card
                className="space-y-3 border-neutral-borderLight/80 bg-neutral-surfaceAlt/80 p-4"
                as="div"
              >
                <h2 className="text-sm font-semibold text-neutral-text">お問い合わせ・予約</h2>
                <div className="flex flex-wrap gap-2 text-xs">
                  {contact.phone ? <Badge variant="outline">電話 {contact.phone}</Badge> : null}
                  {contact.line_id ? <Badge variant="outline">LINE {contact.line_id}</Badge> : null}
                  {contact.reservation_form_url ? (
                    <a
                      href={contact.reservation_form_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-badge border border-brand-primary/40 px-3 py-1 font-semibold text-brand-primaryDark transition hover:border-brand-primary"
                    >
                      公式予約フォーム
                    </a>
                  ) : null}
                  {contact.website_url ? (
                    <a
                      href={contact.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-badge border border-neutral-borderLight px-3 py-1 font-semibold text-neutral-text transition hover:border-brand-primary hover:text-brand-primary"
                    >
                      公式サイトを見る
                    </a>
                  ) : null}
                </div>
                <p className="text-xs text-neutral-textMuted">
                  店舗からの折り返しで予約が確定します。空き枠は変動するため、このページの空き状況を参考にしつつ、ご不明な点は直接お問い合わせください。
                </p>
              </Card>
            </div>
          </div>
        </Section>

        <Card
          id="reserve"
          className="space-y-3 border border-neutral-borderLight/70 bg-white/95 p-5 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/85"
        >
          <div className="space-y-1">
            <div className="text-sm font-semibold text-neutral-text">WEB予約リクエスト</div>
            <p className="text-xs leading-relaxed text-neutral-textMuted">
              空き状況カレンダーから枠を選択して予約リクエストを送信できます。店舗担当者からの折り返しで予約確定となります。
            </p>
          </div>
          <StaffReservationClient
            tel={phone}
            lineId={lineId}
            shopName={shop.name}
            overlay={reservationOverlayConfig}
          />
        </Card>

        <SimilarTherapistsSection baseStaffId={staffId} />

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
                  href={buildStaffHref(resolvedParams.id, member)}
                  className="flex items-center gap-3 rounded-card border border-neutral-borderLight/70 bg-neutral-surfaceAlt/60 p-3 transition hover:border-brand-primary"
                >
                  <div className="relative h-16 w-16 overflow-hidden rounded-full bg-neutral-surface">
                    <SafeImage
                      src={member.avatar_url || undefined}
                      alt={`${member.name}の写真`}
                      fill
                      className="object-cover"
                      fallbackSrc="/images/placeholder-avatar.svg"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-neutral-text">{member.name}</div>
                    {member.specialties?.length ? (
                      <div className="text-xs text-neutral-textMuted">
                        {member.specialties.slice(0, 2).join(' / ')}
                      </div>
                    ) : null}
                    <ProfileTagList
                      mood_tag={member.mood_tag}
                      style_tag={member.style_tag}
                      look_type={member.look_type}
                      contact_style={member.contact_style}
                      hobby_tags={member.hobby_tags}
                      className="mt-1 text-[11px]"
                    />
                  </div>
                  <span className="text-xs text-brand-primary">詳細 →</span>
                </Link>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </main>
  )
}
